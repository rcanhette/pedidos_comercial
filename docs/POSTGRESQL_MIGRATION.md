# Migração PostgreSQL

Este documento registra a migração do SQLite para PostgreSQL.

## Estratégia

- Backup físico do SQLite antes da alteração.
- Exportação JSON por entidade.
- Baseline PostgreSQL gerada a partir do schema Prisma atual.
- Importação em ordem de dependências preservando IDs.
- Validação de contagens, IDs, relacionamentos, valores escalados, status e sequência.

## Arquivos

- SQLite original: `prisma/data/pedidos.db`
- Backups pré-migração: `backups/pre-postgresql-migration/`
- Migrations SQLite preservadas: `prisma/migrations-sqlite-backup/`
- Baseline PostgreSQL: `prisma/migrations/20260713154800_postgresql_baseline/`

## Comandos

```bash
npm run db:sqlite:backup
npm run db:sqlite:export
docker compose up -d postgres
npx prisma migrate deploy
npm run db:postgres:import
npm run db:migration:validate
```

## Resultado da primeira migração local

- User: 3
- Role: 3
- Permission: 27
- Product: 3
- Package: 3
- Currency: 2
- Order: 2
- OrderStatusHistory: 4
- AuditLog: 49
- Relacionamentos inválidos: 0
- Maior pedido: `PED-2026-000002`
- Sequência: `2026:2`
