INSERT INTO "Permission" ("id", "code", "description", "createdAt")
VALUES ('perm_meta_vendas_gerenciar', 'META_VENDAS_GERENCIAR', 'meta vendas gerenciar', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."code" = 'META_VENDAS_GERENCIAR'
WHERE r."name" IN ('Administrator', 'Gestor', 'Analista')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
