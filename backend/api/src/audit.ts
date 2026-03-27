import { prisma } from "./prisma";

export const audit = async (params: {
  userId?: string;
  action: string;
  target?: string;
  meta?: any;
  ip?: string;
  userAgent?: string;
}) => {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      target: params.target ?? null,
      meta: params.meta ?? undefined,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
};
