# Deploy no Windows

## Requisitos

- Windows Server com Node.js LTS instalado.
- Acesso ao Prompt/PowerShell na pasta do sistema.
- Porta liberada, normalmente `3000`.

## Arquivos importantes

- `.env`: configuracoes do ambiente.
- `package.json` e `package-lock.json`: dependencias e comandos.
- `prisma/schema.prisma`: modelo do banco.
- `prisma/migrations/`: migracoes do banco.
- `prisma/data/pedidos.db`: banco SQLite atual.
- `src/`: codigo da aplicacao.
- `scripts/`: backup e restauracao do SQLite.

## Instalar no servidor

Na pasta onde os arquivos foram extraidos:

```powershell
npm ci
npm run db:generate
npm run build
npm run start
```

Depois acesse:

```text
http://localhost:3000
```

## Variaveis do `.env`

Confirme se o arquivo `.env` existe na raiz do projeto:

```env
DATABASE_URL="file:./data/pedidos.db"
SESSION_SECRET="troque-por-uma-chave-com-no-minimo-32-caracteres"
ADMIN_INITIAL_PASSWORD="DefinaUmaSenhaForte#123"
APP_TIMEZONE="America/Sao_Paulo"
NEXT_PUBLIC_APP_NAME="Pedidos Comerciais"
SESSION_COOKIE_SECURE="false"
```

O caminho `file:./data/pedidos.db` e resolvido pelo Prisma dentro da pasta `prisma`, portanto o arquivo real fica em:

```text
prisma/data/pedidos.db
```

## Rodar com PM2

Opcionalmente, para deixar o sistema rodando em segundo plano:

```powershell
npm install -g pm2
pm2 start npm --name pedidos-comercial -- run start
pm2 save
```

Para ver logs:

```powershell
pm2 logs pedidos-comercial
```

## Backup

Para gerar backup do banco:

```powershell
npm run db:backup
```

Os backups ficam na pasta `backups/`.
