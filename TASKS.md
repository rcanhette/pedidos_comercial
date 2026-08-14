# Atualizacao de Tarefas - 2026-07-17 12:35:13 -03

## Alta Prioridade

- [ ] Aplicar no servidor o pacote atualizado ou o hotfix necessario, preservando `.env`, banco, backups e volumes.
- [ ] No servidor, executar `npm install`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run build` e reiniciar o servico.
- [ ] Testar manualmente `/orders/new` no servidor por IP/HTTP para confirmar que o erro client-side foi corrigido.
- [ ] Testar manualmente `/reports`: filtros, paginacao, exportacao Excel e exportacao PDF.
- [ ] Testar manualmente `/dashboard/sales`: abas, Boca do Jacare, Share por Cliente e Configuracao de Metas.
- [ ] Validar que usuarios sem `META_VENDAS_GERENCIAR` nao veem a aba Configuracao de Metas e nao conseguem salvar metas por requisicao manual.
- [ ] Validar que Representante Externo ve apenas dados proprios em Relatorio, Painel de Vendas e Share por Cliente.
- [ ] Fazer backup antes de qualquer atualizacao de producao com `npm run db:backup`.

## Media Prioridade

- [ ] Avaliar exportacao PDF do Painel de Vendas e Share por Cliente, se for realmente necessaria.
- [ ] Implementar copia de metas do ano anterior, se continuar desejado.
- [ ] Melhorar busca/paginacao de seletores de Cliente/Produto caso a base cresca muito.
- [ ] Criar testes de integracao com banco PostgreSQL dedicado para Relatorio, Painel e Metas.
- [ ] Documentar rotina operacional curta de deploy incremental usando o pacote `release/deploy-update`.

## Baixa Prioridade

- [ ] Revisar copy visual dos cards e tooltips do Painel de Vendas apos uso em reuniao real.
- [ ] Avaliar reducao do bundle de `/dashboard/sales` se os graficos ficarem pesados em equipamentos antigos.
- [ ] Remover ou arquivar pacotes antigos em `release/` quando a versao estiver validada em producao.

## Concluido em 2026-07-17 - Relatorio, Painel de Vendas e Hotfix

- [x] Criar Relatorio em `/reports` com filtros backend, paginacao de 20 registros e ordenacao.
- [x] Adicionar exportacao Excel `.xlsx` com ExcelJS para todo o resultado filtrado.
- [x] Adicionar exportacao PDF com PDFKit para todo o resultado filtrado.
- [x] Reutilizar `RELATORIO_VISUALIZAR` e aplicar escopo por perfil no backend.
- [x] Adicionar filtro de Status no Relatorio.
- [x] Simplificar filtro de Previsao de Retirada para campo unico mensal.
- [x] Criar Painel de Vendas em `/dashboard/sales`.
- [x] Criar model `SalesTarget` e migrations de metas mensais.
- [x] Criar permissao `META_VENDAS_GERENCIAR` e migration para atribuir aos perfis autorizados.
- [x] Implementar Boca do Jacare, cards, grafico mensal e tabela mensal.
- [x] Reorganizar Painel em abas: Visao Executiva, Share por Cliente e Configuracao de Metas.
- [x] Implementar Share por Cliente com Treemap, ranking, cards, Top 3 e grupo Outros.
- [x] Corrigir erro client-side em Novo Pedido por `crypto.randomUUID()` sem fallback em acesso por IP/HTTP.
- [x] Preparar pacote de atualizacao `release/deploy-update/pedidos-comercial-update-2026-07-17.tar.gz`.
- [x] Preparar hotfix `release/hotfix-new-order/hotfix-new-order-client-exception-2026-07-17.tar.gz`.
- [x] Rodar Prisma format/validate/generate, lint, typecheck, testes e build.

---

# Tarefas Pendentes

## Alta Prioridade

- [ ] Testar manualmente criacao de pedido com novo cliente inline.
- [ ] Testar manualmente criacao de pedido com novo produto inline.
- [ ] Testar manualmente cadastro, edicao e inativacao de clientes.
- [ ] Testar manualmente criacao de pedido selecionando cliente cadastrado.
- [ ] Testar manualmente edicao de pedido existente com cliente vinculado.
- [ ] Testar manualmente criacao de pedido e confirmar que a mensagem `Pedido criado com sucesso.` aparece sem `NEXT_REDIRECT`.
- [ ] Testar manualmente aprovacao de pedido exigindo `Pedido SAP` e gravando o numero no detalhe do pedido.
- [ ] Antes de atualizar o servidor, copiar os arquivos alterados ou gerar pacote completo e executar `npx prisma generate`, `npx prisma migrate deploy`, `npm run build` e restart do servico.
- [ ] Validar envio real de codigo por e-mail no Office 365 com a conta SMTP configurada atualmente no `.env`.
- [ ] Testar manualmente o fluxo completo de login: `admin` sem codigo por e-mail, usuario comum com codigo por e-mail e redirecionamento para troca obrigatoria de senha.
- [ ] Testar manualmente exclusao/inativacao de usuario, bloqueio de autoexclusao e bloqueio de exclusao do `admin`.
- [ ] Criar testes de integracao com PostgreSQL separado usando `TEST_DATABASE_URL`, sem usar o banco local de trabalho.
- [ ] Cobrir em testes login valido, login invalido, usuario inativo, 2FA por e-mail, bypass interno do `admin` e troca obrigatoria de senha.
- [ ] Cobrir em testes criacao, edicao, status, historico, auditoria e exclusao logica de pedidos no PostgreSQL.
- [ ] Cobrir geracao concorrente de numero de pedido no PostgreSQL para garantir ausencia de duplicidade.
- [ ] Validar o pacote Linux em ambiente de homologacao antes de usar em producao.
- [ ] Atualizar ou remover documentacao antiga de Windows/SQLite que possa conflitar com a operacao atual em PostgreSQL.

## Media Prioridade

- [ ] Decidir se `Pedido SAP` deve aparecer nas tabelas de pedidos, dashboards e relatorios.
- [ ] Incluir `Pedido SAP` em exportacao CSV/PDF/impressao quando essas rotinas forem finalizadas.
- [ ] Implementar paginação, filtros e ordenacao server-side nas tabelas de pedidos.
- [ ] Implementar cancelamento por UI dedicada com justificativa obrigatoria, se a troca generica de status nao for suficiente.
- [ ] Implementar duplicacao de pedido.
- [ ] Implementar tela para permissoes individuais (`UserPermission`).
- [ ] Implementar exportacao CSV dos relatorios.
- [ ] Implementar exportacao PDF/impressao profissional do pedido.
- [ ] Implementar rate limit persistente para login.
- [ ] Avaliar se usuarios devem aceitar multiplos perfis na interface ou manter selecao unica.
- [ ] Melhorar mensagens de sucesso/erro das acoes inline em tabelas editaveis.

## Baixa Prioridade

- [ ] Revisar layout do formulario de alteracao de status para exibir `Pedido SAP` apenas quando `Aprovado` estiver selecionado, se a experiencia atual ficar confusa.
- [ ] Melhorar estados de loading/skeleton nas tabelas.
- [ ] Refinar layout de impressao.
- [ ] Revisar copy e mensagens de erro para padronizacao completa em portugues.
- [ ] Automatizar backup PostgreSQL no servidor Linux via timer do systemd ou cron.
- [ ] Documentar rotina operacional curta para atualizacao de versao no servidor Linux.

## Controle de Ponto de Acesso Veicular - A Implementar se Escopo For Confirmado

- [ ] Confirmar oficialmente se o projeto seguira como **Pedidos Comerciais** ou se migrara para **Controle de Ponto de Acesso Veicular**.
- [ ] Se o escopo veicular for confirmado, planejar a migracao sem apagar funcionalidades uteis ja existentes.
- [ ] Modelar ponto de acesso.
- [ ] Modelar Commbox opcional.
- [ ] Modelar cameras por ponto de acesso.
- [ ] Modelar finalidade da camera: OCR dianteiro, OCR traseiro, OCR container.
- [ ] Implementar visualizacao RTSP/tempo real de camera.
- [ ] Implementar teste OCR diagnostico por camera.
- [ ] Garantir que teste OCR nao executa fluxo real.
- [ ] Implementar desenho e persistencia de ROI normalizada.
- [ ] Aplicar ROI no teste OCR.
- [ ] Aplicar ROI no fluxo real.
- [ ] Modelar fluxos configuraveis.
- [ ] Implementar tela de fluxos com exibicao resumida e expansao.
- [ ] Implementar triggers permitidos: OCR dianteiro, OCR traseiro, OCR container, Controle de acesso.
- [ ] Remover/impedir Input Commbox como trigger.
- [ ] Implementar condicoes: Input Commbox, Output Commbox, Lista Branca Veiculo, Lista Branca Motorista.
- [ ] Restringir condicoes Commbox a pontos com Commbox.
- [ ] Implementar acoes: Abrir Sessao, Fechar Sessao, Acionar Output da Commbox.
- [ ] Restringir acao de output a pontos com Commbox.
- [ ] Modelar sessoes veiculares.
- [ ] Implementar regra `ocrCapturedAt >= session.startedAt`.
- [ ] Implementar `listenerRunId` por listener OCR.
- [ ] Descartar OCR de listener antigo.
- [ ] Limpar OCR/imagens/frames/contexto/eventos/cache ao fechar sessao.
- [ ] Garantir sessao nova sem heranca de OCR anterior.
- [ ] Implementar reexecucao automatica do fluxo apos fechar sessao.
- [ ] Implementar tela de monitoramento com tabela inferior e detalhes superiores.
- [ ] Exibir cards OCR conforme configuracao do ponto de acesso.

## Concluido em 2026-07-16 - Perfis de Acesso

- [x] Migrar `Administrador` para `Administrator`.
- [x] Migrar `Representante` para `Representante Externo`.
- [x] Criar perfil `Analista`.
- [x] Atualizar matriz de permissões dos quatro perfis finais.
- [x] Bloquear Gestor de gerenciar usuários `Administrator`.
- [x] Bloquear Representante Externo de visualizar/editar pedidos de terceiros e editar fora de `RECEBIDO`.
- [x] Exigir `PEDIDO_APROVAR` para aprovação.
- [x] Ajustar seed idempotente de perfis e permissões.
- [x] Criar e aplicar migration `20260716153000_update_access_profiles`.

## Concluido em 2026-07-16 - Preco MP e Status

- [x] Adicionar Preço em cada item da Lista Técnica de Fechamento.
- [x] Persistir preço em `OrderRawMaterial.priceCents` sem alterar cadastro de matéria-prima.
- [x] Exibir preço no novo pedido, edição e detalhe/impressão.
- [x] Atualizar status ativos para Recebido, Aprovado, Em Criação, Pedido Criado, Enviado para Assinatura e Cancelado.
- [x] Remover Recusado dos novos fluxos e preservar como legado.
- [x] Ajustar regra de Pedido SAP por etapa.
- [x] Atualizar dashboard, badges e relatórios de status.
- [x] Criar e aplicar migration `20260716143000_add_raw_material_price_and_order_statuses`.

## Concluido em 2026-07-16

- [x] Criar cadastro de Tipos de Contrato.
- [x] Criar cadastro de Fechamentos de MP.
- [x] Criar cadastro de Matérias-Primas.
- [x] Adicionar permissões dos novos cadastros ao backend e menu.
- [x] Remover Código do Produto do schema, formulário, listagem, seed e pedidos.
- [x] Adicionar Tipo de Contrato e Fechamento de MP ao pedido.
- [x] Alterar Previsão de Retirada para mês/ano com armazenamento técnico no dia 01.
- [x] Adicionar Lista Técnica de Fechamento ao novo pedido e edição.
- [x] Implementar cadastro rápido de matéria-prima no pedido.
- [x] Recalcular e persistir TONS no backend com inteiros escalados.
- [x] Exibir novos campos e lista técnica no detalhe, listagens e relatórios existentes.
- [x] Criar e aplicar migration `20260716120000_add_contract_closing_and_raw_materials`.
- [x] Rodar Prisma format/validate/generate/migrate, seed, testes, typecheck, lint e build.

## Concluido Nesta Sessao

- [x] Adicionar opcao Novo cliente no pedido.
- [x] Adicionar opcao Novo produto no pedido.
- [x] Criar/reativar cliente por CNPJ durante salvamento do pedido.
- [x] Criar/reativar produto por codigo durante salvamento do pedido.
- [x] Adicionar testes de validacao para cliente/produto inline.
- [x] Criar cadastro de clientes com Cliente, Cidade e CNPJ.
- [x] Adicionar tela `/customers` para administrar clientes.
- [x] Alterar novo pedido para selecionar cliente cadastrado.
- [x] Criar migrations PostgreSQL de clientes e backfill dos pedidos existentes.
- [x] Adicionar permissoes `CLIENTE_*` e atualizar seed.
- [x] Corrigir exibicao indevida de `NEXT_REDIRECT` ao criar pedido.
- [x] Exibir mensagem `Pedido criado com sucesso.` na tela de detalhe apos criacao.
- [x] Adicionar campo `Pedido SAP` na aprovacao/alteracao de status do pedido.
- [x] Exigir `Pedido SAP` ao aprovar pedido.
- [x] Persistir e exibir `Pedido SAP` no detalhe do pedido.
- [x] Criar e aplicar migration `20260714142500_add_sap_order_number`.
- [x] Regenerar Prisma Client apos a alteracao do schema.
- [x] Validar schema Prisma e ESLint focado nos arquivos alterados.
- [x] Iniciar servidor Next.js em desenvolvimento em `http://localhost:3001`.
- [x] Implementar login social com Google e Microsoft/Office para usuarios existentes e ativos.
- [x] Implementar dupla autenticacao por codigo enviado por e-mail.
- [x] Configurar SMTP via `.env` sem registrar segredos reais na documentacao.
- [x] Implementar validacao de e-mail no cadastro/edicao de usuario com sintaxe e DNS MX.
- [x] Migrar Prisma de SQLite para PostgreSQL.
- [x] Criar backup do SQLite e exportacao JSON antes da migracao.
- [x] Criar baseline de migration PostgreSQL e preservar migrations SQLite em backup.
- [x] Criar scripts de exportacao SQLite, importacao PostgreSQL e validacao de migracao.
- [x] Criar scripts de backup/restauracao PostgreSQL com `pg_dump`/`pg_restore`.
- [x] Validar migracao SQLite para PostgreSQL antes do reset da base ativa.
- [x] Resetar banco PostgreSQL local para base limpa conforme solicitado.
- [x] Aplicar migrations e seed no PostgreSQL limpo.
- [x] Implementar bypass de 2FA por e-mail somente para o usuario `admin` em login interno.
- [x] Corrigir fluxo para nao limpar `mustChangePassword` apos validacao do codigo 2FA.
- [x] Garantir que usuarios nao-admin fiquem obrigados a trocar senha no primeiro acesso.
- [x] Implementar exclusao/inativacao segura de usuario.
- [x] Preparar documentacao Linux com systemd em `docs/DEPLOY_LINUX_SYSTEMD.md`.
- [x] Preparar pacote Linux em `release/pedidos-comercial-linux-2026-07-13-173252.tar.gz`.
- [x] Rodar validacoes principais: Prisma validate/generate/migrate deploy, lint, typecheck, testes e build.
- [x] Atualizar `CODEX_CONTEXT.md`, `TASKS.md` e `CHANGELOG_DEV.md` antes de fechar o terminal.

## Concluido em Sessoes Anteriores

- [x] Criar `CODEX_CONTEXT.md` como memoria tecnica do projeto.
- [x] Criar `TASKS.md` com checklist de pendencias.
- [x] Criar `CHANGELOG_DEV.md` com historico por data.
- [x] Registrar divergencia de escopo entre codigo atual de Pedidos Comerciais e contexto alvo de Ponto de Acesso Veicular.
- [x] Documentar arquitetura original: Next.js, Prisma, SQLite, autenticacao, permissoes, pedidos, cadastros, relatorios, auditoria e backup.
- [x] Implementar edicao de pedidos, historico campo a campo, bloqueio de edicao para pedidos aprovados/cancelados e remocao de exclusao de pedidos.
- [x] Implementar edicao/inativacao de embalagens e moedas.
- [x] Implementar edicao administrativa de usuarios e redefinicao de senha temporaria.
- [x] Reforcar troca obrigatoria de senha no primeiro login.

## Documentacao Permanente

- [x] Atualizar `CODEX_CONTEXT.md` a cada alteracao arquitetural ou regra critica.
- [x] Atualizar `TASKS.md` quando concluir ou adicionar tarefas.
- [x] Atualizar `CHANGELOG_DEV.md` a cada alteracao importante.
