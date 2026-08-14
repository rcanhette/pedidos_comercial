# Atualizacao da Sessao - 2026-07-17 12:35:13 -03 - Relatorio, Painel de Vendas e Hotfix Novo Pedido

## O que foi implementado nesta sessao

- Criada a funcionalidade de Relatorio com filtros, paginacao backend, ordenacao e exportacao para Excel/PDF.
- A rota `/reports` passou a abrir diretamente a tela `Relatorio`; a rota `/reports/sales` foi mantida como redirecionamento para compatibilidade.
- O relatorio exibe pedidos com filtros por Cliente, Produto, Tipo de Contrato, Fechamento MP, Data de Criacao, Previsao de Retirada e Status.
- Exportacoes do relatorio usam os mesmos filtros do backend e respeitam escopo de permissao.
- Criado o Painel de Vendas em `/dashboard/sales` com Visao Executiva, Share por Cliente e Configuracao de Metas em abas.
- A Visao Executiva apresenta cards gerenciais, grafico Boca do Jacare, grafico mensal e tabela mensal de apoio.
- Criado cadastro de metas mensais de vendas por ano/mes em toneladas, persistido no model `SalesTarget`.
- Criada permissao `META_VENDAS_GERENCIAR` para gerenciar metas, atribuida a `Administrator`, `Gestor` e `Analista` via migration.
- Criada aba Share por Cliente com Treemap, ranking, cards, concentracao Top 3, alertas discretos e filtros mensais.
- O Painel de Vendas usa Recharts para linha, barras e Treemap.
- Corrigido erro client-side na tela `Novo pedido` acessada por IP/HTTP, adicionando fallback para `crypto.randomUUID()` em `src/features/orders/order-form.tsx`.
- Preparado pacote de deploy incremental em `release/deploy-update/pedidos-comercial-update-2026-07-17.tar.gz`.
- Preparado hotfix isolado para Novo Pedido em `release/hotfix-new-order/hotfix-new-order-client-exception-2026-07-17.tar.gz`.

## O que foi alterado no comportamento do sistema

- Relatorio antigo de cards em `/reports` foi substituido pela tela operacional de Relatorio de pedidos.
- O item de menu `Relatorios` foi renomeado para `Relatorio`.
- Representante Externo recebeu `RELATORIO_VISUALIZAR` no mapa de permissoes e continua limitado ao proprio escopo quando aplicavel.
- O Relatorio exporta `.xlsx` com ExcelJS e PDF com PDFKit, sempre pelo backend.
- O Painel de Vendas considera como vendas realizadas apenas `APROVADO`, `EM_CRIACAO`, `PEDIDO_CRIADO` e `ENVIADO_PARA_ASSINATURA`.
- O mes da venda no Painel e no Share por Cliente e definido por `pickupForecast` (Previsao de Retirada), nao por data de criacao.
- Metas sao cadastradas em toneladas, usando inteiro escalado `targetTonsScaled`; nao sao valores financeiros.
- Volume vendido usa `Order.quantityScaled` e `productUnitSnapshot`: toneladas entram direto, KG e convertido para toneladas, unidades incompativeis sao ignoradas no painel.
- A configuracao de metas ficou separada dos graficos gerenciais e aparece apenas para usuarios com `META_VENDAS_GERENCIAR`.
- Share por Cliente agrupa os 7 maiores clientes e soma os demais em `Outros`.
- Novo Pedido agora funciona em acesso por IP/HTTP sem depender de `crypto.randomUUID()` estar disponivel no navegador.

## Arquivos principais modificados

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
- `release/deploy-update/pedidos-comercial-update-2026-07-17.tar.gz`
- `release/hotfix-new-order/hotfix-new-order-client-exception-2026-07-17.tar.gz`

## Regras de negocio novas ou corrigidas para lembrar

- `RELATORIO_VISUALIZAR` controla acesso ao Relatorio e Painel de Vendas; escopo de pedidos continua vindo de `PEDIDO_VISUALIZAR_TODOS` ou `PEDIDO_VISUALIZAR_PROPRIOS`.
- `META_VENDAS_GERENCIAR` controla acesso visual e backend ao cadastro/edicao de metas.
- Representante Externo nao pode consultar dados de outros representantes no Relatorio, Painel ou Share por Cliente.
- Relatorio de pedidos aplica filtros por AND e pagina no backend com 20 registros por pagina.
- Exportacao do Relatorio nao limita aos 20 registros da pagina atual; exporta todo o resultado filtrado permitido.
- Metas mensais sao volume em toneladas, nao preco/faturamento.
- Boca do Jacare compara meta acumulada e realizado acumulado em toneladas.
- Realizado acumulado nao inventa vendas futuras; a linha para no ultimo mes com venda.
- Share por Cliente usa somente pedidos validos do mes selecionado, pela Previsao de Retirada, e agrupa `Outros` apos os 7 maiores clientes.
- Quantidade de materia-prima da Lista Tecnica nao deve ser usada como volume vendido.
- Para acesso por IP/HTTP, evitar APIs de navegador que dependam de contexto seguro sem fallback.

## Pontos que ainda precisam de atencao

- Testar manualmente em navegador no servidor: `/orders/new`, `/reports`, `/dashboard/sales`, exportacoes Excel/PDF e salvamento de metas.
- Aplicar no servidor `npm install`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run build` e restart do servico apos copiar pacote completo de atualizacao.
- Se o servidor ja recebeu pacote completo e apenas a tela Novo Pedido quebrou, aplicar hotfix com `src/features/orders/order-form.tsx`, rebuild e restart.
- Verificar no ambiente de producao se usuarios existentes receberam `META_VENDAS_GERENCIAR` via migration `20260717020200_add_sales_dashboard_permissions`.
- Avaliar futuramente exportacao PDF do Painel de Vendas/Share por Cliente, que foi deixada fora para evitar mudanca ampla.
- `git diff` nao esta disponivel neste diretorio porque a pasta atual nao e um repositorio Git; documentacao foi atualizada com base no estado dos arquivos e comandos executados.

## Validacoes realizadas nesta sessao

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate dev --name add_monthly_sales_targets`: passou.
- `npx prisma migrate dev` aplicou `20260717020200_add_sales_dashboard_permissions`: passou.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run test`: passou com 29 testes apos Share por Cliente.
- `npm run build`: passou apos as implementacoes e tambem apos o hotfix de Novo Pedido.
- Servidor local foi reiniciado varias vezes em `http://localhost:3001` apos limpar `.next` para evitar cache inconsistente.

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

# Contexto do Projeto

## Atualizacao da Sessao - 2026-07-15 11:46:40 -03

### O que foi implementado nesta sessao

- A tela de novo pedido passou a oferecer `Novo cliente` no seletor de cliente.
- Ao selecionar `Novo cliente`, o formulario exibe campos inline para Cliente, Cidade e CNPJ.
- A tela de novo pedido passou a oferecer `Novo produto` no seletor de produto.
- Ao selecionar `Novo produto`, o formulario exibe campos inline para Codigo, Produto, Unidade e Descricao.
- Ao salvar o pedido, o backend cria ou reativa/atualiza o cliente pelo CNPJ dentro da mesma transacao.
- Ao salvar o pedido, o backend cria ou reativa/atualiza o produto pelo codigo dentro da mesma transacao.
- O pedido continua salvando snapshots de cliente e produto para preservar historico.
- Adicionados testes de validacao para exigir dados quando `Novo cliente` ou `Novo produto` forem selecionados.

### O que foi alterado no comportamento do sistema

- Representantes podem criar pedido usando cliente/produto ja cadastrado ou cadastrando um novo no proprio formulario.
- O novo cliente/produto fica disponivel para selecao em pedidos futuros apos o salvamento do pedido.
- Se o CNPJ ou codigo ja existir, o cadastro e atualizado/reativado em vez de gerar duplicidade.

### Arquivos principais modificados

- `src/validations/order.ts`
- `src/server/order-service.ts`
- `src/features/orders/order-form.tsx`
- `tests/validation.test.ts`
- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`

### Validacoes realizadas

- ESLint focado nos arquivos alterados: passou.
- `npm test`: passou com 8 testes.
- `npx prisma validate`: passou.
- Verificada resposta de `/orders/new` em `http://localhost:3001`; a rota recompilou sem erro.

### Pontos que ainda precisam de atencao

- Testar manualmente no navegador: criar pedido com cliente existente, com novo cliente, com produto existente e com novo produto.
- Validar se representantes devem poder cadastrar novos produtos inline sem permissao `PRODUTO_CRIAR`; atualmente o fluxo de pedido permite para quem pode criar pedido.

## Atualizacao da Sessao - 2026-07-15 11:33:12 -03

### O que foi implementado nesta sessao

- Criado cadastro de clientes com campos `Cliente`, `Cidade`, `CNPJ` e status ativo/inativo.
- Criada a rota `/customers` com criacao, edicao e exclusao/inativacao segura de clientes.
- Adicionado o modelo Prisma `Customer` e o relacionamento opcional `Order.customerId` para preservar pedidos antigos.
- Criadas migrations PostgreSQL `20260715110000_add_customers` e `20260715111500_backfill_customers_from_orders`.
- Pedidos existentes foram vinculados automaticamente a clientes gerados a partir de `customerName`, `city` e `cnpj` quando possivel.
- A tela de novo pedido passou a selecionar cliente cadastrado em vez de digitar cliente, cidade e CNPJ manualmente.
- A criacao/edicao de pedido agora busca o cliente escolhido e grava snapshots `customerName`, `city` e `cnpj` no pedido.
- Adicionadas permissoes `CLIENTE_VISUALIZAR`, `CLIENTE_CRIAR`, `CLIENTE_EDITAR` e `CLIENTE_INATIVAR`, aplicadas via seed.
- Prisma Client foi regenerado apos a alteracao de schema.
- Servidor Next.js foi reiniciado em `http://localhost:3001`.

### O que foi alterado no comportamento do sistema

- O cadastro do cliente passa a ser centralizado.
- Novo pedido exige selecao de cliente ativo.
- Nome, cidade e CNPJ continuam salvos como snapshot no pedido para preservar historico se o cadastro do cliente for alterado depois.
- Cliente vinculado a pedido nao e apagado fisicamente; ao excluir, e inativado.

### Arquivos principais modificados

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

### Validacoes realizadas

- `npx prisma format`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate deploy`: passou e aplicou as duas migrations de clientes.
- `npm run db:seed`: passou e atualizou permissoes/perfis.
- `npx prisma validate`: passou.
- ESLint focado nos arquivos alterados: passou.
- `npm test`: passou com 7 testes.
- `npm run typecheck` geral continua falhando por arquivos antigos dentro de `release/`, fora do codigo ativo.
- Verificadas rotas `/customers` e `/orders/new` via HTTP; ambas respondem e redirecionam para `/login` sem sessao.
- Verificado backfill local: 1 cliente criado e 0 pedidos sem `customerId`.

### Pontos que ainda precisam de atencao

- Testar manualmente no navegador: cadastrar cliente, editar cliente, inativar cliente, criar pedido selecionando cliente e editar pedido existente.
- Decidir se clientes devem aparecer em relatorios, filtros e exportacoes.
- Em deploy, executar `npx prisma generate`, `npx prisma migrate deploy`, `npm run db:seed`, build e restart do servico.

## Atualizacao da Sessao - 2026-07-14 16:53:14 -03

### O que foi implementado nesta sessao

- Corrigido o fluxo de criacao de pedido para nao exibir `NEXT_REDIRECT` como erro visual apos salvar.
- A criacao de pedido agora redireciona para a tela de detalhe com `?created=1` e exibe mensagem de sucesso: `Pedido criado com sucesso.`
- Adicionado o campo opcional `sapOrderNumber` no modelo `Order`, apresentado ao usuario como `Pedido SAP`.
- Criada migration PostgreSQL `20260714142500_add_sap_order_number` para adicionar a coluna `sapOrderNumber` na tabela `Order`.
- A tela de alteracao/aprovacao de status passou a ter o campo `Pedido SAP`.
- A aprovacao de pedido (`APROVADO`) agora exige o preenchimento de `Pedido SAP`.
- O numero de Pedido SAP informado na aprovacao e salvo no pedido e exibido na tela de detalhe do pedido.
- Prisma Client foi regenerado apos a alteracao de schema.
- A migration nova foi aplicada no PostgreSQL local com `npx prisma migrate deploy`.
- Orientado que nao e necessario copiar toda a pasta para o servidor se forem copiados os arquivos alterados e executados `prisma generate`, `prisma migrate deploy`, `build` e restart do servico.

### O que foi alterado no comportamento do sistema

- Ao concluir um novo pedido com sucesso, o sistema nao mostra mais a mensagem vermelha `NEXT_REDIRECT`; em vez disso, abre o detalhe do pedido criado com uma confirmacao visual verde.
- A aprovacao de pedido agora depende do numero do pedido no sistema externo/SAP. Se o status escolhido for `Aprovado`, o campo `Pedido SAP` e obrigatorio.
- Para status `Recusado` ou `Cancelado`, a justificativa continua obrigatoria e `Pedido SAP` nao e exigido.
- O valor de `Pedido SAP` permanece associado ao pedido e aparece nos dados do detalhe do pedido.
- O banco de dados precisa estar com a migration `20260714142500_add_sap_order_number` aplicada antes de rodar a versao nova em servidor.

### Arquivos principais modificados

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

### Regras de negocio novas ou corrigidas para lembrar

- `redirect()` do Next.js dentro de Server Action nao deve ficar dentro de `try/catch` que retorna mensagem ao formulario, porque o Next usa excecao interna `NEXT_REDIRECT` para redirecionar.
- Ao criar pedido, salvar primeiro, sair do `try/catch`, e so entao executar `redirect()`.
- Pedido aprovado deve ter `Pedido SAP` preenchido para registrar o numero do pedido no outro sistema.
- `Pedido SAP` deve ser tratado como identificador textual, nao numerico, para aceitar formatos de outro sistema.
- A coluna `sapOrderNumber` e opcional no banco para preservar pedidos antigos e permitir pedidos ainda nao aprovados.
- Antes de instalar esta versao no servidor, aplicar migrations e regenerar Prisma Client.

### Pontos que ainda precisam de atencao

- Testar manualmente no navegador: criar pedido, confirmar mensagem `Pedido criado com sucesso`, aprovar pedido com `Pedido SAP`, tentar aprovar sem `Pedido SAP`, recusar/cancelar com justificativa.
- Decidir se `Pedido SAP` tambem deve aparecer nas tabelas de pedidos, relatorios, exportacao CSV/PDF e impressao.
- Ao migrar para o servidor, copiar os arquivos alterados ou pacote completo sem `node_modules`, rodar `npx prisma generate`, `npx prisma migrate deploy`, `npm run build` e reiniciar o servico.
- O `npm run lint` geral ainda falha por arquivos antigos dentro de `release/`; a validacao focada nos arquivos alterados passou.
- `npm run typecheck` geral tambem havia sido afetado anteriormente por arquivos antigos dentro de `release/`; para esta sessao foram usadas validacoes focadas e `prisma validate`.
- `git status` e `git diff` nao estao disponiveis porque o diretorio atual nao possui `.git`; a documentacao foi atualizada com base no estado dos arquivos e comandos executados.

## Atualizacao da Sessao - 2026-07-13 17:35:39 -03

### O que foi implementado nesta sessao

- Migracao completa do Prisma de SQLite para PostgreSQL, com datasource `postgresql`, baseline de migration PostgreSQL e preservacao das migrations SQLite em `prisma/migrations-sqlite-backup/`.
- Criados scripts de exportacao SQLite, importacao PostgreSQL, validacao de migracao, backup e restauracao PostgreSQL.
- Criados backups antes da migracao: banco SQLite original, exportacao JSON legivel e dump PostgreSQL.
- Banco local PostgreSQL foi resetado para uma base limpa conforme solicitado, mantendo seed inicial e sem pedidos migrados na base ativa.
- Aplicacao foi mantida rodando em desenvolvimento em `http://localhost:3001`, pois a porta `3000` estava ocupada.
- Implementado login social com Google e Microsoft/Office para usuarios existentes e ativos, sem cadastro publico automatico.
- Implementada dupla autenticacao por codigo enviado por e-mail para login normal.
- Implementado bypass de dupla autenticacao por e-mail somente para o usuario `admin` em login interno/local.
- Corrigido fluxo para que a validacao do codigo de e-mail nao remova a obrigatoriedade de troca de senha.
- Reforcada regra: usuarios nao-admin criados, editados ou com senha redefinida devem ficar com `mustChangePassword=true` ate trocarem a propria senha.
- Implementada opcao de excluir usuario como inativacao segura, removendo sessoes e desafios de login, sem permitir excluir o proprio usuario nem o `admin`.
- Implementada validacao de e-mail no cadastro/edicao de usuario com sintaxe e DNS MX, com validacao SMTP opcional por variavel de ambiente.
- Preparada documentacao de instalacao em servidor Linux com systemd e pacote de distribuicao em `release/pedidos-comercial-linux-2026-07-13-173252.tar.gz`.

### O que foi alterado no comportamento do sistema

- O banco principal da aplicacao agora e PostgreSQL; SQLite permanece apenas como origem historica/backup de migracao.
- O ambiente local atual usa PostgreSQL em `localhost:5432`, banco `sistema_pedidos`; credenciais reais ficam somente no `.env`.
- A base ativa foi zerada apos a migracao: o sistema esta com dados de seed e sem pedidos historicos na base em uso.
- Login interno do `admin` nao exige codigo por e-mail; demais usuarios continuam sujeitos ao fluxo de codigo por e-mail.
- Apos informar o codigo de e-mail, usuarios nao-admin com `mustChangePassword=true` continuam sendo redirecionados para troca de senha.
- Usuarios nao-admin devem trocar a senha no primeiro acesso e tambem apos redefinicao administrativa de senha.
- A exclusao de usuario e logica/inativacao, nao remocao fisica destrutiva.
- Numeracao de pedidos usa estrategia atomica compativel com PostgreSQL para evitar duplicidade em concorrencia.
- Backups de producao devem usar `pg_dump`/`pg_restore`; nao copiar arquivos internos do banco.

### Arquivos principais modificados

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/20260713154800_postgresql_baseline/migration.sql`
- `prisma/migrations-sqlite-backup/`
- `docker-compose.yml`
- `.env.example`
- `package.json`
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
- `src/features/auth/login-form.tsx`
- `src/features/auth/verify-code-form.tsx`
- `src/features/admin/user-form.tsx`
- `src/app/(app)/users/page.tsx`
- `src/app/api/auth/google/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/app/api/auth/microsoft/route.ts`
- `src/app/api/auth/microsoft/callback/route.ts`
- `scripts/backup-sqlite-database.ts`
- `scripts/export-sqlite-data.ts`
- `scripts/import-postgresql-data.ts`
- `scripts/validate-database-migration.ts`
- `scripts/backup-postgresql.ts`
- `scripts/restore-postgresql.ts`
- `docs/POSTGRESQL_MIGRATION.md`
- `docs/DEPLOY_LINUX_SYSTEMD.md`
- `README.md`
- `release/pedidos-comercial-linux-2026-07-13-173252/`
- `release/pedidos-comercial-linux-2026-07-13-173252.tar.gz`

### Regras de negocio novas ou corrigidas para lembrar

- Nunca imprimir nem versionar segredos reais do `.env`.
- `admin` pode logar internamente sem codigo de e-mail, mas esse bypass nao deve ser estendido a usuarios comuns.
- Usuarios comuns precisam trocar senha no primeiro acesso; validar codigo 2FA nao pode limpar `mustChangePassword`.
- Somente a troca de senha pelo proprio usuario deve mudar `mustChangePassword` para `false`.
- Excluir usuario significa inativar, limpar sessoes/desafios e auditar; nao apagar fisicamente o registro.
- Nao permitir excluir o proprio usuario logado nem o usuario `admin`.
- OAuth Google/Microsoft deve aceitar apenas e-mails ja cadastrados e ativos.
- Valores financeiros e quantidades continuam preservados no formato existente; nao converter para decimal sem tarefa especifica e testes.
- Pedidos devem manter numeracao unica com transacao/operacao atomica no PostgreSQL.
- SQLite original e exportacao JSON devem permanecer como backup historico; nao receber novas gravacoes.

### Pontos que ainda precisam de atencao

- Validar envio real de e-mail no Office 365 com a conta atualmente configurada no `.env`; houve erro SMTP `535 5.7.139` com credenciais anteriores.
- Criar uma suite de testes de integracao para PostgreSQL usando `TEST_DATABASE_URL`, cobrindo login, 2FA, troca de senha, usuarios, pedidos, relatorios, backup e concorrencia.
- Verificar manualmente em navegador o fluxo completo: admin sem codigo, usuario comum com codigo, troca obrigatoria de senha e exclusao/inativacao de usuario.
- Confirmar em homologacao o pacote Linux e o servico systemd antes de producao.
- Atualizar ou remover documentacao antiga de Windows/SQLite que ainda possa confundir a operacao atual.
- Nao foi possivel consultar `git diff` porque o diretorio atual nao possui pasta `.git`; o contexto foi atualizado com base no estado dos arquivos e nas alteracoes realizadas na sessao.

## Atualização da Sessão - 2026-07-12 22:22:58 -03

### O que foi implementado nesta sessão

- Implementada edição de pedidos com página dedicada em `/orders/[id]/edit`.
- A edição de pedidos passou a registrar histórico campo a campo em `OrderChangeHistory` e auditoria `ORDER_UPDATED`.
- Removida a funcionalidade de exclusão de pedidos da interface, das Server Actions, do serviço e das permissões.
- Corrigida a regra de edição de pedidos: pedidos `APROVADO` ou `CANCELADO` não podem mais ser editados, inclusive por acesso direto à rota.
- Implementada edição de embalagens diretamente na tela `/packages`, com alteração de nome, capacidade, unidade, peso, descrição e status ativo/inativo.
- Implementada exclusão/inativação de embalagens: se não houver uso em pedidos, remove; se houver uso, inativa para preservar histórico.
- Implementada edição de moedas diretamente na tela `/currencies`, com alteração de código, nome, símbolo, casas decimais e status ativo/inativo.
- Implementada exclusão/inativação de moedas: se não houver uso em pedidos, remove; se houver uso, inativa para preservar histórico.
- Implementada edição administrativa de usuários na tela `/users`, incluindo dados cadastrais, perfil, status ativo/inativo e redefinição opcional de senha temporária.
- Reforçado o fluxo de primeiro login: usuários criados continuam com `mustChangePassword=true`, são redirecionados para `/profile` e precisam cadastrar nova senha para continuar.
- Corrigido bug de ativação de usuários causado por `FormData.get("active")` ler apenas o primeiro valor do checkbox; agora o backend considera `true` se qualquer valor enviado for `true`.
- Adicionado componente `PasswordChangeGuard` para redirecionar usuários com troca de senha pendente para `/profile`.
- Reiniciado o servidor Next.js após remoção do componente antigo de exclusão de pedidos para limpar referência em cache do Webpack.

### O que foi alterado no comportamento do sistema nesta sessão

- Pedido só pode ser editado antes de ser aprovado ou cancelado.
- Pedido aprovado ou cancelado não mostra botão de edição e não aceita salvamento no backend.
- Pedido não pode mais ser excluído pelo sistema.
- Embalagens e moedas podem ser editadas e desativadas pela interface administrativa.
- Embalagens e moedas vinculadas a pedidos não são apagadas fisicamente; são inativadas.
- Usuários podem ser editados por administradores com `USUARIO_EDITAR`.
- Ao redefinir senha de um usuário pela administração, o usuário fica obrigado a trocar a senha no próximo login.
- Usuário novo precisa alterar a senha temporária no primeiro login.
- Usuário inativo pode ser reativado corretamente pela tela de usuários.

### Arquivos principais modificados nesta sessão

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

### Regras novas ou corrigidas para lembrar

- Não existe mais exclusão de pedidos.
- Pedido pode ser editado somente enquanto não estiver `APROVADO` nem `CANCELADO`.
- Edição de pedido precisa continuar autorizada no backend, não apenas escondida na UI.
- Toda edição de pedido deve registrar campos alterados em `OrderChangeHistory`.
- Embalagem/moeda usada por pedido não deve ser excluída fisicamente; deve ser inativada.
- Criação de usuário deve manter `mustChangePassword=true`.
- Redefinição administrativa de senha deve definir `mustChangePassword=true`.
- Troca de senha pelo próprio usuário deve definir `mustChangePassword=false`.
- Checkbox enviado junto com hidden input deve ser interpretado por `getAll`, não por `get`, para não salvar falso indevidamente.
- O diretório atual continua sem `.git`; `git status` e `git diff` não estão disponíveis para auditoria formal.

### Pontos que ainda precisam de atenção

- Criar testes de integração reais para os fluxos novos de edição de pedido, edição/inativação de catálogo e edição/reativação de usuários.
- Implementar edição/inativação de produtos, seguindo o mesmo padrão de embalagens/moedas.
- Implementar cancelamento por UI dedicada com justificativa obrigatória, separado da troca genérica de status se desejado.
- Implementar paginação, filtros e ordenação server-side nas tabelas.
- Implementar permissões individuais (`UserPermission`) pela interface.
- Implementar exportação CSV/PDF e impressão profissional.
- Definir oficialmente se o projeto seguirá apenas como Pedidos Comerciais ou se retomará o escopo de Ponto de Acesso Veicular.

---

## Atualização da Sessão - 2026-07-11 00:15:59 -03

### O que foi implementado nesta sessão

- Criados e preenchidos os arquivos de memória técnica do projeto:
  - `CODEX_CONTEXT.md`
  - `TASKS.md`
  - `CHANGELOG_DEV.md`
- Documentado o estado real do código atual, que é um sistema de **Pedidos Comerciais** com Next.js, Prisma e SQLite.
- Preservado no contexto o escopo funcional informado para **Controle de Ponto de Acesso Veicular**, deixando claro que esse escopo ainda não está implementado no código atual.
- Atualizado `TASKS.md` com pendências separadas por prioridade.
- Atualizado `CHANGELOG_DEV.md` com data/hora, impactos e testes.

### O que foi alterado no comportamento do sistema nesta sessão

- Nesta última etapa não houve alteração de comportamento de runtime; apenas documentação foi atualizada.
- Durante a sessão completa, o projeto foi migrado para SQLite e o PostgreSQL antigo foi parado/removido do Docker Compose em execução.
- O sistema passou a depender do arquivo SQLite configurado em `DATABASE_URL`, atualmente `file:./data/pedidos.db`, resolvido pelo Prisma em `prisma/data/pedidos.db`.
- Valores monetários e quantidades passaram a ser tratados como inteiros escalados no banco, não `Float`.
- O loop de redirecionamento para `/profile` após login foi corrigido anteriormente na sessão.

### Arquivos principais modificados nesta sessão

- `CODEX_CONTEXT.md`
- `TASKS.md`
- `CHANGELOG_DEV.md`
- `README.md`
- `.env.example`
- `.gitignore`
- `package.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/server/db.ts`
- `src/server/audit.ts`
- `src/server/order-service.ts`
- `src/server/catalog-service.ts`
- `src/lib/scalars.ts`
- `src/lib/format.ts`
- `src/lib/prisma.ts`
- `src/components/ui/badge.tsx`
- `src/features/orders/orders-table.tsx`
- `src/app/(app)/orders/[id]/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/packages/page.tsx`
- `scripts/database-path.ts`
- `scripts/backup-database.ts`
- `scripts/restore-database.ts`
- `tests/validation.test.ts`

### Regras novas ou corrigidas para lembrar

- O diretório atual não é um repositório Git; `git diff` e `git status` não funcionam enquanto `.git` não existir.
- O banco real SQLite não deve ser versionado.
- O caminho SQLite relativo de Prisma é resolvido a partir da pasta `prisma`.
- Dinheiro deve ser salvo em centavos; quantidade em escala 1000; cotação em escala 10000.
- Recusa e cancelamento devem exigir justificativa.
- Alteração de status deve criar histórico.
- O número do pedido deve continuar sendo gerado por sequência transacional, nunca por `count + 1`.
- Autorização precisa continuar no backend, não apenas no menu.
- Se o escopo de Ponto de Acesso Veicular for retomado, confirmar antes se ele substitui ou convive com Pedidos Comerciais.

### Pontos que ainda precisam de atenção

- Resolver/alinhavar o conflito de escopo entre Pedidos Comerciais e Ponto de Acesso Veicular.
- Criar testes de integração reais com SQLite separado para não usar o banco local de desenvolvimento.
- Implementar paginação, filtros e ordenação server-side nas tabelas.
- Implementar edição, duplicação e cancelamento completo de pedidos.
- Implementar edição/inativação de usuários e cadastros auxiliares.
- Implementar gestão completa de permissões individuais pela interface.
- Se a trilha veicular for confirmada, modelar do zero ponto de acesso, Commbox, câmeras, ROI, fluxos, sessões e monitoramento.

---


## Observação Crítica de Escopo

O código existente neste workspace implementa atualmente um sistema web de **Pedidos Comerciais**. A solicitação de memória técnica trouxe como base um sistema de **controle de ponto de acesso para veículos**.

Portanto, este documento registra duas camadas:

1. **Estado real do código atual:** aplicação Next.js/Prisma/SQLite para pedidos comerciais.
2. **Contexto funcional alvo informado pelo usuário:** sistema de ponto de acesso veicular com OCR, Commbox, sessões, fluxos, condições, ações e monitoramento.

Antes de implementar funcionalidades futuras, confirme qual trilha deve prevalecer. Não assumir que módulos de ponto de acesso já existem no código: eles ainda não estão implementados nesta base.

---

# Sistema Atual no Código

Estamos desenvolvendo um sistema web para cadastro, envio, acompanhamento e aprovação de pedidos comerciais.

## Objetivo Atual

Permitir que representantes cadastrem pedidos comerciais, gestores/admins acompanhem todos os pedidos, alterem status, consultem histórico e administrem usuários, permissões e cadastros auxiliares.

## Tecnologias Atuais

- Next.js App Router
- React
- TypeScript
- Prisma ORM
- SQLite
- Tailwind CSS
- Zod
- Server Actions
- Sessão HTTP-only
- bcrypt para hash de senha
- Vitest
- ESLint

## Banco Atual

- Provider: SQLite
- Configuração: `DATABASE_URL="file:./data/pedidos.db"`
- Arquivo real local: `prisma/data/pedidos.db`
- Banco não deve ser versionado.
- Conversões financeiras/quantidade usam inteiros escalados em `src/lib/scalars.ts`.

---

# Módulos Existentes no Código

## Autenticação

- Login com usuário/e-mail e senha.
- Hash de senha com bcrypt.
- Sessão persistida na tabela `Session` por token hasheado.
- Logout por Server Action.
- Usuário inativo não acessa.
- Último acesso é atualizado no login.

Arquivos principais:

- `src/server/auth.ts`
- `src/features/auth/login-form.tsx`
- `src/app/(auth)/login/page.tsx`

## Permissões e Perfis

- RBAC com `Role`, `Permission`, `UserRole`, `RolePermission`, `UserPermission`.
- Permissões podem vir do perfil e também de override individual.
- Menu oculta itens sem permissão, mas a autorização também ocorre no servidor.

Arquivos principais:

- `src/lib/permissions.ts`
- `src/app/(app)/roles/page.tsx`
- `prisma/seed.ts`

## Usuários

- Lista usuários.
- Cria usuário com senha temporária.
- Usuário novo é obrigado a trocar a senha no primeiro login.
- Edita dados cadastrais, perfil, status ativo/inativo e senha temporária pela tela administrativa.
- Redefinição administrativa de senha exige nova troca no próximo login.
- Perfil do usuário permite atualizar dados e senha.

Arquivos principais:

- `src/server/user-service.ts`
- `src/features/admin/user-form.tsx`
- `src/features/admin/profile-form.tsx`
- `src/app/(app)/users/page.tsx`
- `src/app/(app)/profile/page.tsx`

## Cadastros Auxiliares

- Produtos
- Embalagens
- Moedas

Itens ativos aparecem em novos pedidos. Itens já usados permanecem referenciados por snapshots no pedido. Embalagens e moedas podem ser editadas e inativadas pela interface. Se estiverem vinculadas a pedidos, não são removidas fisicamente.

Arquivos principais:

- `src/server/catalog-service.ts`
- `src/features/admin/catalog-forms.tsx`
- `src/app/(app)/products/page.tsx`
- `src/app/(app)/packages/page.tsx`
- `src/app/(app)/currencies/page.tsx`

## Pedidos

- Novo pedido.
- Meus pedidos.
- Todos os pedidos para usuários autorizados.
- Detalhes do pedido.
- Edição de pedido antes de aprovação ou cancelamento.
- Alteração de status.
- Histórico de status.
- Histórico de alterações campo a campo para edição de pedido.
- Número sequencial persistente em `OrderNumberSequence` no formato `PED-YYYY-000001`.
- Não há exclusão de pedidos.

Valores persistidos:

- `quantityScaled`: quantidade x1000.
- `unitPriceCents`: dinheiro em centavos.
- `commissionUsdCents`: comissão em centavos.
- `freightCents`: frete em centavos.
- `dollarRateScaled`: cotação x10000.

Arquivos principais:

- `src/server/order-service.ts`
- `src/features/orders/order-form.tsx`
- `src/features/orders/orders-table.tsx`
- `src/features/orders/status-form.tsx`
- `src/app/(app)/orders/new/page.tsx`
- `src/app/(app)/orders/my/page.tsx`
- `src/app/(app)/orders/all/page.tsx`
- `src/app/(app)/orders/[id]/page.tsx`

## Dashboard e Relatórios

- Dashboard mostra contadores por status, últimos pedidos e pedidos aguardando análise.
- Relatórios mostram pedidos por status, representante e valor por moeda.

Arquivos principais:

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/reports/page.tsx`

## Auditoria

- Registra ações importantes como login, falha de login, logout, criação de usuário, criação de pedido e mudança de status.
- Dados sensíveis são removidos antes de gravar.
- Em SQLite, `beforeData` e `afterData` são JSON serializado em texto.

Arquivos principais:

- `src/server/audit.ts`
- `src/app/(app)/audit/page.tsx`

## Backup e Restauração

- Backup do SQLite em `backups/`.
- Restauração cria backup do banco atual antes de substituir.

Arquivos principais:

- `scripts/database-path.ts`
- `scripts/backup-database.ts`
- `scripts/restore-database.ts`

---

# Estado Implementado

## Implementado no Código Atual

- Estrutura Next.js App Router.
- Prisma com SQLite.
- Migration SQLite inicial.
- Seed idempotente com admin, perfis, permissões, moedas, embalagens e produtos demo.
- Login/logout com sessão.
- RBAC no backend.
- Layout interno com menu por permissão.
- Dashboard.
- Produtos, embalagens e moedas com criação/listagem.
- Usuários com criação/listagem/edição administrativa.
- Fluxo obrigatório de troca de senha temporária no primeiro login.
- Perfil do usuário.
- Novo pedido.
- Meus pedidos.
- Todos os pedidos.
- Detalhes do pedido.
- Edição de pedido antes de aprovação/cancelamento com histórico de alterações.
- Alteração de status com histórico.
- Edição/inativação de embalagens e moedas.
- Relatórios iniciais.
- Auditoria.
- Backup/restauração SQLite.
- Testes unitários básicos para validações e conversões.

## Falta no Código Atual de Pedidos Comerciais

- Paginação/filtros/ordenação completos nas tabelas.
- Duplicar pedido.
- Cancelamento via fluxo próprio com justificativa em UI dedicada.
- Inativar/editar produtos.
- Testes de integração para edição de pedidos, usuários, embalagens e moedas.
- Gestão fina de permissões individuais pela interface.
- Exportação CSV/PDF.
- Impressão profissional completa.
- Testes de integração com banco SQLite cobrindo fluxos completos.
- Rate limit persistente de login.

---

# Contexto Funcional Alvo: Ponto de Acesso Veicular

Esta seção vem da regra funcional informada pelo usuário e deve ser preservada para uma possível evolução ou migração de escopo.

Estamos desenvolvendo um sistema de controle de ponto de acesso para veículos.

O sistema possui pontos de acesso, câmeras OCR, Commbox, sessões, fluxos configuráveis, condições, ações e monitoramento.

O ponto de acesso pode ter ou não Commbox.

A Commbox é opcional.

Quando o ponto de acesso possui Commbox, ela deve ser usada para escutar inputs e acionar outputs.

Quando o ponto de acesso não possui Commbox, ele ainda deve funcionar com OCR, controle de acesso, abertura e fechamento de sessão.

---

# Fluxo Operacional do Ponto de Acesso

O ponto de acesso trabalha com fluxos configuráveis.

Cada fluxo possui:

- Nome do fluxo
- Próximo fluxo
- Trigger
- Condições
- Ações

A tela principal de fluxos deve mostrar somente:

- Nome do Fluxo
- Próximo Fluxo

As configurações completas aparecem apenas ao expandir o fluxo.

Condições e ações também devem ter expansão própria.

---

# Triggers Atuais do Ponto de Acesso

Os triggers permitidos são:

- OCR dianteiro
- OCR traseiro
- OCR container
- Controle de acesso

Input Commbox não é mais trigger.

Input Commbox é apenas condição.

OCR não é mais ação.

Controle de acesso não é mais ação.

---

# Condições Atuais do Ponto de Acesso

As condições disponíveis são:

- Input Commbox
- Output Commbox
- Lista Branca Veículo
- Lista Branca Motorista

Condições de Input e Output só podem ser usadas se o ponto de acesso possuir Commbox.

---

# Ações Atuais do Ponto de Acesso

As ações disponíveis são:

- Abrir Sessão
- Fechar Sessão
- Acionar Output da Commbox

A ação de Output só pode ser usada se o ponto de acesso possuir Commbox.

---

# Câmeras

As câmeras são cadastradas dentro do ponto de acesso.

Cada câmera possui uma finalidade:

- OCR dianteiro
- OCR traseiro
- OCR container

Quando o fluxo usa trigger OCR dianteiro, o sistema deve buscar automaticamente a câmera do ponto de acesso configurada como OCR dianteiro.

Quando usa OCR traseiro, deve buscar a câmera OCR traseiro.

Quando usa OCR container, deve buscar a câmera OCR container.

A câmera deve preferencialmente usar RTSP para captura em tempo real.

---

# Visualização de Câmera

Na configuração do ponto de acesso, ao lado de cada câmera cadastrada, deve existir botão para:

- Visualizar câmera em tempo real
- Iniciar teste OCR
- Parar teste OCR

O teste OCR é apenas diagnóstico.

Ele não deve:

- Abrir sessão
- Fechar sessão
- Executar fluxo
- Acionar output
- Alterar operação real

---

# Área OCR / ROI

Cada câmera deve permitir configurar uma área de leitura OCR.

O usuário deve conseguir desenhar um retângulo sobre a imagem da câmera.

O OCR deve processar somente o que estiver dentro desse retângulo.

Tudo fora da área deve ser ignorado.

A área deve ser salva com coordenadas normalizadas:

```json
{
  "enabled": true,
  "x": 0.25,
  "y": 0.40,
  "width": 0.50,
  "height": 0.20
}
```

Essa ROI deve ser usada tanto no teste OCR quanto no fluxo real.

---

# Sessões do Ponto de Acesso

A sessão deve armazenar:

- ID
- Ponto de acesso
- Status
- Data início
- Data fim
- OCR dianteiro
- Imagem OCR dianteiro
- Data/hora da captura dianteira
- OCR traseiro
- Imagem OCR traseiro
- Data/hora da captura traseira
- OCR container
- Imagem OCR container
- Data/hora da captura container
- Motorista
- Documento motorista
- Peso, se houver

---

# Regra Crítica de Imagem OCR

Nenhuma sessão pode usar imagem antiga.

Uma sessão só pode usar OCR/imagem capturado depois do início da própria sessão.

Regra obrigatória:

```text
ocrCapturedAt >= session.startedAt
```

Se o OCR capturado for anterior ao início da sessão, descartar.

Cada listener OCR deve possuir `listenerRunId`.

Se o evento OCR chegar com `listenerRunId` diferente do listener atual, descartar.

Ao fechar sessão, limpar:

- último OCR
- última imagem
- último frame
- contexto runtime
- eventos pendentes
- cache de OCR

Ao iniciar nova sessão, os campos OCR devem começar limpos.

---

# Reexecução Automática do Fluxo

Quando uma sessão fecha, o ponto de acesso não deve parar.

Se o ponto de acesso ainda estiver ativo:

1. Fechar sessão atual.
2. Limpar contexto.
3. Voltar para o fluxo inicial.
4. Reiniciar trigger/listener necessário.
5. Continuar capturando OCR.
6. Abrir nova sessão quando reconhecer novo veículo.

O operador não deve precisar parar e iniciar o fluxo manualmente a cada sessão.

---

# Tela de Monitoramento do Ponto de Acesso

A tela de monitoramento deve mostrar:

Tabela inferior:

- ID
- Status
- Ponto de Controle
- Placa
- Data início
- Data fim

Ao selecionar uma sessão, mostrar na parte superior:

- Dados da sessão selecionada
- ID
- Ponto de Controle
- Motorista
- Documento Motorista
- Peso
- Cards de OCR

Cards possíveis:

- OCR Dianteiro
- OCR Traseiro
- OCR Container

OCR traseiro e OCR container só aparecem se o ponto de acesso tiver essa configuração ativa.

---

# Regras Importantes

## Regras do Código Atual de Pedidos

- Senhas nunca devem ser gravadas em texto puro.
- Autorização deve ocorrer no backend, não só no menu.
- Usuário comum só vê seus pedidos.
- Usuário com `PEDIDO_VISUALIZAR_TODOS` vê todos.
- Status inicial do pedido é `RECEBIDO`.
- Recusa e cancelamento exigem justificativa.
- Toda alteração de status cria histórico.
- Pedido aprovado ou cancelado não pode ser editado.
- Pedido não pode ser excluído.
- Toda edição de pedido cria histórico campo a campo.
- Número do pedido não pode usar `count + 1`; usar `OrderNumberSequence` em transação.
- Dinheiro e quantidades não usam `Float`; usar inteiros escalados.
- Usuário novo ou com senha redefinida administrativamente deve trocar a senha no próximo login.
- SQLite real não deve ser versionado.

## Regras do Contexto de Ponto de Acesso

- Ponto de acesso pode existir sem Commbox.
- Commbox não é obrigatória.
- Input Commbox não é trigger.
- OCR é trigger.
- Controle de acesso é trigger.
- OCR não é ação.
- Controle de acesso não é ação.
- Ações atuais são abrir sessão, fechar sessão e acionar output.
- Imagem OCR precisa ser atual, não cache.
- Sessão nova não pode herdar dados da sessão anterior.
- Ao finalizar sessão, o fluxo deve continuar rodando.
- Teste de OCR da câmera não pode interferir no fluxo real.

---

# Arquivos Importantes

## Configuração

- `package.json`
- `.env.example`
- `.gitignore`
- `next.config.ts`
- `tailwind.config.ts`
- `eslint.config.mjs`

## Prisma e Banco

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/20260713154800_postgresql_baseline/migration.sql`
- `prisma/migrations-sqlite-backup/`
- `src/server/db.ts`
- `src/lib/prisma.ts`
- `src/lib/scalars.ts`

## Backend/Serviços

- `src/server/auth.ts`
- `src/server/audit.ts`
- `src/server/user-service.ts`
- `src/server/catalog-service.ts`
- `src/server/order-service.ts`

## Actions e Rotas

- `src/app/actions.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/orders/new/page.tsx`
- `src/app/(app)/orders/my/page.tsx`
- `src/app/(app)/orders/all/page.tsx`
- `src/app/(app)/orders/[id]/page.tsx`
- `src/app/(app)/products/page.tsx`
- `src/app/(app)/packages/page.tsx`
- `src/app/(app)/currencies/page.tsx`
- `src/app/(app)/users/page.tsx`
- `src/app/(app)/roles/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/audit/page.tsx`
- `src/app/(app)/profile/page.tsx`

## Componentes

- `src/features/auth/login-form.tsx`
- `src/features/orders/order-form.tsx`
- `src/features/orders/orders-table.tsx`
- `src/features/orders/status-form.tsx`
- `src/features/admin/catalog-forms.tsx`
- `src/features/admin/user-form.tsx`
- `src/features/admin/profile-form.tsx`
- `src/components/ui/*`

## Scripts e Testes

- `scripts/backup-database.ts`
- `scripts/restore-database.ts`
- `scripts/database-path.ts`
- `tests/validation.test.ts`

---

# Como Rodar

## Instalar dependências

```bash
npm install
```

## Configurar ambiente

```bash
cp .env.example .env
```

Definir `ADMIN_INITIAL_PASSWORD` no `.env`.

## Criar/atualizar banco

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Rodar em desenvolvimento

```bash
npm run dev
```

Abrir a URL informada pelo Next. Se `3000` estiver ocupada, ele pode usar `3001`.

## Rodar validações

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Backup PostgreSQL

```bash
npm run db:backup
```

## Restaurar PostgreSQL

```bash
npm run db:restore -- backups/postgresql/pedidos-YYYY-MM-DD-HHMMSS.dump
```

## Prisma Studio

```bash
npm run db:studio
```

---

# Como Validar Manualmente

## Pedidos Comerciais

1. Rodar `npm run dev`.
2. Acessar `/login`.
3. Entrar com:
   - usuário: `admin`
   - senha: valor de `ADMIN_INITIAL_PASSWORD`.
4. Abrir Dashboard e verificar indicadores.
5. Cadastrar produto, embalagem e moeda se necessário.
6. Criar novo pedido.
7. Confirmar que o pedido aparece em `Meus pedidos`.
8. Confirmar que o pedido aparece em `Todos os pedidos` para admin.
9. Abrir detalhes do pedido.
10. Alterar status para `APROVADO`.
11. Alterar status para `RECUSADO` e confirmar que justificativa é obrigatória.
12. Verificar histórico de status.
13. Verificar relatório.
14. Executar `npm run db:backup` e confirmar arquivo em `backups/`.

## Ponto de Acesso Veicular

Ainda não há telas/serviços implementados no código atual para ponto de acesso, câmeras OCR, Commbox, fluxos ou sessões veiculares. Quando essa trilha for implementada, validar:

1. Criar ponto de acesso sem Commbox e confirmar que OCR/sessão funcionam.
2. Criar ponto de acesso com Commbox e confirmar inputs/outputs.
3. Configurar câmeras OCR dianteira/traseira/container.
4. Desenhar ROI e confirmar persistência normalizada.
5. Rodar teste OCR e confirmar que não altera operação real.
6. Configurar fluxo com trigger OCR.
7. Abrir sessão somente com OCR capturado após `session.startedAt`.
8. Fechar sessão e confirmar limpeza de cache/contexto.
9. Confirmar reexecução automática do fluxo.
10. Validar tela de monitoramento com cards corretos.

---

# Tarefas Pendentes

Ver `TASKS.md`.

---

# Histórico de Alterações

Ver `CHANGELOG_DEV.md`.
