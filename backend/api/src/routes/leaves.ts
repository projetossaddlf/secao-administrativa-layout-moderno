import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { AuthedRequest, requireAuth, getManagerScopes, requireRole } from "../security/rbac";
import { CreateLeaveSchema } from "../security/validators";
import { audit } from "../audit";

const normalizeType = (t: string) =>
  (t ?? "")
    .toUpperCase()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const daysInclusive = (start: Date, end: Date) => {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
};

const affectsSaldoFerias = (type: string) => {
  const t = normalizeType(type);
  return t === "FÉRIAS" || t === "FERIAS" || t === "ANTECIPAÇÃO" || t === "ANTECIPACAO";
};

const affectsSaldoAbono = (type: string) => {
  const t = normalizeType(type);
  return t === "ABONO";
};

export const leavesRoutes = async (app: FastifyInstance) => {
  app.get("/leaves", async (req, reply) => {
    const r = req as AuthedRequest;
    requireAuth(r);

    if (r.user!.role === "ADMIN") {
      const items = await prisma.leaveRecord.findMany({ orderBy: { createdAt: "desc" } });
      return reply.send({ items });
    }

    if (r.user!.role === "MANAGER") {
      const scopes = getManagerScopes(r);
      const ppl = await prisma.personnel.findMany({ where: { unid: { in: scopes } }, select: { id: true } });
      const ids = ppl.map((p) => p.id);

      const items = await prisma.leaveRecord.findMany({
        where: { personnelId: { in: ids } },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ items });
    }

    const mine = await prisma.personnel.findMany({ where: { userId: r.user!.id }, select: { id: true } });
    const ids = mine.map((p) => p.id);

    const items = await prisma.leaveRecord.findMany({
      where: { personnelId: { in: ids } },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ items });
  });

  app.post("/leaves", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN", "MANAGER"] as any)(r);

    const body = CreateLeaveSchema.parse(req.body);

    if (r.user!.role === "MANAGER") {
      const scopes = getManagerScopes(r);
      const p = await prisma.personnel.findUnique({ where: { id: body.personnelId } });
      if (!p || !scopes.includes(p.unid)) {
        return reply.code(403).send({ message: "Sem permissão para lançar para esta unidade." });
      }
    }

    const item = await prisma.leaveRecord.create({
      data: {
        personnelId: body.personnelId,
        type: normalizeType(body.type),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        notes: body.notes,
        createdById: r.user!.id,
      },
    });

    await audit({
      userId: r.user!.id,
      action: "LEAVE_CREATE",
      target: item.id,
      meta: { personnelId: body.personnelId, type: body.type },
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any,
    });

    return reply.code(201).send({ item });
  });

  app.delete("/leaves/:id", async (req, reply) => {
    const r = req as AuthedRequest;
    requireRole(["ADMIN", "MANAGER"] as any)(r);

    const id = (req.params as any).id as string;

    const leave = await prisma.leaveRecord.findUnique({ where: { id } });
    if (!leave) return reply.code(404).send({ message: "Lançamento não encontrado." });

    const p = await prisma.personnel.findUnique({ where: { id: leave.personnelId } });
    if (!p) return reply.code(404).send({ message: "Militar não encontrado." });

    if (r.user!.role === "MANAGER") {
      const scopes = getManagerScopes(r);
      if (!scopes.includes(p.unid)) {
        return reply.code(403).send({ message: "Sem permissão para deletar lançamento desta unidade." });
      }
    }

    const d = daysInclusive(leave.startDate, leave.endDate);
    const t = normalizeType(leave.type);

    const result = await prisma.$transaction(async (tx) => {
      let updatedPersonnel = p;

      if (affectsSaldoFerias(t)) {
        updatedPersonnel = await tx.personnel.update({
          where: { id: p.id },
          data: { saldoFerias: p.saldoFerias + d },
        });
      } else if (affectsSaldoAbono(t)) {
        updatedPersonnel = await tx.personnel.update({
          where: { id: p.id },
          data: { saldoAbono: p.saldoAbono + d },
        });
      }

      await tx.leaveRecord.delete({ where: { id: leave.id } });

      return { updatedPersonnel };
    });

    await audit({
      userId: r.user!.id,
      action: "LEAVE_DELETE",
      target: id,
      meta: { personnelId: leave.personnelId, type: t, daysReturned: (affectsSaldoFerias(t) || affectsSaldoAbono(t)) ? d : 0 },
      ip: req.ip,
      userAgent: req.headers["user-agent"] as any,
    });

    return reply.send({
      ok: true,
      daysReturned: (affectsSaldoFerias(t) || affectsSaldoAbono(t)) ? d : 0,
      personnel: result.updatedPersonnel,
    });
  });
};
