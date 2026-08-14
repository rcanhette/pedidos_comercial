# Instalação em Servidor Linux e Serviço systemd

Este documento descreve como instalar o sistema Pedidos Comerciais em um servidor Linux a partir do pacote `.tar.gz` gerado em `release/`.

O pacote não inclui `.env`, `node_modules`, `.next`, bancos locais, backups ou credenciais. Esses itens devem ser criados no servidor.

## 1. Requisitos

Servidor recomendado:

- Ubuntu Server 22.04/24.04 ou Debian equivalente.
- Acesso SSH com usuário que possua `sudo`.
- Node.js 22 LTS.
- PostgreSQL local ou gerenciado.
- Nginx para proxy reverso.
- Domínio apontando para o servidor, caso use HTTPS público.

## 2. Instalar dependências do sistema

```bash
sudo apt update
sudo apt install -y curl build-essential postgresql postgresql-client nginx openssl

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
psql --version
```

## 3. Criar usuário e diretório da aplicação

```bash
sudo useradd --system --create-home --shell /bin/bash pedidos
sudo mkdir -p /opt/pedidos-comercial
sudo chown pedidos:pedidos /opt/pedidos-comercial
```

## 4. Enviar e extrair o pacote

No seu computador, transfira o arquivo `.tar.gz` para o servidor. Exemplo usando `scp`:

```bash
scp release/pedidos-comercial-linux-YYYY-MM-DD-HHMMSS.tar.gz usuario@IP_DO_SERVIDOR:/tmp/
```

No servidor:

```bash
sudo systemctl stop pedidos-comercial 2>/dev/null || true
sudo tar -xzf /tmp/pedidos-comercial-linux-YYYY-MM-DD-HHMMSS.tar.gz -C /opt/pedidos-comercial --strip-components=1
sudo chown -R pedidos:pedidos /opt/pedidos-comercial
```

## 5. Criar banco PostgreSQL

Entre no PostgreSQL:

```bash
sudo -u postgres psql
```

Crie usuário e banco:

```sql
CREATE USER sistema_pedidos WITH PASSWORD 'troque-por-uma-senha-forte';
CREATE DATABASE sistema_pedidos OWNER sistema_pedidos;
\q
```

Teste a conexão:

```bash
PGPASSWORD='troque-por-uma-senha-forte' psql -h localhost -p 5432 -U sistema_pedidos -d sistema_pedidos -c 'select 1;'
```

## 6. Configurar `.env`

```bash
cd /opt/pedidos-comercial
sudo -u pedidos cp .env.example .env
sudo -u pedidos nano .env
```

Configuração mínima de produção:

```env
DATABASE_URL="postgresql://sistema_pedidos:troque-por-uma-senha-forte@localhost:5432/sistema_pedidos?schema=public"
TEST_DATABASE_URL="postgresql://sistema_pedidos:troque-por-uma-senha-forte@localhost:5432/sistema_pedidos_test?schema=public"
POSTGRES_DB="sistema_pedidos"
POSTGRES_USER="sistema_pedidos"
POSTGRES_PASSWORD="troque-por-uma-senha-forte"

SESSION_SECRET="gere-com-openssl-rand-base64-48"
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

Gere uma chave segura para `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

Proteja o arquivo:

```bash
sudo chown pedidos:pedidos /opt/pedidos-comercial/.env
sudo chmod 600 /opt/pedidos-comercial/.env
```

## 7. Instalar dependências e preparar banco

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npm ci
sudo -u pedidos npx prisma validate
sudo -u pedidos npx prisma generate
sudo -u pedidos npx prisma migrate deploy
sudo -u pedidos npm run db:seed
```

Observações:

- Use `npx prisma migrate deploy` em servidor. Não use `prisma migrate dev` em produção.
- `npm run db:seed` cria/atualiza permissões, perfis, cadastros iniciais e usuário admin conforme a regra do projeto.
- Não use `prisma migrate reset` nem `prisma db push --force-reset` em produção.

## 8. Gerar build de produção

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npm run build
```

Teste manual:

```bash
sudo -u pedidos npm run start -- -p 3001
```

Em outro terminal:

```bash
curl -I http://localhost:3001/login
```

Pare o processo manual com `Ctrl+C` antes de criar o serviço.

## 9. Criar serviço systemd

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
ReadWritePaths=/opt/pedidos-comercial

[Install]
WantedBy=multi-user.target
```

Ative e inicie:

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

## 10. Configurar Nginx

Crie o site:

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
sudo ln -sf /etc/nginx/sites-available/pedidos-comercial /etc/nginx/sites-enabled/pedidos-comercial
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Ativar HTTPS

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

## 12. Atualizar uma instalação existente

```bash
scp release/pedidos-comercial-linux-YYYY-MM-DD-HHMMSS.tar.gz usuario@IP_DO_SERVIDOR:/tmp/

sudo systemctl stop pedidos-comercial
sudo tar -xzf /tmp/pedidos-comercial-linux-YYYY-MM-DD-HHMMSS.tar.gz -C /opt/pedidos-comercial --strip-components=1
sudo chown -R pedidos:pedidos /opt/pedidos-comercial
cd /opt/pedidos-comercial
sudo -u pedidos npm ci
sudo -u pedidos npx prisma generate
sudo -u pedidos npx prisma migrate deploy
sudo -u pedidos npm run build
sudo systemctl start pedidos-comercial
```

O `.env` existente é preservado porque não faz parte do pacote.

## 13. Backup

Backup manual:

```bash
cd /opt/pedidos-comercial
sudo -u pedidos npm run db:backup
```

Cron diário às 02:00:

```bash
sudo crontab -e
```

Adicione:

```cron
0 2 * * * cd /opt/pedidos-comercial && sudo -u pedidos npm run db:backup >> /var/log/pedidos-backup.log 2>&1
```

## 14. Comandos úteis

```bash
sudo systemctl status pedidos-comercial
sudo systemctl restart pedidos-comercial
sudo journalctl -u pedidos-comercial -n 200
sudo journalctl -u pedidos-comercial -f
curl -I http://localhost:3001/login
```

## 15. Checklist final

- `.env` criado e com permissão `600`.
- `DATABASE_URL` apontando para PostgreSQL correto.
- `npx prisma migrate deploy` executado.
- `npm run build` concluído sem erro.
- Serviço `pedidos-comercial` ativo no `systemd`.
- Nginx apontando para `127.0.0.1:3001`.
- HTTPS ativo, se houver domínio público.
- Backup configurado.
