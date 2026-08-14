# Deploy em VPS HostGator: Next.js 15 + PostgreSQL + Nginx + systemd

Este guia assume:

- VPS Ubuntu Linux com acesso SSH inicial via `root`.
- Aplicacao Next.js 15 rodando internamente na porta `3000`.
- PostgreSQL instalado na propria VPS, acessivel apenas localmente.
- Nginx como proxy reverso.
- systemd mantendo a aplicacao ativa.
- Dominio na HostGator com subdominio, exemplo: `pedidos.meudominio.com.br`.
- Sem Docker e sem cPanel.

Use estes placeholders e substitua antes de executar:

- `IP_DA_VPS`: IP publico da VPS.
- `MEU_DOMINIO`: dominio principal, exemplo `meudominio.com.br`.
- `pedidos.MEU_DOMINIO`: subdominio final.
- `SENHA_FORTE_DO_BANCO`: senha forte do usuario PostgreSQL.
- `SEU_EMAIL`: e-mail usado no Let's Encrypt.

Observacao sobre versoes: o Next.js 15 exige Node.js `18.18.0` ou superior. Em producao, prefira uma versao LTS. Em julho de 2026, Node.js 24 esta em LTS e Node.js 26 ainda nao entrou em LTS. Este guia usa NodeSource `24.x`. Se sua VPS for instalada depois de outubro de 2026, confirme a LTS atual em `https://nodejs.org/en/about/previous-releases`.

Importante: mantenha uma segunda sessao SSH aberta enquanto altera SSH, firewall, Nginx ou PostgreSQL. So feche a sessao antiga depois de testar a nova.

---

## 1. Primeiro acesso via SSH

Execute no seu computador local:

```bash
ssh root@IP_DA_VPS
```

Comando executado como `root` na VPS: troque a senha do `root`, se necessario.

```bash
passwd
```

Atualize o Ubuntu:

```bash
apt update
apt upgrade -y
apt autoremove -y
```

Configure o fuso horario:

```bash
timedatectl set-timezone America/Sao_Paulo
timedatectl
date
```

Teste antes de continuar:

```bash
lsb_release -a
whoami
hostname -I
```

---

## 2. Criacao do usuario administrativo

Comandos executados como `root`:

```bash
adduser administrator
usermod -aG sudo administrator
```

Teste se o usuario esta no grupo `sudo`:

```bash
groups administrator
```

Abra outro terminal no seu computador local e teste o acesso:

```bash
ssh administrator@IP_DA_VPS
```

Dentro da VPS, como `administrator`, teste o `sudo`:

```bash
whoami
sudo whoami
```

Resultado esperado do segundo comando:

```text
root
```

Daqui em diante, use `administrator` no dia a dia. O usuario `root` deve ficar apenas para emergencia.

---

## 3. Seguranca do SSH

### 3.1. Criar chave SSH no computador local

No seu computador local, verifique se ja existe uma chave:

```bash
ls -la ~/.ssh
```

Se precisar criar uma nova:

```bash
ssh-keygen -t ed25519 -C "administrator@pedidos"
```

Use uma passphrase forte quando solicitado.

Copie a chave para a VPS:

```bash
ssh-copy-id administrator@IP_DA_VPS
```

Se `ssh-copy-id` nao estiver disponivel, use:

```bash
cat ~/.ssh/id_ed25519.pub | ssh administrator@IP_DA_VPS "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Teste a chave em uma nova sessao local:

```bash
ssh administrator@IP_DA_VPS
```

So continue se o login por chave funcionar.

### 3.2. Backup e validacao do sshd_config

Comandos executados como `administrator` na VPS:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)
sudo sshd -t
```

Edite com seguranca:

```bash
sudo nano /etc/ssh/sshd_config
```

Garanta estas linhas:

```text
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM yes
```

Nao altere a porta `22` neste momento.

Teste a configuracao antes de reiniciar o SSH:

```bash
sudo sshd -t
```

Se nao retornar erro, recarregue o servico:

```bash
sudo systemctl reload ssh
sudo systemctl status ssh
```

Teste em outro terminal local:

```bash
ssh administrator@IP_DA_VPS
```

Teste tambem que o `root` nao entra mais:

```bash
ssh root@IP_DA_VPS
```

Resultado esperado: acesso negado para `root`. Nao feche a sessao antiga ate confirmar que `administrator` entra por chave.

---

## 4. Firewall UFW

Comandos executados como `administrator`:

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Consulte o status:

```bash
sudo ufw status verbose
sudo ufw status numbered
```

Teste em outro terminal:

```bash
ssh administrator@IP_DA_VPS
```

Portas esperadas externamente: `22`, `80`, `443`.

---

## 5. Instalacao dos pacotes basicos

Comandos executados como `administrator`:

```bash
sudo apt update
sudo apt install -y curl git unzip tar nano nginx postgresql postgresql-client ca-certificates gnupg
```

Instale Node.js LTS via NodeSource. Para Next.js 15, Node 24 LTS e adequado em julho de 2026:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

Verifique versoes:

```bash
node -v
npm -v
psql --version
nginx -v
```

Teste servicos:

```bash
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## 6. Configuracao do PostgreSQL

O PostgreSQL deve aceitar conexao apenas localmente. Antes de alterar configuracoes, crie backups:

```bash
sudo cp /etc/postgresql/*/main/postgresql.conf /tmp/postgresql.conf.bak.$(date +%Y%m%d%H%M%S)
sudo cp /etc/postgresql/*/main/pg_hba.conf /tmp/pg_hba.conf.bak.$(date +%Y%m%d%H%M%S)
```

Confirme que `listen_addresses` esta local. Abra:

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

Use:

```text
listen_addresses = 'localhost'
port = 5432
```

Abra:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Garanta regras locais como estas:

```text
local   all             postgres                                peer
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

Recarregue:

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

Crie o banco e usuario. Entre no `psql` como postgres:

```bash
sudo -u postgres psql
```

SQL completo. Se o usuario nao existir, crie:

```sql
CREATE USER pedidos_user WITH PASSWORD 'SENHA_FORTE_DO_BANCO';
```

Se o usuario ja existir, redefina a senha:

```sql
ALTER USER pedidos_user WITH PASSWORD 'SENHA_FORTE_DO_BANCO';
```

Crie o banco se ainda nao existir. O PostgreSQL nao possui `CREATE DATABASE IF NOT EXISTS`; primeiro liste:

```sql
\l
```

Se `comercial_pedidos` nao aparecer:

```sql
CREATE DATABASE comercial_pedidos OWNER pedidos_user;
```

Conceda permissoes:

```sql
\c comercial_pedidos
GRANT CONNECT ON DATABASE comercial_pedidos TO pedidos_user;
GRANT USAGE, CREATE ON SCHEMA public TO pedidos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pedidos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pedidos_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO pedidos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pedidos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pedidos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO pedidos_user;
ALTER DATABASE comercial_pedidos OWNER TO pedidos_user;
\q
```

Teste conexao local:

```bash
PGPASSWORD='SENHA_FORTE_DO_BANCO' psql -h 127.0.0.1 -p 5432 -U pedidos_user -d comercial_pedidos -c "SELECT current_database(), current_user;"
```

Confirme que a porta `5432` nao esta exposta publicamente:

```bash
sudo ss -tulpn | grep 5432
sudo ufw status verbose
```

Resultado esperado no `ss`: PostgreSQL ouvindo em `127.0.0.1:5432` e/ou `[::1]:5432`, nao em `0.0.0.0:5432`.

Do seu computador local, este teste deve falhar:

```bash
psql -h IP_DA_VPS -p 5432 -U pedidos_user -d comercial_pedidos
```

---

## 7. Estrutura de diretorios

Comandos executados como `administrator`:

```bash
sudo mkdir -p /home/administrator/pedidos_comercial
sudo chown -R administrator:administrator /home/administrator/pedidos_comercial
chmod 750 /home/administrator/pedidos_comercial
cd /home/administrator/pedidos_comercial
pwd
```

---

## 8. Envio da aplicacao para a VPS

### Opcao 1: enviar `.tar.gz` por SCP

No seu computador local, dentro da pasta do projeto, gere o pacote sem `node_modules`, `.next` e `.env`:

```bash
tar --exclude='./node_modules' --exclude='./.next' --exclude='./.env' -czf pedidos-comercial.tar.gz .
```

Envie para a VPS:

```bash
scp pedidos-comercial.tar.gz administrator@IP_DA_VPS:/home/administrator/
```

Na VPS, como `administrator`, extraia dentro da pasta correta:

```bash
cd /home/administrator/pedidos_comercial
tar -xzf /home/administrator/pedidos-comercial.tar.gz -C /home/administrator/pedidos_comercial
ls -la
```

Confira que `package.json` ficou dentro de `/home/administrator/pedidos_comercial`, nao solto em `/home/administrator`.

### Opcao 2: clonar via Git

Na VPS, como `administrator`:

```bash
cd /home/administrator
git clone URL_DO_REPOSITORIO pedidos_comercial
cd /home/administrator/pedidos_comercial
git status
```

Se o repositorio for privado, configure chave SSH ou token de acesso antes do `git clone`.

---

## 9. Configuracao do `.env`

Na VPS, como `administrator`:

```bash
cd /home/administrator/pedidos_comercial
nano .env
```

Exemplo seguro:

```env
DATABASE_URL="postgresql://pedidos_user:SENHA_FORTE_DO_BANCO@127.0.0.1:5432/comercial_pedidos?schema=public"
NODE_ENV="production"
PORT="3000"

SESSION_SECRET="TROQUE_POR_UMA_CHAVE_COM_NO_MINIMO_32_CARACTERES"
ADMIN_INITIAL_PASSWORD="TROQUE_POR_UMA_SENHA_ADMIN_FORTE"
APP_TIMEZONE="America/Sao_Paulo"
NEXT_PUBLIC_APP_NAME="Pedidos Comerciais"
AUTH_BASE_URL="https://pedidos.MEU_DOMINIO"
SESSION_COOKIE_SECURE="true"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
MICROSOFT_CLIENT_ID=""
MICROSOFT_CLIENT_SECRET=""
MICROSOFT_TENANT_ID="common"

SMTP_HOST="smtp.seu-provedor.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_STARTTLS="true"
SMTP_USER="usuario-smtp"
SMTP_PASSWORD="senha-smtp"
SMTP_FROM="Pedidos Comerciais <no-reply@MEU_DOMINIO>"
SMTP_HELO="MEU_DOMINIO"

EMAIL_VALIDATION_SMTP="false"
EMAIL_VALIDATION_SMTP_TIMEOUT_MS="5000"
EMAIL_VALIDATION_FROM="postmaster@MEU_DOMINIO"
```

Este projeto possui `.env.example` com variaveis de sessao, OAuth e SMTP. Copie do ambiente atual apenas o que a aplicacao realmente usa. Nunca coloque senhas reais em documentacao, Git ou tickets.

Proteja o arquivo:

```bash
chmod 600 .env
ls -la .env
```

---

## 10. Instalacao e compilacao da aplicacao

Na VPS, como `administrator`:

```bash
cd /home/administrator/pedidos_comercial
```

Como existe `package-lock.json`, prefira:

```bash
npm ci
```

Se nao existir `package-lock.json`, use:

```bash
npm install
```

Compile:

```bash
npm run build
```

Neste projeto, o script `build` executa `prisma generate && next build`.

Erros comuns:

- Dependencia: execute `npm ci` novamente e confira mensagens de pacote nativo.
- Node.js: confirme `node -v`; para Next.js 15, precisa ser `18.18.0` ou superior.
- Variaveis: confirme `.env`, especialmente `DATABASE_URL`, `SESSION_SECRET`, `AUTH_BASE_URL` e SMTP/OAuth se usados.
- Banco: teste `psql` com `127.0.0.1:5432`.

Teste manual:

```bash
npm run start
```

Em outro terminal SSH, teste:

```bash
curl -I http://127.0.0.1:3000
curl http://127.0.0.1:3000
```

Pare o teste manual com `Ctrl+C` no terminal onde o `npm run start` esta rodando.

---

## 11. Migracao ou criacao das tabelas

Este projeto usa Prisma, confirmado por `prisma/schema.prisma`, `@prisma/client` e scripts no `package.json`.

Antes de migrar, valide:

```bash
cd /home/administrator/pedidos_comercial
npx prisma validate
npx prisma generate
```

Em producao, use migracoes ja versionadas:

```bash
npx prisma migrate deploy
```

Ou pelo script do projeto:

```bash
npm run db:deploy
```

Nao use `prisma migrate dev` em producao. Ele e para desenvolvimento.

Se o projeto tiver seed inicial e voce souber que precisa executar:

```bash
npm run db:seed
```

So rode seed depois de entender se ele cria dados iniciais ou altera dados existentes.

Teste as tabelas:

```bash
PGPASSWORD='SENHA_FORTE_DO_BANCO' psql -h 127.0.0.1 -U pedidos_user -d comercial_pedidos -c "\dt"
```

---

## 12. Servico systemd

Confirme caminhos reais:

```bash
which node
which npm
```

Normalmente o NodeSource instala em `/usr/bin/node` e `/usr/bin/npm`.

Crie o servico:

```bash
sudo nano /etc/systemd/system/pedidos-comercial.service
```

Conteudo completo:

```ini
[Unit]
Description=Sistema Pedidos Comercial - Next.js
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=administrator
Group=administrator
WorkingDirectory=/home/administrator/pedidos_comercial
EnvironmentFile=/home/administrator/pedidos_comercial/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

Se `which npm` mostrar outro caminho, ajuste `ExecStart`.

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pedidos-comercial
sudo systemctl start pedidos-comercial
sudo systemctl status pedidos-comercial
```

Logs:

```bash
journalctl -u pedidos-comercial -f
```

Teste local:

```bash
curl -I http://127.0.0.1:3000
```

---

## 13. Configuracao do Nginx

Antes de alterar, faca backup:

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%Y%m%d%H%M%S)
sudo mkdir -p /root/nginx-sites-backup
sudo cp -a /etc/nginx/sites-available /root/nginx-sites-backup/sites-available.$(date +%Y%m%d%H%M%S)
sudo cp -a /etc/nginx/sites-enabled /root/nginx-sites-backup/sites-enabled.$(date +%Y%m%d%H%M%S)
```

Crie a configuracao:

```bash
sudo nano /etc/nginx/sites-available/pedidos-comercial
```

Conteudo completo antes do HTTPS:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name pedidos.MEU_DOMINIO;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Ative o site:

```bash
sudo ln -s /etc/nginx/sites-available/pedidos-comercial /etc/nginx/sites-enabled/pedidos-comercial
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
```

Teste localmente na VPS simulando o host:

```bash
curl -I -H "Host: pedidos.MEU_DOMINIO" http://127.0.0.1
```

---

## 14. Configuracao do DNS na HostGator

No painel DNS da HostGator, crie um registro:

```text
Tipo: A
Nome: pedidos
Destino: IP_DA_VPS
TTL: padrao ou 300, se disponivel
```

Resultado esperado:

```text
pedidos.MEU_DOMINIO -> IP_DA_VPS
```

Aguarde a propagacao. Teste do seu computador local:

```bash
nslookup pedidos.MEU_DOMINIO
```

Ou:

```bash
dig pedidos.MEU_DOMINIO
```

Teste HTTP quando o DNS apontar certo:

```bash
curl -I http://pedidos.MEU_DOMINIO
```

---

## 15. Certificado HTTPS com Let's Encrypt

Comandos executados como `administrator`:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

Emita o certificado e permita redirecionamento HTTP para HTTPS quando perguntado:

```bash
sudo certbot --nginx -d pedidos.MEU_DOMINIO --email SEU_EMAIL --agree-tos --no-eff-email
```

Teste:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://pedidos.MEU_DOMINIO
```

Teste renovacao automatica:

```bash
sudo certbot renew --dry-run
```

Veja certificados:

```bash
sudo certbot certificates
```

---

## 16. Backup automatico do PostgreSQL

Crie diretorios:

```bash
mkdir -p /home/administrator/backups/postgresql
mkdir -p /home/administrator/scripts
chmod 700 /home/administrator/backups
chmod 700 /home/administrator/scripts
```

Configure `.pgpass` para evitar senha no script:

```bash
nano /home/administrator/.pgpass
```

Conteudo:

```text
127.0.0.1:5432:comercial_pedidos:pedidos_user:SENHA_FORTE_DO_BANCO
```

Proteja:

```bash
chmod 600 /home/administrator/.pgpass
```

Crie o script:

```bash
nano /home/administrator/scripts/backup_postgresql.sh
```

Conteudo completo:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/home/administrator/backups/postgresql"
DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_NAME="comercial_pedidos"
DB_USER="pedidos_user"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  -f "$BACKUP_FILE"

gzip "$BACKUP_FILE"

find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.dump.gz" -mtime +30 -delete
```

Proteja e teste:

```bash
chmod 700 /home/administrator/scripts/backup_postgresql.sh
/home/administrator/scripts/backup_postgresql.sh
ls -lh /home/administrator/backups/postgresql
```

Agende no cron do usuario `administrator`:

```bash
crontab -e
```

Adicione:

```cron
0 2 * * * /home/administrator/scripts/backup_postgresql.sh >> /home/administrator/backups/postgresql/backup.log 2>&1
```

Confira:

```bash
crontab -l
```

Restaurar backup exige cuidado porque pode sobrescrever dados. Antes de restaurar, confirme que voce quer substituir o estado atual. Exemplo para restaurar em um banco novo de teste:

```bash
createdb -h 127.0.0.1 -U pedidos_user comercial_pedidos_restore_test
gunzip -c /home/administrator/backups/postgresql/ARQUIVO.dump.gz > /tmp/restore.dump
pg_restore -h 127.0.0.1 -U pedidos_user -d comercial_pedidos_restore_test --clean --if-exists /tmp/restore.dump
```

Para restaurar no banco real, pare a aplicacao antes e faca backup atual primeiro:

```bash
sudo systemctl stop pedidos-comercial
/home/administrator/scripts/backup_postgresql.sh
```

So depois execute restauracao no banco real, se confirmado.

---

## 17. Backup dos arquivos enviados pelo sistema

Nao assuma o caminho. Na VPS, dentro do projeto:

```bash
cd /home/administrator/pedidos_comercial
find . -maxdepth 4 -type d \( -name uploads -o -name storage \) -print
```

Tambem procure referencias no codigo:

```bash
rg -n "uploads|public/uploads|storage|multer|writeFile|createWriteStream" .
```

No estado local deste projeto, nao foi encontrada pasta `uploads` ou `storage` em ate 3 niveis. Se voce criar ou identificar uma pasta, por exemplo `/home/administrator/pedidos_comercial/public/uploads`, adicione backup diario:

```bash
mkdir -p /home/administrator/backups/uploads
nano /home/administrator/scripts/backup_uploads.sh
```

Conteudo exemplo, ajuste `UPLOAD_DIR` somente depois de confirmar o caminho real:

```bash
#!/usr/bin/env bash
set -euo pipefail

UPLOAD_DIR="/home/administrator/pedidos_comercial/public/uploads"
BACKUP_DIR="/home/administrator/backups/uploads"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

if [ ! -d "$UPLOAD_DIR" ]; then
  echo "Diretorio de uploads nao encontrado: $UPLOAD_DIR"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
tar -czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "$UPLOAD_DIR" .
find "$BACKUP_DIR" -type f -name "uploads_*.tar.gz" -mtime +30 -delete
```

Ative:

```bash
chmod 700 /home/administrator/scripts/backup_uploads.sh
crontab -e
```

Adicione:

```cron
15 2 * * * /home/administrator/scripts/backup_uploads.sh >> /home/administrator/backups/uploads/backup.log 2>&1
```

---

## 18. Monitoramento e diagnostico

Instale ferramentas uteis:

```bash
sudo apt install -y htop
```

CPU e processos:

```bash
htop
top
```

Memoria:

```bash
free -h
```

Disco:

```bash
df -h
du -sh /home/administrator/pedidos_comercial
du -sh /home/administrator/backups
```

Servicos:

```bash
systemctl status pedidos-comercial
systemctl status nginx
systemctl status postgresql
```

Logs da aplicacao:

```bash
journalctl -u pedidos-comercial -f
journalctl -u pedidos-comercial --since "1 hour ago"
```

Logs do Nginx:

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Logs do PostgreSQL:

```bash
sudo journalctl -u postgresql -f
sudo ls -lh /var/log/postgresql/
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

Portas abertas:

```bash
sudo ss -tulpn
sudo ufw status verbose
```

Teste externo esperado:

```bash
curl -I https://pedidos.MEU_DOMINIO
```

---

## 19. Atualizacao futura da aplicacao

Procedimento seguro com pasta de versoes.

Crie estrutura:

```bash
mkdir -p /home/administrator/releases
mkdir -p /home/administrator/releases/backups_app
```

Antes de atualizar, faca backup do banco:

```bash
/home/administrator/scripts/backup_postgresql.sh
```

Backup da versao atual da aplicacao, sem `node_modules` e `.next`:

```bash
cd /home/administrator
tar --exclude='pedidos_comercial/node_modules' --exclude='pedidos_comercial/.next' -czf /home/administrator/releases/backups_app/pedidos_comercial_$(date +%Y%m%d_%H%M%S).tar.gz pedidos_comercial
```

Preserve o `.env`:

```bash
cp /home/administrator/pedidos_comercial/.env /home/administrator/releases/.env.backup.$(date +%Y%m%d_%H%M%S)
chmod 600 /home/administrator/releases/.env.backup.*
```

Se usa Git:

```bash
cd /home/administrator/pedidos_comercial
git status
git pull
```

Se usa `.tar.gz`, envie a nova versao para `/home/administrator/` e extraia com cuidado:

```bash
mkdir -p /home/administrator/releases/nova-versao
tar -xzf /home/administrator/pedidos-comercial-nova-versao.tar.gz -C /home/administrator/releases/nova-versao
rsync -av --delete --exclude='.env' --exclude='node_modules' --exclude='.next' /home/administrator/releases/nova-versao/ /home/administrator/pedidos_comercial/
```

Instale, migre e compile:

```bash
cd /home/administrator/pedidos_comercial
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run build
```

Reinicie e verifique:

```bash
sudo systemctl restart pedidos-comercial
sudo systemctl status pedidos-comercial
journalctl -u pedidos-comercial --since "10 minutes ago"
curl -I http://127.0.0.1:3000
curl -I https://pedidos.MEU_DOMINIO
```

Voltar para a versao anterior, se necessario, exige confirmar o arquivo correto. Nao apague nada. Exemplo:

```bash
sudo systemctl stop pedidos-comercial
mkdir -p /home/administrator/rollback_tmp
tar -xzf /home/administrator/releases/backups_app/ARQUIVO_DA_VERSAO_ANTERIOR.tar.gz -C /home/administrator/rollback_tmp
rsync -av --delete --exclude='.env' /home/administrator/rollback_tmp/pedidos_comercial/ /home/administrator/pedidos_comercial/
cd /home/administrator/pedidos_comercial
npm ci
npm run build
sudo systemctl start pedidos-comercial
sudo systemctl status pedidos-comercial
```

Rollback de banco e mais sensivel: so restaure backup do PostgreSQL depois de confirmar que a migracao precisa ser revertida e que a perda de dados posteriores ao backup e aceitavel.

---

## 20. Checklist final

Execute ou confirme:

```bash
ssh administrator@IP_DA_VPS
```

- [ ] SSH funcionando com usuario `administrator`.
- [ ] Login SSH do `root` desabilitado.
- [ ] Autenticacao por senha desabilitada somente depois de testar chave SSH.
- [ ] Firewall ativo com apenas `OpenSSH`, `80/tcp` e `443/tcp`.
- [ ] PostgreSQL funcionando localmente em `127.0.0.1:5432`.
- [ ] Porta `5432` nao exposta em `0.0.0.0` e bloqueada externamente.
- [ ] Banco `comercial_pedidos` criado.
- [ ] Usuario `pedidos_user` com permissoes no banco e schema `public`.
- [ ] `.env` criado com `DATABASE_URL`, `NODE_ENV`, `PORT` e variaveis reais da aplicacao.
- [ ] `.env` protegido com `chmod 600`.
- [ ] Dependencias instaladas com `npm ci`.
- [ ] Prisma validado e migracoes aplicadas com `npx prisma migrate deploy`.
- [ ] Aplicacao compilada com `npm run build`.
- [ ] Servico `pedidos-comercial` ativo no systemd.
- [ ] Nginx encaminhando para `http://127.0.0.1:3000`.
- [ ] DNS `A` de `pedidos.MEU_DOMINIO` apontando para `IP_DA_VPS`.
- [ ] HTTPS valido com Let's Encrypt.
- [ ] Renovacao testada com `sudo certbot renew --dry-run`.
- [ ] Backup automatico do PostgreSQL funcionando.
- [ ] Uploads/arquivos de usuario verificados e incluidos no backup se existirem.
- [ ] Logs do systemd, Nginx e PostgreSQL verificados.
- [ ] Aplicacao acessivel em `https://pedidos.MEU_DOMINIO`.

Comandos finais de verificacao:

```bash
sudo ufw status verbose
sudo ss -tulpn
systemctl status pedidos-comercial
systemctl status nginx
systemctl status postgresql
curl -I https://pedidos.MEU_DOMINIO
```

