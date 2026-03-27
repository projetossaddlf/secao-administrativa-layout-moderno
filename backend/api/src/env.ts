import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(10),
  COOKIE_NAME: z.string().min(3).default("secadm_session"),
  COOKIE_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().min(3),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
});

export const env = EnvSchema.parse(process.env);
