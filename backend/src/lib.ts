import "dotenv/config";
import { PrismaClient, Prisma, Role } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
export const db = new PrismaClient();
export type Tx = Prisma.TransactionClient;
export type AuthRequest = Request & {
  auth: { userId: string; role: Role; sessionId: string };
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
export const route =
  (fn: (req: AuthRequest, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req as AuthRequest, res)).catch(next);
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
export async function login(res: Response, userId: string, role: Role) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: hash(token),
      userId,
      activeRole: role,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  res.cookie("fsp_session", token, { ...cookieOptions, maxAge: 7 * 86400000 });
}
// Middleware separate from route handlers so next() is explicit.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const session =
      req.cookies.fsp_session &&
      (await db.session.findUnique({
        where: { id: hash(req.cookies.fsp_session) },
        include: { user: { select: { roles: true } } },
      }));
    if (
      !session ||
      session.expiresAt < new Date() ||
      !session.user.roles.includes(session.activeRole)
    )
      return next(new HttpError(401, "Войдите в аккаунт"));
    (req as AuthRequest).auth = {
      userId: session.userId,
      role: session.activeRole,
      sessionId: session.id,
    };
    next();
  } catch (e) {
    next(e);
  }
}
export function admin(req: AuthRequest) {
  if (req.auth.role !== "ADMIN") fail(403, "Доступно только федерации");
}
export function role(req: AuthRequest, ...roles: Role[]) {
  if (!roles.includes(req.auth.role))
    fail(403, "Недостаточно прав в активном кабинете");
}
export const userSelect = {
  id: true,
  email: true,
  fullName: true,
  birthDate: true,
  roles: true,
  organizationId: true,
  organization: true,
  municipalityId: true,
  municipality: true,
  disciplineIds: true,
  startYear: true,
  rankId: true,
  rank: true,
  rankExpires: true,
  judgeCategoryId: true,
  judgeCategory: true,
  categoryExpires: true,
  antidopingDate: true,
  antidopingUrl: true,
  createdAt: true,
} as const;
export const personSelect = {
  id: true,
  fullName: true,
  organization: { select: { id: true, name: true } },
  disciplineIds: true,
} as const;
export const pagination = (req: Request) => {
  const page = Math.max(
    1,
    Math.min(100000, Math.trunc(Number(req.query.page)) || 1),
  );
  const limit = Math.max(
    1,
    Math.min(100, Math.trunc(Number(req.query.limit)) || 20),
  );
  return { skip: (page - 1) * limit, take: limit, page, limit };
};
export function ageAt(birth: Date, date: Date) {
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (
    date.getUTCMonth() < birth.getUTCMonth() ||
    (date.getUTCMonth() === birth.getUTCMonth() &&
      date.getUTCDate() < birth.getUTCDate())
  )
    age--;
  return age;
}
export const dateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Некорректная дата");
export async function directory(
  tx: Tx,
  id: string,
  kind: string,
  oldId?: string | null,
) {
  const d = await tx.directory.findUnique({ where: { id } });
  if (!d || d.kind !== kind || (!d.active && oldId !== id))
    fail(400, "Недоступное значение справочника: " + kind);
  return d!;
}
export async function audit(
  tx: Tx,
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId: string,
  details?: any,
) {
  await tx.auditLog.create({
    data: {
      actorId: req.auth.userId,
      role: req.auth.role,
      action,
      entityType,
      entityId,
      details: details ?? undefined,
    },
  });
}
export async function notify(
  tx: Tx,
  userId: string,
  targetRole: Role,
  event: string,
  title: string,
  body: string,
  href: string,
  key?: string,
) {
  await tx.notification.upsert({
    where: { dedupeKey: key ?? randomBytes(20).toString("hex") },
    update: {},
    create: {
      userId,
      role: targetRole,
      event,
      title,
      body,
      href,
      dedupeKey: key ?? randomBytes(20).toString("hex"),
      deliveries: { create: {} },
    },
  });
}
export async function notifyAdmins(
  tx: Tx,
  event: string,
  title: string,
  body: string,
  href: string,
  key?: string,
) {
  const users = await tx.user.findMany({
    where: { roles: { has: "ADMIN" } },
    select: { id: true },
  });
  for (const u of users)
    await notify(
      tx,
      u.id,
      "ADMIN",
      event,
      title,
      body,
      href,
      key ? `${key}:${u.id}` : undefined,
    );
}
export async function canManageAthlete(
  tx: Tx,
  req: AuthRequest,
  athleteId: string,
  disciplineId?: string,
) {
  if (
    req.auth.role === "ADMIN" ||
    (req.auth.role === "ATHLETE" && req.auth.userId === athleteId)
  )
    return;
  if (
    req.auth.role === "COACH" &&
    (await tx.coachLink.findFirst({
      where: {
        coachId: req.auth.userId,
        athleteId,
        status: "ACTIVE",
        ...(disciplineId ? { disciplineId } : {}),
      },
    }))
  )
    return;
  fail(403, "Нет доступа к этому спортсмену");
}
export async function lockCompetition(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Competition" WHERE id = ${id} FOR UPDATE`;
  const c = await tx.competition.findUnique({
    where: { id },
    include: { ageGroup: true, discipline: true, type: true },
  });
  if (!c) fail(404, "Соревнование не найдено");
  return c!;
}
