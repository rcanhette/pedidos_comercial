import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { permissions, rolePermissionMap } from "../src/lib/permissions";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) throw new Error("Defina ADMIN_INITIAL_PASSWORD antes de executar o seed.");

  await prisma.systemSetting.upsert({
    where: { key: "APP_TIMEZONE" },
    update: { value: process.env.APP_TIMEZONE || "America/Sao_Paulo" },
    create: { key: "APP_TIMEZONE", value: process.env.APP_TIMEZONE || "America/Sao_Paulo" }
  });

  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: code.replaceAll("_", " ").toLowerCase() },
      create: { code, description: code.replaceAll("_", " ").toLowerCase() }
    });
  }

  for (const [name, codes] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { active: true, description: `Perfil ${name}` },
      create: { name, active: true, description: `Perfil ${name}` }
    });
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: perms.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
  }

  await prisma.role.updateMany({ where: { name: { in: ["Administrador", "Representante"] } }, data: { active: false } });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Administrator" } });
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { active: true },
    create: {
      fullName: "Administrador",
      username: "admin",
      email: "admin@local.test",
      phone: "(00) 00000-0000",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      active: true,
      mustChangePassword: true
    }
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id }
  });

  for (const currency of [
    { name: "Real", code: "BRL", symbol: "R$", decimalPlaces: 2 },
    { name: "Dólar americano", code: "USD", symbol: "US$", decimalPlaces: 2 },
    { name: "Euro", code: "EUR", symbol: "€", decimalPlaces: 2 }
  ]) {
    await prisma.currency.upsert({ where: { code: currency.code }, update: currency, create: currency });
  }

  for (const name of ["Saco", "Caixa", "Big Bag", "Granel"]) {
    await prisma.package.upsert({ where: { name }, update: { active: true }, create: { name, active: true } });
  }

  for (const product of [
    { name: "Produto demonstração Alfa", unit: "kg", description: "Produto fictício para testes" },
    { name: "Produto demonstração Beta", unit: "un", description: "Produto fictício para testes" },
    { name: "Produto demonstração Gama", unit: "t", description: "Produto fictício para testes" }
  ]) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: { ...product, active: true } });
    else await prisma.product.create({ data: { ...product, active: true } });
  }

  for (const name of ["Contrato padrão", "Não informado"]) {
    await prisma.contractType.upsert({ where: { name }, update: { active: true }, create: { name, active: true } });
  }

  for (const name of ["Fechamento padrão", "Não informado"]) {
    await prisma.rawMaterialClosing.upsert({ where: { name }, update: { active: true }, create: { name, active: true } });
  }

  for (const name of ["Matéria-prima demonstração"]) {
    await prisma.rawMaterial.upsert({ where: { name }, update: { active: true }, create: { name, active: true } });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
