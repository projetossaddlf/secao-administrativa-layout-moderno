import { FastifyRequest } from "fastify";
import { Role } from "@prisma/client";

export type AuthedRequest = FastifyRequest & {
  user?: {
    id: string;
    role: Role;
    unit?: string | null;
    unitScopes: string[];
    matriculaDigits: string;
    name: string;
  };
};

export const requireAuth = (req: AuthedRequest) => {
  if (!req.user) {
    const err: any = new Error("Não autenticado.");
    err.statusCode = 401;
    throw err;
  }
};

export const requireRole = (roles: Role[]) => (req: AuthedRequest) => {
  requireAuth(req);
  if (!roles.includes(req.user!.role)) {
    const err: any = new Error("Sem permissão.");
    err.statusCode = 403;
    throw err;
  }
};

export const getManagerScopes = (req: AuthedRequest): string[] => {
  requireAuth(req);
  if (req.user!.role !== "MANAGER") return [];
  const scopes = req.user!.unitScopes?.length
    ? req.user!.unitScopes
    : req.user!.unit
      ? [req.user!.unit]
      : [];
  return scopes;
};
