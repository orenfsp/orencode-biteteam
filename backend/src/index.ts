import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import multer from "multer";
import {
  db,
  requireAuth,
  route,
  fail,
  admin,
  pagination,
  HttpError,
  personSelect,
} from "./lib.js";
import { authRouter } from "./auth.js";
import {
  usersRouter,
  linksRouter,
  directoriesRouter,
  organizationsRouter,
} from "./users.js";
import { competitionsRouter } from "./competitions.js";
import { checkDeadlines } from "./notifications.js";
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(cookieParser());
app.use((req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== (process.env.APP_ORIGIN || "http://localhost:8080")
  )
    return res.status(403).json({ message: "Недопустимый источник запроса" });
  next();
});
app.get("/api/health", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
app.use("/api/auth", authRouter);
app.use("/api", requireAuth);
app.use("/api/users", usersRouter);
app.use("/api/coach-links", linksRouter);
app.use("/api/directories", directoriesRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/competitions", competitionsRouter);
app.get(
  "/api/notifications",
  route(async (req, res) => {
    const { skip, take, page, limit } = pagination(req);
    const where = { userId: req.auth.userId, role: req.auth.role };
    const [items, total, unread] = await Promise.all([
      db.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    res.json({ items, total, unread, page, limit });
  }),
);
app.patch(
  "/api/notifications/:id/read",
  route(async (req, res) => {
    const r = await db.notification.updateMany({
      where: {
        id: String(req.params.id),
        userId: req.auth.userId,
        role: req.auth.role,
      },
      data: { readAt: new Date() },
    });
    if (!r.count) fail(404, "Уведомление не найдено");
    res.json({ ok: true });
  }),
);
app.get(
  "/api/audit-log",
  route(async (req, res) => {
    admin(req);
    const { skip, take, page, limit } = pagination(req);
    const where: Prisma.AuditLogWhereInput = req.query.q
      ? {
          OR: [
            { action: { contains: String(req.query.q), mode: "insensitive" } },
            {
              actor: {
                fullName: {
                  contains: String(req.query.q),
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take,
        include: { actor: { select: personSelect } },
        orderBy: { createdAt: "desc" },
      }),
      db.auditLog.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
app.get(
  "/api/assignments",
  route(async (req, res) => {
    if (req.auth.role !== "JUDGE") fail(403, "Переключитесь в кабинет судьи");
    const { skip, take, page, limit } = pagination(req);
    const where = {
      judgeId: req.auth.userId,
      competition: { status: { not: "DRAFT" as const } },
    };
    const [items, total] = await Promise.all([
      db.assignment.findMany({
        where,
        skip,
        take,
        include: {
          position: true,
          competition: { include: { discipline: true } },
        },
        orderBy: { competition: { startsAt: "desc" } },
      }),
      db.assignment.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
app.get(
  "/api/dashboard",
  route(async (req, res) => {
    const role = req.auth.role,
      id = req.auth.userId;
    const competitionWhere: Prisma.CompetitionWhereInput = {
      status: { notIn: ["DRAFT", "CANCELLED"] },
    };
    const upcoming = await db.competition.findMany({
      where: {
        ...competitionWhere,
        status: { in: ["OPEN", "CLOSED"] },
        endsAt: { gte: new Date() },
        ...(role === "JUDGE" ? { assignments: { some: { judgeId: id } } } : {}),
      },
      include: {
        discipline: true,
        ageGroup: true,
        _count: { select: { applications: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 4,
    });
    const coachLinks =
      role === "COACH"
        ? await db.coachLink.findMany({
            where: { coachId: id, status: "ACTIVE" },
            select: { athleteId: true, disciplineId: true },
          })
        : [];
    const appWhere: Prisma.ApplicationWhereInput =
      role === "ADMIN"
        ? {}
        : role === "ATHLETE"
          ? { athleteId: id }
          : role === "COACH"
            ? {
                OR: coachLinks.map((l) => ({
                  athleteId: l.athleteId,
                  competition: { disciplineId: l.disciplineId },
                })),
              }
            : { id: "none" };
    const [athletes, competitions, applications, pending, protocols, unread] =
      await Promise.all([
        role === "ADMIN"
          ? db.user.count({ where: { roles: { has: "ATHLETE" } } })
          : role === "COACH"
            ? Promise.resolve(new Set(coachLinks.map((l) => l.athleteId)).size)
            : Promise.resolve(0),
        db.competition.count({ where: competitionWhere }),
        db.application.count({ where: appWhere }),
        db.application.count({ where: { ...appWhere, status: "PENDING" } }),
        db.application.count({
          where: {
            ...appWhere,
            status: "APPROVED",
            competition: { protocolVersion: { gt: 0 } },
          },
        }),
        db.notification.count({ where: { userId: id, role, readAt: null } }),
      ]);
    const recent = await db.notification.findMany({
      where: { userId: id, role },
      orderBy: { createdAt: "desc" },
      take: 4,
    });
    const assignments =
      role === "JUDGE"
        ? await db.assignment.count({
            where: { judgeId: id, competition: competitionWhere },
          })
        : 0;
    const completedAssignments =
      role === "JUDGE"
        ? await db.assignment.count({
            where: { judgeId: id, competition: { status: "COMPLETED" } },
          })
        : 0;
    res.json({
      assignments,
      completedAssignments,
      athletes,
      competitions,
      applications,
      pending,
      protocols,
      unread,
      upcoming,
      recent,
    });
  }),
);
app.use((_req, res) => res.status(404).json({ message: "Маршрут не найден" }));
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        message: "Проверьте заполнение полей",
        fields: error.flatten().fieldErrors,
      });
    if (error instanceof HttpError)
      return res.status(error.status).json({ message: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return res.status(409).json({ message: "Такая запись уже существует" });
      if (error.code === "P2025")
        return res.status(404).json({ message: "Запись не найдена" });
      if (error.code === "P2003")
        return res.status(400).json({ message: "Связанная запись не найдена" });
    }
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Файл больше 10 МБ"
            : error.message,
      });
    if (error?.message === "Разрешены только PDF и DOCX")
      return res.status(400).json({ message: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ message: "Некорректный JSON" });
    console.error(error);
    res.status(500).json({ message: "Ошибка сервера. Повторите попытку." });
  },
);
const server = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () => {
  console.log("FSP API ready");
  void checkDeadlines();
});
server.on("error", (error) => {
  console.error("Unable to listen:", error);
  process.exit(1);
});
const timer = setInterval(() => void checkDeadlines(), 60000);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
