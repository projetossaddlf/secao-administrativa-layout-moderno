import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { AuthedRequest, requireRole } from "../security/rbac";
import { ImportSchema, RestoreSchema } from "../security/validators";
import { audit } from "../audit";

export const adminRoutes = async (app: FastifyInstance) => {
  app.post("/import", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN"] as any)(r);

    const body = ImportSchema.parse(req.body);

    const created = await prisma.$transaction(
      body.items.map((p) =>
        prisma.personnel.create({
          data: {
            ant: p.ant,
            grad: p.grad,
            quadro: p.quadro,
            nome: p.nome.toUpperCase(),
            matr: p.matr,
            unid: p.unid.toUpperCase(),
            secao: p.secao.toUpperCase(),
            situacao: p.situacao.toUpperCase(),
            esc: p.esc.toUpperCase(),
            saldoFerias: p.saldoFerias ?? 30,
            saldoAbono: p.saldoAbono ?? 5
          }
        })
      )
    );

    await audit({
      userId: r.user!.id,
      action: "IMPORT_PERSONNEL",
      meta: { count: created.length },
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any
    });

    return reply.send({ ok: true, created: created.length });
  });

  app.get("/backup", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN"] as any)(r);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        matriculaDigits: true,
        name: true,
        role: true,
        unit: true,
        unitScopes: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const personnel = await prisma.personnel.findMany();
    const leaves = await prisma.leaveRecord.findMany();

    await audit({
      userId: r.user!.id,
      action: "BACKUP_EXPORT",
      meta: { users: users.length, personnel: personnel.length, leaves: leaves.length },
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any
    });

    return reply.send({ users, personnel, leaves, exportedAt: new Date().toISOString() });
  });

  app.post("/restore", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN"] as any)(r);

    const body = RestoreSchema.parse(req.body);

    const personnel = Array.isArray(body.personnel) ? body.personnel : [];
    const leaves = Array.isArray(body.leaves) ? body.leaves : [];

    await prisma.$transaction(async (tx) => {
      for (const p of personnel) {
        if (!p?.matr) continue;
        await tx.personnel.create({
          data: {
            ant: Number(p.ant ?? 0),
            grad: String(p.grad ?? ""),
            quadro: String(p.quadro ?? ""),
            nome: String(p.nome ?? "").toUpperCase(),
            matr: String(p.matr ?? "").replace(/\D/g, ""),
            unid: String(p.unid ?? "").toUpperCase(),
            secao: String(p.secao ?? "").toUpperCase(),
            situacao: String(p.situacao ?? "").toUpperCase(),
            esc: String(p.esc ?? "").toUpperCase(),
            saldoFerias: Number(p.saldoFerias ?? 30),
            saldoAbono: Number(p.saldoAbono ?? 5)
          }
        });
      }

      for (const l of leaves) {
        if (!l?.personnelId || !l?.startDate || !l?.endDate) continue;
        await tx.leaveRecord.create({
          data: {
            personnelId: String(l.personnelId),
            type: String(l.type ?? "").toUpperCase(),
            startDate: new Date(String(l.startDate)),
            endDate: new Date(String(l.endDate)),
            notes: l.notes ? String(l.notes) : undefined,
            createdById: l.createdById ? String(l.createdById) : null
          }
        });
      }
    });

    await audit({
      userId: r.user!.id,
      action: "RESTORE_IMPORT",
      meta: { personnel: personnel.length, leaves: leaves.length },
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any
    });

    return reply.send({ ok: true });
  });
};
