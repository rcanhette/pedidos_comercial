# Deploy HostGator VPS com Docker

Este fluxo sobe tudo em containers:

- `postgres`: banco PostgreSQL com volume persistente.
- `app`: Next.js em produção, executando `prisma migrate deploy` e `prisma db seed` antes do start.
- `caddy`: proxy reverso com HTTPS automático.

Nao instale PostgreSQL, Node.js, PM2 ou Nginx no host para este modelo. O host precisa apenas de Docker, plugin Compose e portas `80`/`443` liberadas.

O banco, usuario e senha sao criados automaticamente pelo container `postgres` no primeiro start, usando `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` do `.env.production`. Nao precisa entrar no `psql` nem criar banco manualmente.

## 1. DNS

No painel DNS do dominio, crie um registro `A` apontando o subdominio para o IP publico da VPS:

```text
pedidos.seu-dominio.com.br -> IP_DA_VPS
```

Aguarde a propagacao antes de iniciar o Caddy, porque ele precisa validar o dominio para emitir o certificado HTTPS.

## 2. Instalar Docker

Na VPS:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker administrator
```

Saia e entre novamente no SSH para o grupo `docker` valer. Depois valide:

```bash
docker --version
docker compose version
```

## 3. Enviar Projeto

Coloque o projeto em:

```bash
/home/administrator/pedidos_comercial
```

Se estiver enviando pacote `.tar.gz`:

```bash
mkdir -p /home/administrator/pedidos_comercial
tar -xzf pedidos-comercial.tar.gz -C /home/administrator/pedidos_comercial
cd /home/administrator/pedidos_comercial
```

## 4. Configurar Ambiente

Crie o arquivo real a partir do exemplo:

```bash
cp .env.production.example .env.production
nano .env.production
```

Campos obrigatorios:

```env
APP_DOMAIN="pedidos.seu-dominio.com.br"

POSTGRES_DB="comercial_pedidos"
POSTGRES_USER="pedidos_user"
POSTGRES_PASSWORD="SENHA_FORTE_DO_BANCO"
DATABASE_URL="postgresql://pedidos_user:SENHA_FORTE_DO_BANCO@postgres:5432/comercial_pedidos?schema=public"

AUTH_BASE_URL="https://pedidos.seu-dominio.com.br"
SESSION_SECRET="CHAVE_COM_NO_MINIMO_32_CARACTERES"
ADMIN_INITIAL_PASSWORD="SENHA_ADMIN_INICIAL_FORTE"
SESSION_COOKIE_SECURE="true"
NEXT_PUBLIC_APP_NAME="Coonagro Business Intelligence"
```

Dentro do Docker, o host do banco e `postgres`, nao `localhost`.

Se a senha tiver caracteres especiais, codifique na `DATABASE_URL`. Exemplo: `@` vira `%40`.

Importante: essas variaveis so criam o banco no primeiro start, quando o volume `pedidos_comercial_postgres_data` ainda esta vazio. Depois que o volume existe, trocar `POSTGRES_DB`, `POSTGRES_USER` ou `POSTGRES_PASSWORD` nao recria o banco automaticamente.

## 5. Subir Containers

```bash
cd /home/administrator/pedidos_comercial
docker compose -f docker-compose.prod.yml up -d --build
```

Verifique:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

Teste localmente na VPS:

```bash
curl -I http://127.0.0.1
curl -I https://pedidos.seu-dominio.com.br
```

## 6. Migracoes

O container `app` executa automaticamente:

```bash
npx prisma migrate deploy
npx prisma db seed
```

antes de iniciar o Next.js.

Para rodar manualmente:

```bash
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec app npx prisma db seed
```

## 7. Atualizar Versao

Depois de enviar novos arquivos:

```bash
cd /home/administrator/pedidos_comercial
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

## 8. Backup do Banco

Crie a pasta:

```bash
mkdir -p /home/administrator/backups/postgresql
```

Backup manual:

```bash
docker compose -f /home/administrator/pedidos_comercial/docker-compose.prod.yml exec -T postgres pg_dump \
  -U pedidos_user \
  -d comercial_pedidos \
  --format=custom \
  --file=/tmp/pedidos.dump

docker cp pedidos-comercial-postgres:/tmp/pedidos.dump /home/administrator/backups/postgresql/pedidos-$(date +%Y%m%d-%H%M%S).dump
```

## 9. Restore

Copie o dump para dentro do container:

```bash
docker cp /home/administrator/backups/postgresql/ARQUIVO.dump pedidos-comercial-postgres:/tmp/restore.dump
```

Restaure:

```bash
docker compose -f /home/administrator/pedidos_comercial/docker-compose.prod.yml exec postgres pg_restore \
  -U pedidos_user \
  -d comercial_pedidos \
  --clean \
  --if-exists \
  /tmp/restore.dump
```

## 10. Comandos Uteis

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart app
docker compose -f docker-compose.prod.yml down
docker volume ls
```

Nao use `docker compose down -v` em producao, porque isso remove o volume do banco.
