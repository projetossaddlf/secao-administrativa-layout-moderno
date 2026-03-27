import Fastify from "fastify";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";

import { env } from "./env";
import { prisma } from "./prisma";
import { registerCors } from "./plugins/cors";
import { registerRateLimit } from "./plugins/rateLimit";
import { getSessionUser } from "./security/session";

import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { personnelRoutes } from "./routes/personnel";
import { leavesRoutes } from "./routes/leaves";
import { adminRoutes } from "./routes/admin";

const app = Fastify({ logger: true });

async function main() {
  await app.register(sensible);
  await app.register(cookie, { secret: env.COOKIE_SECRET });

  await registerCors(app);
  await registerRateLimit(app);

  // Middleware de autenticação via cookie
  app.addHook("preHandler", async (req: any) => {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) return;

    const user = await getSessionUser(token);
    if (!user) return;

    req.user = {
      id: user.id,
      role: user.role,
      unit: user.unit,
      unitScopes: user.unitScopes ?? [],
      matriculaDigits: user.matriculaDigits,
      name: user.name
    };
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(personnelRoutes);
  await app.register(leavesRoutes);
  await app.register(adminRoutes);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch(async (e) => {
  app.log.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
