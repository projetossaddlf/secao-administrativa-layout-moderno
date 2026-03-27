import crypto from "crypto";
import { prisma } from "../prisma";
import { env } from "../env";

export const createSessionToken = () => crypto.randomBytes(32).toString("base64url");

export const hashToken = (token: string) =>
  crypto.createHmac("sha256", env.COOKIE_SECRET).update(token).digest("hex");

export const createSession = async (userId: string) => {
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  return { token, expiresAt };
};

export const getSessionUser = async (token: string) => {
  const tokenHash = hashToken(token);
  const now = new Date();

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.isActive) return null;

  return session.user;
};

export const destroySession = async (token: string) => {
  const tokenHash = hashToken(token);
  await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
};
