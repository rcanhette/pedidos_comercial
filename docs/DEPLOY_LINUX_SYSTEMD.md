# Deploy em Servidor Linux com systemd

Este guia instala o Pedidos Comerciais em um servidor Linux como serviço `systemd`, usando PostgreSQL e Node.js.

Os comandos assumem Ubuntu/Debian. Ajuste usuário, domínio e caminhos conforme o servidor.

## 1. Requisitos

- Linux com acesso SSH e usuário com `sudo`.
- Node.js 22 LTS ou compatível com o projeto.
- PostgreSQL 17/18 local ou PostgreSQL gerenciado.
- `git`, `curl`, `build-essential`, `openssl`.
- Porta interna da aplicação: `3001` ou `3000`.
- HTTPS via proxy reverso, como Nginx + Certbot.

## 2. Instalar pacotes

```bash
sudo apt update
sudo apt install -y curl git build-essential postgresql postgresql-client nginx

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
psql --version
```

## 3. Criar usuário de sistema

```bash
sudo useradd --system --create-home --shell /bin/bash pedidos
sudo mkdir -p /opt/pedidos-comercial
sudo chown pedidos:pedidos /opt/pedidos-comercial
```

## 4. Enviar ou clonar o projeto

Opção com Git:

```bash
sudo -u pedidos git clone <URL_DO_REPOSITORIO> /opt/pedidos-comercial
```

Opção copiando arquivos:

```bash
sudo rsync -av --delete ./ /opt/pedidos-comercial/
sudo chown -R pedidos:pedidos /opt/pedidos-comercial
```

## 5. Configurar PostgreSQL

Entre no `psql` como usuário postgres:

```bash
sudo -u postgres psql
```

Crie usuário e banco:

```sql
CREATE USER sistema_pedidos WITH PASSWORD 'troque-por-uma-senha-forte';
CREATE DATABASE sistema_pedidos OWNER sistema_pedidos;
\q
```

Teste:

```bash
PGPASSWORD='troque-por-uma-senha-forte' psql -h localhost -p 5432 -U sistema_pedidos -d sistema_pedidos -c 'select 1;'
```

Não exponha a porta 5432 para a internet. Se usar firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 6. Configurar `.env`

Crie o arquivo:

```bash
cd /opt/pedidos-comercial
sudo -u pedidos cp .env.example .env
sudo -u pedidos nano .env
```

Exemplo de produção:

```env
DATABASE_URL="postgresql://sistema_pedidos:troque-por-uma-senha-forte@localhost:5432/sistema_pedidos?schema=public"
TEST_DATABASE_URL="postgresql://sistema_pedidos:troque-por-uma-senha-forte@localhost:5432/sistema_pedidos_test?schema=public"
POSTGRES_DB="sistema_pedidos"
POSTGRES_USER="sistema_pedidos"
POSTGRES_PASSWORD="troque-por-uma-senha-forte"

SESSION_SECRET="gere-uma-chave-grande-com-openssl-rand-base64-48"
ADMIN_INITIAL_PASSWORD="defina-uma-senha-inicial-forte"
APP_TIMEZONE="America/Sao_Paulo"
NEXT_PUBLIC_APP_NAME="Pedidos Comerciais"
SESSION_COOKIE_SECURE="true"
AUTH_BASE_URL="https://seu-dominio.com.br"

SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_STARTTLS="true"
SMTP_USER="usuario@dominio.com.br"
SMTP_PASSWORD="senha-ou-senha-de-aplicativo"
SMTP_FROM="Pedidos Comerciais <usuario@dominio.com.br>"
SMTP_HELO="seu-dominio.com.br"
```

Gere uma chave segura:

```bash
openssl rand -base64 48
```

Permissões do `.env`:

```bash
sudo chown pedidos:pedidos /opt/pedidos-comercial/.env
sudo chmod 600 /opt/pedidos-comercial/.env
```

## 7. Instalar dependências, migrations e build

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npm ci
sudo -u pedidos npx prisma generate
sudo -u pedidos npx prisma migrate deploy
sudo -u pedidos npm run db:seed
sudo -u pedidos npm run build
```

Use `npm run db:seed` apenas para uma base inicial. Ele é idempotente e cria permissões, perfis, cadastros iniciais e admin se necessário.

## 8. Criar serviço systemd

Crie o arquivo:

```bash
sudo nano /etc/systemd/system/pedidos-comercial.service
```

Conteúdo:

```ini
[Unit]
Description=Pedidos Comerciais Next.js
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=pedidos
Group=pedidos
WorkingDirectory=/opt/pedidos-comercial
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/npm run start -- -p 3001
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/pedidos-comercial/backups /opt/pedidos-comercial/.next /opt/pedidos-comercial

[Install]
WantedBy=multi-user.target
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pedidos-comercial
sudo systemctl start pedidos-comercial
sudo systemctl status pedidos-comercial
```

Logs:

```bash
sudo journalctl -u pedidos-comercial -f
```

Teste local no servidor:

```bash
curl -I http://localhost:3001/login
```

## 9. Nginx como proxy reverso

Crie:

```bash
sudo nano /etc/nginx/sites-available/pedidos-comercial
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name seu-dominio.com.br;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Ative:

```bash
sudo ln -s /etc/nginx/sites-available/pedidos-comercial /etc/nginx/sites-enabled/pedidos-comercial
sudo nginx -t
sudo systemctl reload nginx
```

HTTPS com Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

Depois confirme no `.env`:

```env
SESSION_COOKIE_SECURE="true"
AUTH_BASE_URL="https://seu-dominio.com.br"
```

Reinicie:

```bash
sudo systemctl restart pedidos-comercial
```

## 10. Operação diária

Status:

```bash
sudo systemctl status pedidos-comercial
```

Reiniciar:

```bash
sudo systemctl restart pedidos-comercial
```

Logs:

```bash
sudo journalctl -u pedidos-comercial -n 200
sudo journalctl -u pedidos-comercial -f
```

Atualizar aplicação:

```bash
cd /opt/pedidos-comercial
sudo systemctl stop pedidos-comercial
sudo -u pedidos git pull
sudo -u pedidos npm ci
sudo -u pedidos npx prisma generate
sudo -u pedidos npx prisma migrate deploy
sudo -u pedidos npm run build
sudo systemctl start pedidos-comercial
```

## 11. Backup PostgreSQL

Backup manual:

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npm run db:backup
```

Os arquivos ficam em:

```text
/opt/pedidos-comercial/backups/postgresql/
```

Cron diário às 02:00:

```bash
sudo crontab -e
```

Adicione:

```cron
0 2 * * * cd /opt/pedidos-comercial && sudo -u pedidos npm run db:backup >> /var/log/pedidos-backup.log 2>&1
```

## 12. Restauração

Pare a aplicação:

```bash
sudo systemctl stop pedidos-comercial
```

Restaure:

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npm run db:restore -- backups/postgresql/pedidos-YYYY-MM-DD-HHMMSS.dump
```

Suba novamente:

```bash
sudo systemctl start pedidos-comercial
```

## 13. Checklist de produção

- `.env` com `SESSION_SECRET` forte.
- `.env` com permissão `600`.
- PostgreSQL não exposto publicamente.
- HTTPS ativo.
- `SESSION_COOKIE_SECURE=true`.
- SMTP testado para envio de código 2FA.
- Backup automático configurado.
- `npx prisma migrate deploy` executado.
- `npm run build` concluído.
- `curl -I http://localhost:3001/login` retorna 200.
- `systemctl status pedidos-comercial` ativo.

## 14. Solução de problemas

Ver erro da aplicação:

```bash
sudo journalctl -u pedidos-comercial -f
```

Ver conexão com banco:

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npx prisma validate
sudo -u pedidos npx prisma migrate status
```

Testar PostgreSQL:

```bash
PGPASSWORD='senha' psql -h localhost -p 5432 -U sistema_pedidos -d sistema_pedidos -c 'select count(*) from "User";'
```

Se login não envia código, revise SMTP AUTH, senha de aplicativo e logs do serviço.
