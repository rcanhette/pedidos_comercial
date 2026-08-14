# Changelog de Desenvolvimento

## 2026-07-17 12:35:13 -03

### Resumo

- Implementado Relatorio operacional em `/reports`, com filtros backend, paginacao, ordenacao e exportacoes Excel/PDF.
- Ajustada a tela de Relatorio para substituir a antiga pagina agregada de cards e manter `/reports/sales` redirecionando para `/reports`.
- Implementado Painel de Vendas em `/dashboard/sales` com abas `Visao Executiva`, `Share por Cliente` e `Configuracao de Metas`.
- Criado cadastro de metas mensais em toneladas com model `SalesTarget` e permissao `META_VENDAS_GERENCIAR`.
- Implementado grafico Boca do Jacare, grafico mensal, tabela mensal, Treemap de Share por Cliente, ranking e indicadores de concentracao.
- Corrigido erro client-side da tela Novo Pedido em acesso por IP/HTTP adicionando fallback para `crypto.randomUUID()`.
- Preparados pacotes `release/deploy-update/pedidos-comercial-update-2026-07-17.tar.gz` e `release/hotfix-new-order/hotfix-new-order-client-exception-2026-07-17.tar.gz`.

### Arquivos Alterados

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/20260717015316_add_monthly_sales_targets/migration.sql`
- `prisma/migrations/20260717020200_add_sales_dashboard_permissions/migration.sql`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/reports/sales/page.tsx`
- `src/app/api/reports/sales/excel/route.ts`
- `src/app/api/reports/sales/pdf/route.ts`
- `src/app/(app)/dashboard/sales/page.tsx`
- `src/app/(app)/dashboard/sales/actions.ts`
- `src/components/ui/tabs.tsx`
- `src/features/reports/sales-report.tsx`
- `src/features/sales-dashboard/sales-dashboard-panel.tsx`
- `src/features/orders/order-form.tsx`
- `src/lib/permissions.ts`
- `src/lib/sales-report.ts`
- `src/lib/sales-dashboard.ts`
- `src/server/sales-report-service.ts`
- `src/server/sales-dashboard-service.ts`
- `src/validations/sales-report.ts`
- `src/validations/sales-dashboard.ts`
- `tests/sales-report.test.ts`
- `tests/sales-dashboard.test.ts`
- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Impactos no Sistema

- Relatorio de pedidos passa a ser a tela principal de `/reports` e exporta dados filtrados completos, respeitando permissoes.
- Painel de Vendas passa a permitir acompanhamento gerencial por metas e vendas realizadas em toneladas.
- Metas mensais sao volumes em toneladas, nao valores financeiros.
- Share por Cliente usa pedidos reais, Previsao de Retirada como mes da venda e os mesmos status validos do Painel.
- Configuracao de Metas fica isolada em aba propria e protegida por `META_VENDAS_GERENCIAR`.
- Novo Pedido deixa de depender exclusivamente de `crypto.randomUUID()` no navegador, evitando excecao client-side em acesso por IP/HTTP.
- Deploy exige aplicar migrations novas e instalar dependencias novas (`exceljs`, `pdfkit`, `recharts`, `@radix-ui/react-tabs`).

### Testes Realizados ou Pendentes

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate dev --name add_monthly_sales_targets`: passou localmente.
- `npx prisma migrate dev` aplicou `20260717020200_add_sales_dashboard_permissions`: passou localmente.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run test`: passou com 29 testes.
- `npm run build`: passou.
- Pendente teste manual completo em producao/homologacao apos copiar pacote, aplicar `npx prisma migrate deploy`, build e restart.
- Pendente conferir no navegador a tela Novo Pedido apos aplicar o hotfix no servidor.

---

# Atualizacao da Sessao - 2026-07-16 - Perfis de Acesso

## Implementado

- Perfis finais configurados: `Administrator`, `Gestor`, `Analista` e `Representante Externo`.
- Migration segura renomeia/mescla `Administrador` para `Administrator` e `Representante` para `Representante Externo`, preservando usuários e vínculos.
- Seed idempotente atualiza permissões e perfis sem recriar usuários nem redefinir senhas.
- `Administrator` recebe todas as permissões registradas.
- `Gestor` recebe acesso operacional amplo e gestão de usuários, sem `PERMISSAO_CONFIGURAR`.
- `Analista` recebe acesso operacional completo a pedidos/cadastros/relatórios, sem usuários/perfis/auditoria administrativa.
- `Representante Externo` recebe acesso a novo pedido, próprios pedidos, criação/visualização de clientes e produtos, sem cadastros administrativos auxiliares.
- Backend bloqueia Gestor de atribuir, editar, inativar ou redefinir senha de usuário `Administrator` usando a permissão estrutural `PERMISSAO_CONFIGURAR`.
- Backend bloqueia edição de pedido próprio do Representante Externo fora de `RECEBIDO`.
- Backend exige `PEDIDO_APROVAR` para alteração de status para `APROVADO`.
- Tela de usuários filtra `Administrator` para quem não pode configurar permissões.

## Migration

- Criada e aplicada `20260716153000_update_access_profiles`.

## Validacoes

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma migrate dev --name update_access_profiles`: passou.
- `npx prisma db seed`: passou.
- `npm run test`: passou com 14 testes.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.

---

# Atualizacao da Sessao - 2026-07-16 - Preco MP e Status

## Implementado

- Adicionado `priceCents` opcional em `OrderRawMaterial` para armazenar o preço da matéria-prima no pedido usando centavos.
- Lista Técnica de Fechamento passou a ter coluna `Preço` no novo pedido, edição e detalhe/impressão do pedido.
- Preço é obrigatório para novos salvamentos e novas edições, aceita decimal brasileiro e não permite valores negativos.
- Status ativos de pedido atualizados para Recebido, Aprovado, Em Criação, Pedido Criado, Enviado para Assinatura e Cancelado.
- `RECUSADO` permanece apenas como valor legado para exibição/histórico, sem aparecer em novos fluxos de alteração.
- Pedido SAP passou a ser bloqueado em Recebido, Aprovado e Em Criação; obrigatório em Pedido Criado e Enviado para Assinatura; preservado ao cancelar.
- Dashboard, badge, relatório de status e formulário de alteração de status foram ajustados.

## Migration

- Criada e aplicada `20260716143000_add_raw_material_price_and_order_statuses`.
- Itens antigos de matéria-prima foram preservados com `priceCents` nulo; não foi preenchido preço fictício.

## Validacoes

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma migrate dev --name add_raw_material_price_and_order_statuses`: passou.
- `npm run test`: passou com 13 testes.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.

---

# Atualizacao da Sessao - 2026-07-16

## Implementado

- Criados cadastros de Tipos de Contrato, Fechamentos de MP e Matérias-Primas com permissões próprias, listagem, criação, edição, ativação/inativação e exclusão lógica quando vinculados.
- Produto deixou de possuir Código no schema, formulários, listagens, seed e fluxo de pedido. Relações continuam por `productId` e snapshot por nome/unidade.
- Pedido passou a exigir Tipo de Contrato, Fechamento de MP e Previsão de Retirada por mês/ano para novos salvamentos.
- Previsão de Retirada continua armazenada em `pickupForecast` como data PostgreSQL usando o dia 01 apenas como detalhe técnico; interfaces exibem `MM/yyyy`.
- Adicionada Lista Técnica de Fechamento com matérias-primas, KG informado, TONS calculado por `(KG / 1000) x quantidade do pedido`, totais e cadastro rápido de matéria-prima com permissão.
- Backend recalcula KG/TONS com inteiros escalados e grava itens em transação junto com o pedido.
- Detalhe do pedido, tabela de pedidos e relatórios existentes foram atualizados para os novos campos e consumo por matéria-prima.

## Migration

- Criada e aplicada `20260716120000_add_contract_closing_and_raw_materials`.
- Pedidos existentes foram preservados; novos campos ficam opcionais no banco para histórico legado, mas obrigatórios nas validações de novos salvamentos.
- Datas existentes de `pickupForecast` foram normalizadas para o primeiro dia do mês, preservando mês e ano.
- Colunas `Product.code` e `Order.productCodeSnapshot` foram removidas.

## Validações

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate dev --name add_contract_closing_and_raw_materials`: passou.
- `npm run db:seed`: passou.
- `npm run test`: passou com 12 testes.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.

---

---

## 2026-07-15 11:46:40 -03

### Resumo

- Adicionadas opcoes `Novo cliente` e `Novo produto` na tela de novo pedido.
- O formulario passa a exibir campos inline para cadastrar cliente/produto durante a criacao do pedido.
- O backend cria ou reativa/atualiza cliente por CNPJ e produto por codigo dentro da transacao do pedido.
- Adicionados testes para as validacoes condicionais dos novos campos inline.

### Arquivos Alterados

- `src/validations/order.ts`
- `src/server/order-service.ts`
- `src/features/orders/order-form.tsx`
- `tests/validation.test.ts`
- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Testes Realizados ou Pendentes

- Executado ESLint focado nos arquivos alterados: passou.
- Executado `npm test`: passou com 8 testes.
- Executado `npx prisma validate`: passou.
- Verificada resposta de `/orders/new` no servidor local.
- Pendente teste manual completo no navegador.

## 2026-07-15 11:33:12 -03

### Resumo

- Criado cadastro de clientes em `/customers` com cliente, cidade, CNPJ e ativo/inativo.
- Novo pedido passou a selecionar cliente cadastrado.
- Pedido passou a guardar `customerId` opcional e snapshots de nome/cidade/CNPJ.
- Criadas e aplicadas migrations PostgreSQL para clientes e backfill de pedidos existentes.
- Adicionadas permissoes `CLIENTE_*` e atualizado seed.
- Servidor reiniciado em `http://localhost:3001`.

### Arquivos Alterados

- `prisma/schema.prisma`
- `prisma/migrations/20260715110000_add_customers/migration.sql`
- `prisma/migrations/20260715111500_backfill_customers_from_orders/migration.sql`
- `src/app/actions.ts`
- `src/app/(app)/customers/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/orders/new/page.tsx`
- `src/app/(app)/orders/[id]/edit/page.tsx`
- `src/features/admin/catalog-forms.tsx`
- `src/features/orders/order-form.tsx`
- `src/server/catalog-service.ts`
- `src/server/order-service.ts`
- `src/validations/catalog.ts`
- `src/validations/order.ts`
- `src/lib/permissions.ts`
- `tests/validation.test.ts`
- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Testes Realizados ou Pendentes

- Executado `npx prisma format`: passou.
- Executado `npx prisma generate`: passou.
- Executado `npx prisma migrate deploy`: passou.
- Executado `npm run db:seed`: passou.
- Executado `npx prisma validate`: passou.
- Executado ESLint focado nos arquivos alterados: passou.
- Executado `npm test`: passou.
- `npm run typecheck` geral continua falhando por arquivos antigos em `release/`.
- Pendente teste manual no navegador dos fluxos de cliente e novo pedido.

## 2026-07-14 16:53:14 -03

### Resumo

- Corrigido o problema em que a criacao de pedido exibia `NEXT_REDIRECT` em vermelho mesmo salvando o pedido corretamente.
- Apos criar pedido, o sistema redireciona para a tela de detalhe com confirmacao `Pedido criado com sucesso.`
- Adicionado o campo `Pedido SAP` para registrar o numero do pedido em outro sistema no momento da aprovacao.
- A aprovacao de pedido passou a exigir `Pedido SAP`.
- Criada e aplicada migration PostgreSQL para adicionar `sapOrderNumber` em `Order`.
- Atualizada a documentacao de contexto antes do fechamento do terminal.
- Confirmado que `git status` e `git diff` nao estao disponiveis neste diretorio por ausencia de `.git`.

### Arquivos Alterados

- `prisma/schema.prisma`
- `prisma/migrations/20260714142500_add_sap_order_number/migration.sql`
- `src/app/actions.ts`
- `src/server/order-service.ts`
- `src/validations/order.ts`
- `src/features/orders/status-form.tsx`
- `src/app/(app)/orders/[id]/page.tsx`
- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Impactos no Sistema

- Pedido criado com sucesso deixa de mostrar erro tecnico e passa a mostrar confirmacao amigavel.
- Pedidos aprovados agora podem armazenar o numero externo/SAP.
- O banco precisa da migration nova aplicada para a aplicacao funcionar com o campo `sapOrderNumber`.
- A instalacao em servidor deve incluir schema, migration, arquivos TypeScript alterados, `prisma generate`, `prisma migrate deploy`, build e restart do servico.

### Testes Realizados ou Pendentes

- Executado `npx prisma format`: passou.
- Executado `npx prisma generate`: passou.
- Executado `npx prisma validate`: passou.
- Executado `npx prisma migrate deploy`: passou e aplicou `20260714142500_add_sap_order_number`.
- Executado ESLint focado nos arquivos alterados: passou.
- `npm run lint` geral foi executado e falhou apenas por arquivos antigos em `release/next-env.d.ts`, fora da alteracao desta sessao.
- Pendente teste manual no navegador para criacao de pedido, mensagem de sucesso, aprovacao com `Pedido SAP` e bloqueio de aprovacao sem `Pedido SAP`.
- Pendente decidir se `Pedido SAP` deve entrar em tabelas, relatorios, CSV/PDF e impressao.

## 2026-07-13 17:35:39 -03

### Resumo

- Atualizada a documentacao de contexto antes do fechamento do terminal.
- Registrada a migracao de SQLite para PostgreSQL, incluindo baseline Prisma, scripts de exportacao/importacao, validacao e backup/restauracao PostgreSQL.
- Registrado que a base PostgreSQL ativa foi zerada conforme solicitado e ficou com dados de seed, sem pedidos historicos.
- Registradas as mudancas de seguranca: OAuth Google/Microsoft para usuarios existentes, 2FA por e-mail, bypass interno apenas para `admin`, validacao de e-mail e troca obrigatoria de senha para usuarios nao-admin.
- Registrada a exclusao/inativacao segura de usuario.
- Registrada a preparacao de documentacao e pacote para servidor Linux com systemd.
- Registrado que nao ha pasta `.git` no diretorio atual; portanto, `git diff` nao esta disponivel localmente.

### Arquivos Alterados

- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`
- `README.md`
- `.env.example`
- `docker-compose.yml`
- `package.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/20260713154800_postgresql_baseline/migration.sql`
- `prisma/migrations-sqlite-backup/`
- `src/server/db.ts`
- `src/server/auth.ts`
- `src/server/user-service.ts`
- `src/server/order-service.ts`
- `src/server/email.ts`
- `src/server/email-validation.ts`
- `src/server/oauth.ts`
- `src/app/actions.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/verify/page.tsx`
- `src/app/api/auth/google/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/app/api/auth/microsoft/route.ts`
- `src/app/api/auth/microsoft/callback/route.ts`
- `src/features/auth/login-form.tsx`
- `src/features/auth/verify-code-form.tsx`
- `src/features/admin/user-form.tsx`
- `src/app/(app)/users/page.tsx`
- `scripts/backup-sqlite-database.ts`
- `scripts/export-sqlite-data.ts`
- `scripts/import-postgresql-data.ts`
- `scripts/validate-database-migration.ts`
- `scripts/backup-postgresql.ts`
- `scripts/restore-postgresql.ts`
- `docs/POSTGRESQL_MIGRATION.md`
- `docs/DEPLOY_LINUX_SYSTEMD.md`
- `release/pedidos-comercial-linux-2026-07-13-173252/`
- `release/pedidos-comercial-linux-2026-07-13-173252.tar.gz`

### Impactos no Sistema

- O sistema passou a operar com PostgreSQL como banco principal.
- SQLite deve ser tratado apenas como backup historico/origem de migracao, sem novas gravacoes.
- Backups operacionais passam a usar `pg_dump`/`pg_restore`.
- Login de `admin` local evita bloqueio por falha SMTP, mas usuarios comuns continuam exigindo fluxo de seguranca.
- Usuarios comuns continuam obrigados a trocar senha apos primeiro acesso ou redefinicao administrativa.
- Exclusao de usuario preserva historico por inativacao e auditoria.
- Pacote Linux esta pronto para homologacao antes de producao.

### Testes Realizados ou Pendentes

- Executado `npx prisma format`: passou.
- Executado `npx prisma validate`: passou.
- Executado `npx prisma generate`: passou.
- Executado `npx prisma migrate deploy`: passou.
- Executado `npm run db:migration:validate`: passou antes do reset da base ativa.
- Executado `npm run db:backup`: passou apos ajuste para remover query string da URL no `pg_dump`.
- Executado `npm run lint`: passou.
- Executado `npm run typecheck`: passou.
- Executado `npm test`: passou com a suite existente de validacao.
- Executado `npm run build`: passou.
- Pendente criar testes de integracao completos para PostgreSQL com `TEST_DATABASE_URL`.
- Pendente validar envio real de e-mail no Office 365 com a conta SMTP atualmente configurada.
- Pendente validar o pacote Linux em homologacao.

## 2026-07-12 22:22:58 -03

### Resumo

- Implementada edição de pedidos com rota `/orders/[id]/edit`, reaproveitando o formulário de pedido.
- Adicionado histórico campo a campo para edição de pedidos e auditoria `ORDER_UPDATED`.
- Removida a opção de excluir pedidos da interface, Server Actions, serviço e permissões.
- Corrigida a regra de negócio: pedidos `APROVADO` ou `CANCELADO` não podem mais ser editados.
- Implementada edição de embalagens e moedas diretamente nas telas administrativas.
- Implementada exclusão/inativação de embalagens e moedas conforme existência de vínculo com pedidos.
- Implementada edição administrativa de usuários, incluindo dados cadastrais, perfil, ativo/inativo e senha temporária opcional.
- Reforçado fluxo de primeiro login com senha temporária: usuário com `mustChangePassword` é enviado para `/profile` e precisa informar nova senha.
- Corrigido bug que impedia reativar usuário por leitura incorreta do checkbox `active` no `FormData`.
- Reiniciado o servidor Next.js para limpar cache do Webpack após remoção do antigo botão de exclusão de pedidos.
- Registrado novamente que o diretório atual não possui `.git`; `git status` e `git diff` não estão disponíveis.

### Arquivos Alterados

- `src/app/actions.ts`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/orders/[id]/page.tsx`
- `src/app/(app)/orders/[id]/edit/page.tsx`
- `src/app/(app)/orders/all/page.tsx`
- `src/app/(app)/orders/my/page.tsx`
- `src/app/(app)/packages/page.tsx`
- `src/app/(app)/currencies/page.tsx`
- `src/app/(app)/users/page.tsx`
- `src/features/orders/order-form.tsx`
- `src/features/orders/orders-table.tsx`
- `src/features/admin/catalog-forms.tsx`
- `src/features/admin/user-form.tsx`
- `src/features/admin/profile-form.tsx`
- `src/features/admin/password-change-guard.tsx`
- `src/server/order-service.ts`
- `src/server/catalog-service.ts`
- `src/server/user-service.ts`
- `src/lib/permissions.ts`
- `src/validations/user.ts`
- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Impactos no Sistema

- Pedidos continuam rastreáveis e não podem mais ser excluídos.
- Edição de pedido fica restrita ao período anterior à aprovação ou cancelamento.
- Embalagens e moedas usadas em pedidos preservam histórico por inativação em vez de exclusão física.
- Administração de usuários ficou operacional para edição, reativação e redefinição de senha temporária.
- Usuários novos ou com senha redefinida precisam trocar a senha no próximo login.
- O fluxo de ativação de usuários foi corrigido para funcionar com checkbox marcado/desmarcado.

### Testes Realizados ou Pendentes

- Executado `npm run typecheck`: passou.
- Executado `npm run lint`: passou.
- Executado `npm test`: passou com 7 testes.
- Build de produção não foi executado nesta etapa.
- Pendente criar testes de integração para os novos fluxos administrativos e de edição de pedidos.

## 2026-07-11 00:15:59 -03

### Resumo

- Atualizada a documentação de contexto antes do fechamento do terminal.
- Reorganizado `TASKS.md` por prioridade: alta, média e baixa.
- Registrado que o diretório atual não é um repositório Git; portanto, `git diff` e `git status` não estão disponíveis para auditoria formal de alterações.
- Mantida a observação crítica de escopo: o código atual implementa Pedidos Comerciais, enquanto o contexto funcional alvo informado pelo usuário descreve Controle de Ponto de Acesso Veicular.

### Arquivos Alterados

- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Impactos no Sistema

- Nenhuma funcionalidade de runtime foi alterada nesta atualização.
- A alteração é somente documental.
- A próxima sessão deve conseguir recuperar rapidamente o estado do projeto, pendências, regras críticas e comandos de execução.

### Testes Realizados ou Pendentes

- Não foram executados lint, typecheck, testes ou build nesta etapa porque a solicitação foi apenas atualizar documentação.
- Últimos resultados registrados anteriormente: lint passou, typecheck passou, testes passaram e build passou após integração SQLite.

## 2026-07-11

- Criado `CODEX_CONTEXT.md` como memória técnica do projeto.
- Criado `TASKS.md` com checklist de pendências.
- Criado `CHANGELOG_DEV.md` para registrar alterações importantes por data.
- Registrado conflito de escopo: código atual é de Pedidos Comerciais; contexto informado pelo usuário descreve Controle de Ponto de Acesso Veicular.
- Documentado estado atual do sistema: Next.js, Prisma, SQLite, autenticação, pedidos, cadastros, usuários, permissões, auditoria, relatórios e backup.
- Documentadas regras funcionais futuras para ponto de acesso: OCR, Commbox opcional, fluxos, triggers, condições, ações, ROI, sessões e monitoramento.
- Migrada a persistência principal para SQLite com Prisma.
- Configurados valores financeiros e quantidades como inteiros escalados.
- Criados scripts de backup e restauração para SQLite.
- Corrigido loop de redirecionamento em `/profile` causado por `mustChangePassword`.
- Reiniciado e depois parado o servidor Next.js durante validações manuais.
- Parado/removido o container PostgreSQL antigo, pois o sistema passou a usar SQLite.

## 2026-07-10

- Projeto inicial criado como sistema de Pedidos Comerciais.
- Implementada autenticação com sessão HTTP-only e bcrypt.
- Implementado RBAC com perfis, permissões e overrides individuais.
- Implementados cadastros auxiliares de produtos, embalagens e moedas.
- Implementado cadastro e listagem de pedidos.
- Implementado status de pedido e histórico de status.
- Implementados dashboard, relatórios e auditoria inicial.
- Implementada persistência SQLite via Prisma.
- Criados scripts de backup e restauração do SQLite.
- Criado seed idempotente com usuário admin, perfis, permissões, moedas, embalagens e produtos demo.
