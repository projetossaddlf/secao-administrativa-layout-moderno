import { FastifyInstance } from "fastify";
import { AuthedRequest, requireAuth } from "../security/rbac";

export const meRoutes = async (app: FastifyInstance) => {
  app.get("/me", async (req, reply) => {
    const r = req as AuthedRequest;
    requireAuth(r);

    return reply.send({
      id: r.user!.id,
      name: r.user!.name,
      matriculaDigits: r.user!.matriculaDigits,
      role: r.user!.role,
      unit: r.user!.unit,
      unitScopes: r.user!.unitScopes,
    });
  });
};
