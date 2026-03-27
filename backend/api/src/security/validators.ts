import { z } from "zod";

export const digitsOnly = (s: string) => (s ?? "").replace(/\D/g, "");

export const LoginSchema = z.object({
  matricula: z.string().min(1).transform(digitsOnly),
  password: z.string().min(1),
});

export const FirstAccessSchema = z.object({
  matricula: z.string().min(1).transform(digitsOnly),
  newPassword: z.string().min(8),
});

export const CreatePersonnelSchema = z.object({
  ant: z.number().int().nonnegative(),
  grad: z.string().min(1).max(30),
  quadro: z.string().min(1).max(30),
  nome: z.string().min(2).max(120),
  matr: z.string().min(6).transform(digitsOnly),
  unid: z.string().min(1).max(40),
  secao: z.string().min(1).max(60),
  situacao: z.string().min(1).max(30),
  esc: z.string().min(1).max(20),

  saldoFerias: z.number().int().min(0).max(365).optional(),
  saldoAbono: z.number().int().min(0).max(365).optional(),

  // se quiser criar também o usuário de login
  createUser: z.boolean().optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
  unit: z.string().optional(),
  unitScopes: z.array(z.string()).optional(),
});

export const CreateLeaveSchema = z.object({
  personnelId: z.string().min(5),
  type: z.string().min(1).max(30),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const ImportSchema = z.object({
  items: z
    .array(
      CreatePersonnelSchema.omit({
        createUser: true,
        role: true,
        unit: true,
        unitScopes: true,
      })
    )
    .min(1)
    .max(5000),
});

export const RestoreSchema = z.object({
  users: z.array(z.any()).optional(),
  personnel: z.array(z.any()).optional(),
  leaves: z.array(z.any()).optional(),
});
