# Coonagro Business Intelligence

Sistema web para cadastro, acompanhamento e aprovação de pedidos comerciais, com interface em português do Brasil, autenticação por sessão, controle de acesso por perfis/permissões e persistência em PostgreSQL via Prisma ORM.

## Arquitetura Atual

- Next.js App Router, React e TypeScript
- PostgreSQL 17 e Prisma ORM
- Tailwind CSS com componentes no padrão shadcn/ui
- Zod e Server Actions
- Sessão HTTP-only, login local, OAuth Google/Microsoft e código de dupla autenticação por e-mail
- ESLint, TypeScript e Vitest

## Configuração

Copie o exemplo e ajuste os segredos:

```bash
cp .env.example .env
```

Variáveis principais:

```env
SQLITE_DATABASE_URL="file:./data/pedidos.db"
DATABASE_URL="postgresql://sistema_pedidos:senha@localhost:5433/sistema_pedidos?schema=public"
TEST_DATABASE_URL="postgresql://sistema_pedidos:senha@localhost:5433/sistema_pedidos_test?schema=public"
POSTGRES_DB="sistema_pedidos"
POSTGRES_USER="sistema_pedidos"
POSTGRES_PASSWORD="substitua-por-uma-senha-segura"
SESSION_SECRET="troque-por-uma-chave-com-no-minimo-32-caracteres"
ADMIN_INITIAL_PASSWORD="DefinaUmaSenhaForte#123"
APP_TIMEZONE="America/Sao_Paulo"
SESSION_COOKIE_SECURE="true"
```

Em desenvolvimento local deste ambiente, o PostgreSQL do Docker usa `localhost:5433` porque a porta `5432` já está ocupada no host. Em produção, use a porta interna/rede adequada e não exponha PostgreSQL diretamente para a internet.

## Execução Local

```bash
npm install
docker compose up -d postgres
npx prisma migrate deploy
npm run dev -- -p 3001
```

Acesse `http://localhost:3001`.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
npm run db:sqlite:backup
npm run db:sqlite:export
npm run db:postgres:import
npm run db:migration:validate
npm run db:backup
npm run db:restore -- backups/postgresql/pedidos-YYYY-MM-DD-HHMMSS.dump
```

## Migração de SQLite para PostgreSQL

A migração preserva IDs, hashes de senha, permissões, pedidos, históricos, auditoria, sessões, desafios de login e a sequência anual de pedidos. Os valores financeiros continuam como inteiros escalados; não houve conversão para decimal.

Sequência recomendada:

```bash
# 1. Instalar dependências
npm install

# 2. Criar backup do SQLite
npm run db:sqlite:backup

# 3. Exportar os dados
npm run db:sqlite:export

# 4. Subir PostgreSQL
docker compose up -d postgres

# 5. Gerar Prisma Client
npx prisma generate

# 6. Aplicar migrations no PostgreSQL
npx prisma migrate deploy

# 7. Importar dados
npm run db:postgres:import

# 8. Validar migração
npm run db:migration:validate

# 9. Validar aplicação
npm test
npm run typecheck
npm run lint
npm run build
```

Arquivos gerados antes da migração ficam em `backups/pre-postgresql-migration/`. As migrations SQLite antigas foram preservadas em `prisma/migrations-sqlite-backup/`. A nova baseline PostgreSQL está em `prisma/migrations/20260713154800_postgresql_baseline/`.

## Backup e Restauração PostgreSQL

Backup:

```bash
npm run db:backup
```

Gera arquivos em `backups/postgresql/pedidos-YYYY-MM-DD-HHMMSS.dump` usando `pg_dump --format=custom`.

Restauração:

```bash
npm run db:restore -- backups/postgresql/pedidos-YYYY-MM-DD-HHMMSS.dump
```

Pare a aplicação antes de restaurar. O script cria um backup do estado atual antes de executar `pg_restore --clean --if-exists`.

## Rollback para SQLite

O SQLite original não deve ser apagado. Se a migração falhar:

1. pare a aplicação;
2. restaure o `.env` anterior com `DATABASE_URL="file:./data/pedidos.db"`;
3. restaure o backup físico em `backups/pre-postgresql-migration/`;
4. volte temporariamente as migrations SQLite preservadas em `prisma/migrations-sqlite-backup/`;
5. execute `npx prisma generate`;
6. não faça gravações simultâneas em SQLite e PostgreSQL;
7. não tente mesclar bancos divergentes sem processo controlado.

Após a migração definitiva, o SQLite deve permanecer apenas como backup histórico.

## Homologação

Antes de produção, execute a migração em ambiente separado usando cópia do SQLite e banco PostgreSQL separado. Valide login, permissões, criação/edição de pedido, alteração de status, relatórios, backup e restauração.

## Produção Linux

Guia completo para instalar e rodar como serviço systemd: [`docs/DEPLOY_LINUX_SYSTEMD.md`](docs/DEPLOY_LINUX_SYSTEMD.md).

- Use Docker Compose ou PostgreSQL gerenciado.
- Mantenha o volume `sistema_pedidos_postgres_data` persistente.
- Restrinja a porta PostgreSQL à aplicação ou rede autorizada.
- Não publique a porta 5432/5433 na internet.
- Use `SESSION_COOKIE_SECURE=true` com HTTPS.
- Execute `npx prisma migrate deploy` em deploys.
- Configure backup recorrente com `npm run db:backup` ou `pg_dump` via cron/systemd timer.
- Monitore espaço em disco, logs do PostgreSQL e logs da aplicação.
- Para serverless, use pool externo ou infraestrutura compatível com Prisma e PostgreSQL.

## Persistência e Escalas

Valores financeiros e quantidades usam inteiros escalados:

- dinheiro em centavos: `unitPriceCents`, `commissionUsdCents`, `freightCents`;
- quantidade em escala 1000: `quantityScaled`;
- cotação em escala 10000: `dollarRateScaled`.

As conversões ficam centralizadas em `src/lib/scalars.ts`.

## Prisma Studio

```bash
npm run db:studio
```

## Solução de Problemas

- `ECONNREFUSED`: confirme `docker compose ps` e `DATABASE_URL`.
- Falha de senha: confira `POSTGRES_PASSWORD` e recrie apenas ambiente local vazio se necessário.
- Importação recusa banco não vazio: use banco vazio ou defina `POSTGRES_IMPORT_TRUNCATE=true` conscientemente.
- SMTP Office 365: habilite SMTP AUTH na conta ou use senha de aplicativo.
