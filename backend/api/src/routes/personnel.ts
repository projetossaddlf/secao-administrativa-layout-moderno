import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { AuthedRequest, requireAuth, getManagerScopes, requireRole } from "../security/rbac";
import { CreatePersonnelSchema } from "../security/validators";
import { audit } from "../audit";

export const personnelRoutes = async (app: FastifyInstance) => {
  app.get("/personnel", async (req, reply) => {
    const r = req as AuthedRequest;
    requireAuth(r);

    if (r.user!.role === "ADMIN") {
      const items = await prisma.personnel.findMany({ orderBy: { ant: "asc" } });
      return reply.send({ items });
    }

    if (r.user!.role === "MANAGER") {
      const scopes = getManagerScopes(r);
      const items = await prisma.personnel.findMany({
        where: { unid: { in: scopes } },
        orderBy: { ant: "asc" },
      });
      return reply.send({ items });
    }

    const items = await prisma.personnel.findMany({
      where: { userId: r.user!.id },
      orderBy: { ant: "asc" },
    });
    return reply.send({ items });
  });

  app.post("/personnel", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN"] as any)(r);

    const body = CreatePersonnelSchema.parse(req.body);

    const p = await prisma.personnel.create({
      data: {
        ant: body.ant,
        grad: body.grad,
        quadro: body.quadro,
        nome: body.nome.toUpperCase(),
        matr: body.matr,
        unid: body.unid.toUpperCase(),
        secao: body.secao.toUpperCase(),
        situacao: body.situacao.toUpperCase(),
        esc: body.esc.toUpperCase(),
        saldoFerias: body.saldoFerias ?? 30,
        saldoAbono: body.saldoAbono ?? 5,
      },
    });

    if (body.createUser) {
      const role = (body.role ?? "USER") as any;
      const unit = body.unit ?? null;
      const unitScopes = body.unitScopes ?? [];

      const u = await prisma.user.create({
        data: {
          matriculaDigits: body.matr,
          name: body.nome.toUpperCase(),
          role,
          unit,
          unitScopes,
          isActive: true,
          mustChangePassword: true,
          passwordHash: null,
        },
      });

      await prisma.personnel.update({
        where: { id: p.id },
        data: { userId: u.id },
      });
    }

    await audit({
      userId: r.user!.id,
      action: "PERSONNEL_CREATE",
      target: p.id,
      meta: { matr: body.matr, nome: body.nome, unid: body.unid },
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any,
    });

    return reply.code(201).send({ item: p });
  });

  app.delete("/personnel/:id", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN"] as any)(r);

    const id = (req.params as any).id as string;

    await prisma.personnel.delete({ where: { id } });

    await audit({
      userId: r.user!.id,
      action: "PERSONNEL_DELETE",
      target: id,
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any,
    });

    return reply.send({ ok: true });
  });
};
