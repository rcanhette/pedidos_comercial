# Entidades

- `User`: usuário autenticável, dados pessoais, senha com hash, status e último acesso.
- `Session`: sessão segura por token hasheado.
- `Role`, `Permission`, `UserRole`, `RolePermission`, `UserPermission`: RBAC com overrides individuais.
- `Product`, `Package`, `Currency`: cadastros auxiliares com status ativo/inativo.
- `OrderNumberSequence`: sequência anual transacional para número do pedido.
- `Order`: pedido comercial com snapshots de representante, produto, embalagem e moeda.
- `OrderStatusHistory`: trilha de mudança de status.
- `OrderChangeHistory`: estrutura para alterações campo a campo.
- `AuditLog`: auditoria de ações importantes com JSON serializado em texto, sem dados sensíveis.
- `SystemSetting`: configurações como timezone.

SQLite usa inteiros escalados para valores: centavos, quantidade x1000 e cotação x10000.
