import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} from "docx";
import {
  db,
  route,
  admin,
  role,
  fail,
  pagination,
  audit,
  notify,
  notifyAdmins,
  directory,
  dateString,
  personSelect,
  canManageAthlete,
  ageAt,
  lockCompetition,
} from "./lib.js";
export const competitionsRouter = Router();
export const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (
      ![".pdf", ".docx"].includes(path.extname(file.originalname).toLowerCase())
    )
      return cb(new Error("Разрешены только PDF и DOCX"));
    cb(null, true);
  },
});
const schema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(5000).default(""),
  disciplineId: z.string().uuid(),
  typeId: z.string().uuid(),
  ageGroupId: z.string().uuid(),
  startsAt: dateString,
  endsAt: dateString,
  deadline: dateString,
  location: z.string().trim().min(2).max(250),
  format: z.enum(["OFFLINE", "ONLINE", "HYBRID"]),
  level: z.enum(["REGIONAL", "INTERREGIONAL", "NATIONAL"]),
  calendarPlan: z.string().max(150).default(""),
  calendarNumber: z.string().max(100).default(""),
});
const include = {
  discipline: true,
  type: true,
  ageGroup: true,
  files: { select: { id: true, name: true, size: true } },
  _count: { select: { applications: true, assignments: true } },
} as const;
competitionsRouter.get(
  "/",
  route(async (req, res) => {
    const { skip, take, page, limit } = pagination(req);
    const where: Prisma.CompetitionWhereInput = {
      ...(req.auth.role === "ADMIN" ? {} : { status: { not: "DRAFT" } }),
      title: { contains: String(req.query.q || ""), mode: "insensitive" },
      ...(req.query.disciplineId
        ? { disciplineId: String(req.query.disciplineId) }
        : {}),
      ...(req.query.ageGroupId
        ? { ageGroupId: String(req.query.ageGroupId) }
        : {}),
      ...(req.query.status
        ? {
            status: z
              .enum(["DRAFT", "OPEN", "CLOSED", "COMPLETED", "CANCELLED"])
              .parse(req.query.status),
          }
        : {}),
    };
    if (req.auth.role !== "ADMIN" && req.query.status === "DRAFT")
      fail(403, "Черновики доступны федерации");
    if (req.query.eligible === "true") {
      role(req, "ATHLETE");
      const user = await db.user.findUniqueOrThrow({
        where: { id: req.auth.userId },
      });
      const all = await db.competition.findMany({
        where,
        include,
        orderBy: { startsAt: "asc" },
      });
      const filtered = all.filter((c) => {
        const age = ageAt(user.birthDate, c.startsAt);
        return (
          age >= (c.ageGroup.minAge ?? 0) && age <= (c.ageGroup.maxAge ?? 120)
        );
      });
      return res.json({
        items: filtered.slice(skip, skip + take),
        total: filtered.length,
        page,
        limit,
      });
    }
    const [items, total] = await Promise.all([
      db.competition.findMany({
        where,
        include,
        skip,
        take,
        orderBy: { startsAt: "asc" },
      }),
      db.competition.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
competitionsRouter.post(
  "/",
  route(async (req, res) => {
    admin(req);
    const data = schema.parse(req.body);
    if (
      new Date(data.endsAt) < new Date(data.startsAt) ||
      new Date(data.deadline) > new Date(data.startsAt)
    )
      fail(400, "Проверьте даты соревнования и дедлайн");
    const result = await db.$transaction(async (tx) => {
      for (const [id, kind] of [
        [data.disciplineId, "DISCIPLINE"],
        [data.typeId, "COMPETITION_TYPE"],
        [data.ageGroupId, "AGE_GROUP"],
      ])
        await directory(tx, id, kind);
      const c = await tx.competition.create({
        data: {
          ...data,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
          deadline: new Date(data.deadline),
        },
      });
      await audit(tx, req, "CREATE", "Competition", c.id);
      return c;
    });
    res.status(201).json(result);
  }),
);
competitionsRouter.get(
  "/:id",
  route(async (req, res) => {
    const c = await db.competition.findUnique({
      where: { id: String(req.params.id) },
      include: {
        ...include,
        assignments: {
          include: { judge: { select: personSelect }, position: true },
        },
      },
    });
    if (!c || (c.status === "DRAFT" && req.auth.role !== "ADMIN"))
      fail(404, "Соревнование не найдено");
    const applicationWhere: Prisma.ApplicationWhereInput = {
      competitionId: c!.id,
      ...(req.auth.role === "ADMIN"
        ? {}
        : req.auth.role === "ATHLETE"
          ? { athleteId: req.auth.userId }
          : req.auth.role === "COACH"
            ? {
                athlete: {
                  athleteLinks: {
                    some: {
                      coachId: req.auth.userId,
                      disciplineId: c!.disciplineId,
                      status: "ACTIVE",
                    },
                  },
                },
              }
            : { id: "none" }),
    };
    const applications = await db.application.findMany({
      where: applicationWhere,
      include: { athlete: { select: personSelect }, result: true },
      orderBy: { createdAt: "asc" },
    });
    const protocol =
      c!.protocolVersion > 0
        ? await db.application.findMany({
            where: { competitionId: c!.id, status: "APPROVED" },
            select: {
              id: true,
              athlete: { select: personSelect },
              result: true,
            },
            orderBy: { athlete: { fullName: "asc" } },
          })
        : [];
    const visibleApplications =
      req.auth.role === "ADMIN" || c!.protocolVersion > 0
        ? applications
        : applications.map((a) => ({ ...a, result: null }));
    res.json({ ...c, applications: visibleApplications, protocol });
  }),
);
competitionsRouter.patch(
  "/:id",
  route(async (req, res) => {
    admin(req);
    const data = schema.parse(req.body);
    if (
      new Date(data.endsAt) < new Date(data.startsAt) ||
      new Date(data.deadline) > new Date(data.startsAt)
    )
      fail(400, "Проверьте даты");
    await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      if (c.status !== "DRAFT")
        fail(409, "Редактирование карточки доступно только в черновике");
      for (const [id, kind, old] of [
        [data.disciplineId, "DISCIPLINE", c.disciplineId],
        [data.typeId, "COMPETITION_TYPE", c.typeId],
        [data.ageGroupId, "AGE_GROUP", c.ageGroupId],
      ])
        await directory(tx, id, kind, old);
      await tx.competition.update({
        where: { id: c.id },
        data: {
          ...data,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
          deadline: new Date(data.deadline),
        },
      });
      await audit(tx, req, "UPDATE", "Competition", c.id, data);
    });
    res.json({ ok: true });
  }),
);
competitionsRouter.post(
  "/:id/status",
  route(async (req, res) => {
    admin(req);
    const { status } = z
      .object({ status: z.enum(["OPEN", "CLOSED", "CANCELLED"]) })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      const allowed: Record<string, string[]> = {
        DRAFT: ["OPEN", "CANCELLED"],
        OPEN: ["CLOSED", "CANCELLED"],
        CLOSED: ["CANCELLED"],
        COMPLETED: [],
        CANCELLED: [],
      };
      if (!allowed[c.status].includes(status))
        fail(409, "Недопустимый переход статуса");
      if (status === "OPEN" && c.deadline <= new Date())
        fail(400, "Срок регистрации уже прошёл");
      await tx.competition.update({ where: { id: c.id }, data: { status } });
      await audit(tx, req, status, "Competition", c.id);
      if (status === "OPEN") {
        const athletes = await tx.user.findMany({
          where: {
            roles: { has: "ATHLETE" },
            disciplineIds: { has: c.disciplineId },
          },
          select: { id: true, birthDate: true },
        });
        for (const a of athletes) {
          const age = ageAt(a.birthDate, c.startsAt);
          if (
            age >= (c.ageGroup.minAge ?? 0) &&
            age <= (c.ageGroup.maxAge ?? 120)
          )
            await notify(
              tx,
              a.id,
              "ATHLETE",
              "REGISTRATION_OPEN",
              "Открыта регистрация",
              c.title,
              `/competitions/${c.id}`,
            );
        }
      }
      if (status === "CANCELLED") {
        const apps = await tx.application.findMany({
          where: {
            competitionId: c.id,
            status: { in: ["PENDING", "APPROVED"] },
          },
        });
        for (const a of apps)
          await notify(
            tx,
            a.athleteId,
            "ATHLETE",
            "COMPETITION_CANCELLED",
            "Соревнование отменено",
            c.title,
            `/competitions/${c.id}`,
          );
      }
    });
    res.json({ ok: true });
  }),
);
competitionsRouter.post(
  "/:id/applications",
  route(async (req, res) => {
    role(req, "ATHLETE", "COACH");
    const { athleteId } = z
      .object({ athleteId: z.string().uuid() })
      .parse(req.body);
    const result = await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      await canManageAthlete(tx, req, athleteId, c.disciplineId);
      if (c.status !== "OPEN" || c.deadline <= new Date())
        fail(400, "Приём заявок закрыт");
      const athlete = await tx.user.findUniqueOrThrow({
        where: { id: athleteId },
      });
      if (
        !athlete.roles.includes("ATHLETE") ||
        !athlete.disciplineIds.includes(c.disciplineId)
      )
        fail(400, "Укажите дисциплину соревнования в профиле спортсмена");
      const age = ageAt(athlete.birthDate, c.startsAt);
      if (age < (c.ageGroup.minAge ?? 0) || age > (c.ageGroup.maxAge ?? 120))
        fail(400, "Возраст не соответствует группе соревнования");
      const app = await tx.application.create({
        data: { competitionId: c.id, athleteId, submittedBy: req.auth.userId },
      });
      await audit(tx, req, "SUBMIT", "Application", app.id);
      await notifyAdmins(
        tx,
        "APPLICATION_SUBMITTED",
        "Новая заявка",
        `${athlete.fullName} · ${c.title}`,
        `/competitions/${c.id}`,
      );
      return app;
    });
    res.status(201).json(result);
  }),
);
competitionsRouter.patch(
  "/:id/applications/:applicationId",
  route(async (req, res) => {
    const data = z
      .object({
        status: z.enum(["APPROVED", "REJECTED", "WITHDRAWN"]),
        reason: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);
    if (data.status === "REJECTED" && !data.reason)
      fail(400, "Укажите причину отказа");
    await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      const a = await tx.application.findUniqueOrThrow({
        where: { id: String(req.params.applicationId) },
      });
      if (a.competitionId !== c.id) fail(404, "Заявка не найдена");
      if (
        c.protocolVersion > 0 ||
        ["COMPLETED", "CANCELLED"].includes(c.status)
      )
        fail(409, "Состав участников уже закрыт");
      if (data.status === "WITHDRAWN") {
        role(req, "ATHLETE", "COACH");
        await canManageAthlete(tx, req, a.athleteId, c.disciplineId);
        if (!["PENDING", "APPROVED"].includes(a.status))
          fail(409, "Заявку нельзя отозвать");
        if (c.deadline <= new Date() || c.status !== "OPEN")
          fail(409, "Срок отзыва заявки закончился");
      } else {
        admin(req);
        if (a.status !== "PENDING") fail(409, "Заявка уже рассмотрена");
      }
      await tx.result.deleteMany({ where: { applicationId: a.id } });
      await tx.application.update({ where: { id: a.id }, data });
      await audit(tx, req, data.status, "Application", a.id, {
        reason: data.reason,
      });
      await notify(
        tx,
        a.athleteId,
        "ATHLETE",
        "APPLICATION_STATUS",
        "Статус заявки изменён",
        `${c.title}: ${data.status === "APPROVED" ? "одобрена" : data.status === "REJECTED" ? "отклонена — " + data.reason : "отозвана"}`,
        `/competitions/${c.id}`,
      );
      if (a.submittedBy !== a.athleteId)
        await notify(
          tx,
          a.submittedBy,
          "COACH",
          "APPLICATION_STATUS",
          "Статус заявки подопечного изменён",
          c.title,
          `/competitions/${c.id}`,
        );
    });
    res.json({ ok: true });
  }),
);
competitionsRouter.post(
  "/:id/assignments",
  route(async (req, res) => {
    admin(req);
    const data = z
      .object({ judgeId: z.string().uuid(), positionId: z.string().uuid() })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      if (["COMPLETED", "CANCELLED"].includes(c.status))
        fail(409, "Назначения закрыты");
      await directory(tx, data.positionId, "JUDGE_POSITION");
      const judge = await tx.user.findUniqueOrThrow({
        where: { id: data.judgeId },
      });
      if (!judge.roles.includes("JUDGE"))
        fail(400, "У пользователя нет роли судьи");
      const a = await tx.assignment.upsert({
        where: {
          competitionId_judgeId: { competitionId: c.id, judgeId: data.judgeId },
        },
        create: { competitionId: c.id, ...data },
        update: { positionId: data.positionId },
      });
      await audit(tx, req, "ASSIGN", "Assignment", a.id, data);
      await notify(
        tx,
        data.judgeId,
        "JUDGE",
        "JUDGE_ASSIGNED",
        "Новое назначение",
        c.title,
        `/competitions/${c.id}`,
      );
    });
    res.json({ ok: true });
  }),
);
const resultsSchema = z.object({
  results: z
    .array(
      z.object({
        applicationId: z.string().uuid(),
        outcome: z.enum(["FINISHED", "DNS", "DSQ"]),
        place: z.number().int().positive().max(100000).nullable(),
        points: z.number().finite().min(0).max(1e12).nullable(),
      }),
    )
    .min(1)
    .max(1000),
});
competitionsRouter.put(
  "/:id/results",
  route(async (req, res) => {
    admin(req);
    const { results } = resultsSchema.parse(req.body);
    if (new Set(results.map((r) => r.applicationId)).size !== results.length)
      fail(400, "Участники не должны повторяться");
    await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      if (!["CLOSED", "COMPLETED"].includes(c.status))
        fail(409, "Сначала закройте приём заявок");
      const approved = await tx.application.findMany({
        where: { competitionId: c.id, status: "APPROVED" },
        include: { result: true },
      });
      for (const r of results) {
        if (!approved.some((a) => a.id === r.applicationId))
          fail(400, "Результат доступен только для одобренной заявки");
        if (r.outcome === "FINISHED" && (r.place === null || r.points === null))
          fail(400, "Для финишировавшего укажите место и баллы");
        const result = {
          outcome: r.outcome,
          place: r.outcome === "FINISHED" ? r.place : null,
          points: r.outcome === "FINISHED" ? r.points : null,
        };
        await tx.result.upsert({
          where: { applicationId: r.applicationId },
          create: { applicationId: r.applicationId, ...result },
          update: result,
        });
      }
      await audit(tx, req, "RESULTS", "Competition", c.id, {
        before: approved.map((a) => ({
          applicationId: a.id,
          result: a.result,
        })),
        after: results,
      });
      if (c.protocolVersion > 0) {
        await tx.competition.update({
          where: { id: c.id },
          data: { protocolVersion: { increment: 1 }, publishedAt: new Date() },
        });
        for (const a of approved)
          await notify(
            tx,
            a.athleteId,
            "ATHLETE",
            "PROTOCOL_UPDATED",
            "Протокол исправлен",
            c.title,
            `/competitions/${c.id}`,
          );
      }
    });
    res.json({ ok: true });
  }),
);
competitionsRouter.post(
  "/:id/publish",
  route(async (req, res) => {
    admin(req);
    await db.$transaction(async (tx) => {
      const c = await lockCompetition(tx, String(req.params.id));
      if (c.status !== "CLOSED" || c.protocolVersion > 0)
        fail(409, "Публикация доступна после закрытия регистрации");
      const apps = await tx.application.findMany({
        where: { competitionId: c.id, status: "APPROVED" },
        include: { result: true },
      });
      if (!apps.length || apps.some((a) => !a.result))
        fail(400, "Заполните исход для каждого одобренного участника");
      if (
        await tx.application.count({
          where: { competitionId: c.id, status: "PENDING" },
        })
      )
        fail(400, "Сначала рассмотрите все заявки");
      await tx.competition.update({
        where: { id: c.id },
        data: {
          status: "COMPLETED",
          protocolVersion: 1,
          publishedAt: new Date(),
        },
      });
      await audit(tx, req, "PUBLISH", "Competition", c.id, { version: 1 });
      for (const a of apps) {
        await notify(
          tx,
          a.athleteId,
          "ATHLETE",
          "PROTOCOL_PUBLISHED",
          "Опубликован протокол",
          c.title,
          `/competitions/${c.id}`,
        );
        const links = await tx.coachLink.findMany({
          where: {
            athleteId: a.athleteId,
            disciplineId: c.disciplineId,
            status: "ACTIVE",
          },
        });
        for (const l of links)
          await notify(
            tx,
            l.coachId,
            "COACH",
            "PROTOCOL_PUBLISHED",
            "Результат подопечного опубликован",
            c.title,
            `/competitions/${c.id}`,
            `protocol:1:${c.id}:${l.coachId}`,
          );
      }
    });
    res.json({ ok: true });
  }),
);
competitionsRouter.get(
  "/:id/protocol",
  route(async (req, res) => {
    const c = await db.competition.findUnique({
      where: { id: String(req.params.id) },
      include: {
        discipline: true,
        type: true,
        ageGroup: true,
        assignments: {
          include: { judge: { select: personSelect }, position: true },
        },
        applications: {
          where: { status: "APPROVED" },
          include: { athlete: { select: personSelect }, result: true },
        },
      },
    });
    if (!c || c.protocolVersion === 0) fail(404, "Протокол ещё не опубликован");
    const rows = [
      ["Место", "Участник", "Организация", "Баллы", "Исход"],
      ...c!.applications
        .sort(
          (a, b) =>
            (a.result?.place ?? 1e9) - (b.result?.place ?? 1e9) ||
            a.athlete.fullName.localeCompare(b.athlete.fullName, "ru"),
        )
        .map((a) => [
          a.result?.place?.toString() ?? "—",
          a.athlete.fullName,
          a.athlete.organization?.name ?? "Без организации",
          a.result?.points?.toString() ?? "—",
          a.result?.outcome === "DNS"
            ? "Неявка"
            : a.result?.outcome === "DSQ"
              ? "Дисквалификация"
              : "Завершил",
        ]),
    ];
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "Протокол соревнования",
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({ text: c!.title, heading: HeadingLevel.HEADING_1 }),
            ...[
              "Демонстрационная форма",
              `Версия ${c!.protocolVersion} · ${c!.publishedAt?.toLocaleDateString("ru-RU")}`,
              `${c!.discipline.name} · ${c!.type.name} · ${c!.ageGroup.name}`,
              `${c!.startsAt.toLocaleDateString("ru-RU")} — ${c!.endsAt.toLocaleDateString("ru-RU")} · ${c!.location}`,
              `Календарный план: ${c!.calendarPlan || "не указан"} ${c!.calendarNumber}`,
            ].map((text) => new Paragraph(text)),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows.map(
                (row, i) =>
                  new TableRow({
                    tableHeader: i === 0,
                    children: row.map(
                      (text) =>
                        new TableCell({ children: [new Paragraph(text)] }),
                    ),
                  }),
              ),
            }),
            new Paragraph({
              text: "Судейская коллегия",
              heading: HeadingLevel.HEADING_2,
            }),
            ...c!.assignments.map(
              (a) => new Paragraph(`${a.position.name}: ${a.judge.fullName}`),
            ),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    res
      .type(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .attachment(`protocol-v${c!.protocolVersion}.docx`)
      .send(buffer);
  }),
);
competitionsRouter.post(
  "/:id/files",
  (req, res, next) => {
    try {
      admin(req as any);
      next();
    } catch (e) {
      next(e);
    }
  },
  upload.single("file"),
  route(async (req, res) => {
    if (!req.file) fail(400, "Выберите файл");
    const f = req.file!;
    try {
      const result = await db.$transaction(async (tx) => {
        const c = await lockCompetition(tx, String(req.params.id));
        if (c.status !== "DRAFT") fail(409, "Положение загружается в черновик");
        const record = await tx.storedFile.create({
          data: {
            competitionId: c.id,
            name: Buffer.from(f.originalname, "latin1").toString("utf8"),
            storageName: f.filename,
            mimeType:
              path.extname(f.originalname).toLowerCase() === ".pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: f.size,
          },
        });
        await audit(tx, req, "UPLOAD", "StoredFile", record.id);
        return record;
      });
      res.status(201).json(result);
    } catch (e) {
      await unlink(f.path).catch(() => {});
      throw e;
    }
  }),
);
competitionsRouter.get(
  "/:id/files/:fileId",
  route(async (req, res) => {
    const f = await db.storedFile.findUnique({
      where: { id: String(req.params.fileId) },
      include: { competition: true },
    });
    if (
      !f ||
      f.competitionId !== String(req.params.id) ||
      (f.competition.status === "DRAFT" && req.auth.role !== "ADMIN")
    )
      fail(404, "Файл не найден");
    res
      .type(f!.mimeType)
      .download(path.join(uploadDir, f!.storageName), f!.name);
  }),
);
