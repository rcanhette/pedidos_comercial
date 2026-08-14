import { z } from "zod";
import { freeTextSchema, optionalCpfSchema, optionalFreeTextSchema, passwordSchema } from "./common";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Informe usuário ou e-mail."),
  password: z.string().min(1, "Informe a senha.")
});

export const loginCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos.")
});

export const userCreateSchema = z
  .object({
    fullName: freeTextSchema(3, 150),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
    email: z.string().email(),
    phone: z.string().min(8).max(30),
    cpf: optionalCpfSchema,
    position: optionalFreeTextSchema(100),
    roleIds: z.array(z.string()).min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
    active: z.boolean().default(true)
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem."
  });


export const userUpdateSchema = z
  .object({
    fullName: freeTextSchema(3, 150),
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
    email: z.string().email(),
    phone: z.string().min(8).max(30),
    cpf: optionalCpfSchema,
    position: optionalFreeTextSchema(100),
    roleIds: z.array(z.string()).min(1),
    password: passwordSchema.optional(),
    confirmPassword: z.string().optional(),
    active: z.boolean().default(true)
  })
  .refine((data) => !data.password || data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem."
  });

export const profileSchema = z.object({
  fullName: freeTextSchema(3, 150),
  email: z.string().email(),
  phone: z.string().min(8).max(30),
  cpf: optionalCpfSchema,
  position: optionalFreeTextSchema(100),
  password: passwordSchema.optional().or(z.literal(""))
});
