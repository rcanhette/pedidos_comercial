# Rotas

- `/login`: autenticação.
- `/dashboard`: indicadores e atalhos.
- `/orders/new`: novo pedido, exige `PEDIDO_CRIAR`.
- `/orders/my`: pedidos do usuário, exige `PEDIDO_VISUALIZAR_PROPRIOS`.
- `/orders/all`: todos os pedidos, exige `PEDIDO_VISUALIZAR_TODOS`.
- `/orders/[id]`: detalhes do pedido, com validação de escopo no servidor.
- `/products`: produtos, exige `PRODUTO_VISUALIZAR`.
- `/packages`: embalagens, exige `EMBALAGEM_VISUALIZAR`.
- `/currencies`: moedas, exige `MOEDA_VISUALIZAR`.
- `/users`: usuários, exige `USUARIO_VISUALIZAR`.
- `/roles`: perfis e permissões, exige `PERMISSAO_CONFIGURAR`.
- `/reports`: relatórios, exige `RELATORIO_VISUALIZAR`.
- `/audit`: auditoria, exige `HISTORICO_VISUALIZAR`.
- `/profile`: perfil do usuário autenticado.
