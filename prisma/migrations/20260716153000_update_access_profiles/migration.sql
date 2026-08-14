DO $$
DECLARE
  old_id TEXT;
  new_id TEXT;
BEGIN
  SELECT id INTO old_id FROM "Role" WHERE name = 'Administrador';
  SELECT id INTO new_id FROM "Role" WHERE name = 'Administrator';
  IF old_id IS NOT NULL AND new_id IS NULL THEN
    UPDATE "Role" SET name = 'Administrator', description = 'Perfil Administrator', active = true WHERE id = old_id;
  ELSIF old_id IS NOT NULL AND new_id IS NOT NULL THEN
    INSERT INTO "UserRole" ("userId", "roleId")
    SELECT "userId", new_id FROM "UserRole" WHERE "roleId" = old_id
    ON CONFLICT DO NOTHING;
    DELETE FROM "UserRole" WHERE "roleId" = old_id;
    DELETE FROM "RolePermission" WHERE "roleId" = old_id;
    DELETE FROM "Role" WHERE id = old_id;
  END IF;

  SELECT id INTO old_id FROM "Role" WHERE name = 'Representante';
  SELECT id INTO new_id FROM "Role" WHERE name = 'Representante Externo';
  IF old_id IS NOT NULL AND new_id IS NULL THEN
    UPDATE "Role" SET name = 'Representante Externo', description = 'Perfil Representante Externo', active = true WHERE id = old_id;
  ELSIF old_id IS NOT NULL AND new_id IS NOT NULL THEN
    INSERT INTO "UserRole" ("userId", "roleId")
    SELECT "userId", new_id FROM "UserRole" WHERE "roleId" = old_id
    ON CONFLICT DO NOTHING;
    DELETE FROM "UserRole" WHERE "roleId" = old_id;
    DELETE FROM "RolePermission" WHERE "roleId" = old_id;
    DELETE FROM "Role" WHERE id = old_id;
  END IF;
END $$;
