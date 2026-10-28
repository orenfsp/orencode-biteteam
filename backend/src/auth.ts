import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import {
  db,
  route,
  fail,
  login,
  requireAuth,
  userSelect,
  dateString,
  ageAt,
  cookieOptions,
} from "./lib.js";
export const authRouter = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Слишком много попыток. Повторите позже." },
});
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(200)
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(100),
});
authRouter.post(
  "/login",
  limiter,
  route(async (req, res) => {
    const data = credentials.parse(req.body);
    const user = await db.user.findUnique({ where: { email: data.email } });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash)))
      fail(401, "Неверный email или пароль");
    if (req.cookies.fsp_session) {
      const { hash } = await import("./lib.js");
      await db.session.deleteMany({
        where: { id: hash(req.cookies.fsp_session) },
      });
    }
    await login(res, user!.id, user!.roles[0]);
    res.json({ ok: true });
  }),
);
authRouter.post(
  "/register",
  limiter,
  route(async (req, res) => {
    const data = credentials
      .extend({
        fullName: z.string().trim().min(3).max(150),
        birthDate: dateString,
        consent: z.literal(true),
        guardianName: z.string().trim().max(150).optional(),
        guardianContact: z.string().trim().max(200).optional(),
        guardianConsent: z.boolean().optional(),
      })
      .parse(req.body);
    const birthDate = new Date(data.birthDate);
    const age = ageAt(birthDate, new Date());
    if (age < 0 || age > 110) fail(400, "Проверьте дату рождения");
    if (
      age < 18 &&
      (!data.guardianConsent || !data.guardianName || !data.guardianContact)
    )
      fail(
        400,
        "Для несовершеннолетнего нужны данные и согласие представителя",
      );
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          birthDate,
          consents: {
            create: {
              version: "2026-10-27",
              guardianName: age < 18 ? data.guardianName : null,
              guardianContact: age < 18 ? data.guardianContact : null,
              guardianConsent: age < 18,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          role: "ATHLETE",
          action: "REGISTER",
          entityType: "User",
          entityId: user.id,
          details: { consentVersion: "2026-10-27" },
        },
      });
      return user;
    });
    await login(res, user.id, "ATHLETE");
    res.status(201).json({ ok: true });
  }),
);
authRouter.use(requireAuth);
authRouter.get(
  "/me",
  route(async (req, res) => {
    const user = await db.user.findUnique({
      where: { id: req.auth.userId },
      select: { ...userSelect, consents: true },
    });
    res.json({ ...user, activeRole: req.auth.role });
  }),
);
authRouter.post(
  "/role",
  route(async (req, res) => {
    const { role } = z
      .object({ role: z.enum(["ADMIN", "ATHLETE", "COACH", "JUDGE"]) })
      .parse(req.body);
    const user = await db.user.findUniqueOrThrow({
      where: { id: req.auth.userId },
    });
    if (!user.roles.includes(role)) fail(403, "Эта роль не назначена");
    await db.session.update({
      where: { id: req.auth.sessionId },
      data: { activeRole: role },
    });
    res.json({ ok: true });
  }),
);
authRouter.post(
  "/logout",
  route(async (req, res) => {
    await db.session.deleteMany({ where: { id: req.auth.sessionId } });
    res.clearCookie("fsp_session", cookieOptions).json({ ok: true });
  }),
);
