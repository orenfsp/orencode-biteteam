import { Router } from "express";
import { z } from "zod";
import { Role, Prisma } from "@prisma/client";
import {
  db,
  route,
  admin,
  role,
  fail,
  userSelect,
  personSelect,
  pagination,
  canManageAthlete,
  audit,
  notify,
  notifyAdmins,
  dateString,
  directory,
  ageAt,
} from "./lib.js";
export const usersRouter = Router();
usersRouter.get(
  "/",
  route(async (req, res) => {
    role(req, "ADMIN", "COACH");
    const { skip, take, page, limit } = pagination(req);
    const q = String(req.query.q || "").slice(0, 100);
    const where: Prisma.UserWhereInput = {
      fullName: { contains: q, mode: "insensitive" },
      ...(req.auth.role === "COACH" ? { roles: { has: "ATHLETE" } } : {}),
      ...(req.query.role && req.auth.role === "ADMIN"
        ? { roles: { has: z.nativeEnum(Role).parse(req.query.role) } }
        : {}),
      ...(req.query.disciplineId
        ? { disciplineIds: { has: String(req.query.disciplineId) } }
        : {}),
      ...(req.query.organizationId
        ? { organizationId: String(req.query.organizationId) }
        : {}),
      ...(req.query.municipalityId
        ? { municipalityId: String(req.query.municipalityId) }
        : {}),
      ...(req.query.rankId ? { rankId: String(req.query.rankId) } : {}),
    };
    if (req.query.ageGroupId) {
      const g = await directory(db, String(req.query.ageGroupId), "AGE_GROUP");
      const today = new Date();
      const upper = new Date(
        Date.UTC(
          today.getUTCFullYear() - (g.minAge ?? 0),
          today.getUTCMonth(),
          today.getUTCDate() + 1,
        ),
      );
      const lower = new Date(
        Date.UTC(
          today.getUTCFullYear() - (g.maxAge ?? 120) - 1,
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      where.birthDate = { gt: lower, lt: upper };
    }
    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take,
        orderBy: { fullName: "asc" },
        select: req.auth.role === "ADMIN" ? userSelect : personSelect,
      }),
      db.user.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
usersRouter.get(
  "/:id",
  route(async (req, res) => {
    await canManageAthlete(db, req, String(req.params.id));
    const user = await db.user.findUnique({
      where: { id: String(req.params.id) },
      select: userSelect,
    });
    if (!user) fail(404, "Пользователь не найден");
    res.json(user);
  }),
);
usersRouter.patch(
  "/:id",
  route(async (req, res) => {
    const id = String(req.params.id);
    if (req.auth.role !== "ADMIN" && req.auth.userId !== id)
      fail(403, "Можно изменять только свой профиль");
    const nullableId = z.string().uuid().nullable();
    const data = z
      .object({
        fullName: z.string().trim().min(3).max(150).optional(),
        birthDate: dateString.optional(),
        organizationId: nullableId.optional(),
        municipalityId: nullableId.optional(),
        disciplineIds: z.array(z.string().uuid()).max(6).optional(),
        startYear: z
          .number()
          .int()
          .min(1950)
          .max(new Date().getFullYear())
          .nullable()
          .optional(),
        antidopingDate: dateString.nullable().optional(),
        antidopingUrl: z
          .union([
            z
              .string()
              .url()
              .refine((s) => /^https?:\/\//.test(s)),
            z.literal(""),
            z.null(),
          ])
          .optional(),
        rankId: nullableId.optional(),
        rankExpires: dateString.nullable().optional(),
        judgeCategoryId: nullableId.optional(),
        categoryExpires: dateString.nullable().optional(),
      })
      .strict()
      .parse(req.body);
    if (
      req.auth.role !== "ADMIN" &&
      [
        "rankId",
        "rankExpires",
        "judgeCategoryId",
        "categoryExpires",
        "birthDate",
      ].some((k) => k in data)
    )
      fail(403, "Разряды, категории и дату рождения изменяет федерация");
    const result = await db.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id } });
      if (data.birthDate) {
        const birth = new Date(data.birthDate),
          age = ageAt(birth, new Date());
        if (age < 0 || age > 110) fail(400, "Проверьте дату рождения");
        if (
          age < 18 &&
          !(await tx.consent.findFirst({
            where: { userId: id, guardianConsent: true },
          }))
        )
          fail(
            400,
            "Для этого возраста нужно сохранённое согласие представителя",
          );
      }
      for (const [key, kind] of [
        ["municipalityId", "MUNICIPALITY"],
        ["rankId", "RANK"],
        ["judgeCategoryId", "JUDGE_CATEGORY"],
      ] as const)
        if (data[key]) await directory(tx, data[key]!, kind, before[key]);
      for (const d of data.disciplineIds ?? [])
        await directory(
          tx,
          d,
          "DISCIPLINE",
          before.disciplineIds.includes(d) ? d : undefined,
        );
      if (data.organizationId) {
        const o = await tx.organization.findUnique({
          where: { id: data.organizationId },
        });
        if (!o || (!o.active && before.organizationId !== o.id))
          fail(400, "Организация недоступна");
      }
      const result = await tx.user.update({
        where: { id },
        data: {
          ...data,
          birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
          rankExpires:
            data.rankExpires === undefined
              ? undefined
              : data.rankExpires
                ? new Date(data.rankExpires)
                : null,
          categoryExpires:
            data.categoryExpires === undefined
              ? undefined
              : data.categoryExpires
                ? new Date(data.categoryExpires)
                : null,
          antidopingDate:
            data.antidopingDate === undefined
              ? undefined
              : data.antidopingDate
                ? new Date(data.antidopingDate)
                : null,
        },
        select: userSelect,
      });
      await audit(tx, req, "UPDATE", "User", id, { fields: Object.keys(data) });
      return result;
    });
    res.json(result);
  }),
);
usersRouter.put(
  "/:id/roles",
  route(async (req, res) => {
    admin(req);
    const id = String(req.params.id);
    const { roles } = z
      .object({ roles: z.array(z.nativeEnum(Role)).min(1) })
      .parse(req.body);
    if (id === req.auth.userId && !roles.includes("ADMIN"))
      fail(400, "Нельзя снять свою роль федерации");
    if (roles.includes("ADMIN")) {
      const existing = await db.user.findUniqueOrThrow({ where: { id } });
      if (!existing.roles.includes("ADMIN"))
        fail(
          400,
          "Назначение дополнительных администраторов в MVP выполняется через seed/базу",
        );
    }
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { roles: [...new Set(roles)] },
      });
      await audit(tx, req, "ROLES", "User", id, { roles });
    });
    res.json({ ok: true });
  }),
);
usersRouter.get(
  "/:id/results",
  route(async (req, res) => {
    const id = String(req.params.id);
    await canManageAthlete(db, req, id);
    const where: Prisma.ApplicationWhereInput = {
      athleteId: id,
      status: "APPROVED",
      competition: {
        protocolVersion: { gt: 0 },
        ...(req.auth.role === "COACH"
          ? {
              disciplineId: {
                in: (
                  await db.coachLink.findMany({
                    where: {
                      coachId: req.auth.userId,
                      athleteId: id,
                      status: "ACTIVE",
                    },
                    select: { disciplineId: true },
                  })
                ).map((l) => l.disciplineId),
              },
            }
          : {}),
      },
    };
    const { skip, take, page, limit } = pagination(req);
    const [items, total] = await Promise.all([
      db.application.findMany({
        where,
        skip,
        take,
        include: {
          result: true,
          competition: { include: { discipline: true } },
        },
        orderBy: { competition: { startsAt: "desc" } },
      }),
      db.application.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
export const linksRouter = Router();
linksRouter.get(
  "/",
  route(async (req, res) => {
    const where =
      req.auth.role === "ADMIN"
        ? {}
        : req.auth.role === "COACH"
          ? { coachId: req.auth.userId }
          : req.auth.role === "ATHLETE"
            ? { athleteId: req.auth.userId }
            : fail(403, "Нет доступа");
    const { skip, take, page, limit } = pagination(req);
    const [items, total] = await Promise.all([
      db.coachLink.findMany({
        where,
        skip,
        take,
        include: {
          coach: { select: personSelect },
          athlete: { select: personSelect },
          discipline: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.coachLink.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
linksRouter.post(
  "/",
  route(async (req, res) => {
    role(req, "COACH");
    const data = z
      .object({ athleteId: z.string().uuid(), disciplineId: z.string().uuid() })
      .parse(req.body);
    if (data.athleteId === req.auth.userId) fail(400, "Нельзя привязать себя");
    const link = await db.$transaction(async (tx) => {
      await directory(tx, data.disciplineId, "DISCIPLINE");
      const athlete = await tx.user.findUniqueOrThrow({
        where: { id: data.athleteId },
      });
      if (
        !athlete.roles.includes("ATHLETE") ||
        !athlete.disciplineIds.includes(data.disciplineId)
      )
        fail(400, "Спортсмен не занимается этой дисциплиной");
      const old = await tx.coachLink.findUnique({
        where: {
          coachId_athleteId_disciplineId: { coachId: req.auth.userId, ...data },
        },
      });
      if (old && ["ACTIVE", "PENDING"].includes(old.status))
        fail(409, "Запрос уже существует");
      const result = await tx.coachLink.upsert({
        where: {
          coachId_athleteId_disciplineId: { coachId: req.auth.userId, ...data },
        },
        create: { coachId: req.auth.userId, ...data },
        update: { status: "PENDING" },
      });
      await audit(tx, req, "REQUEST", "CoachLink", result.id);
      await notify(
        tx,
        data.athleteId,
        "ATHLETE",
        "COACH_REQUEST",
        "Запрос тренера",
        "Подтвердите привязку тренера в разделе «Тренеры».",
        "/connections",
      );
      return result;
    });
    res.status(201).json(link);
  }),
);
linksRouter.patch(
  "/:id",
  route(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["ACTIVE", "REJECTED", "ENDED"]) })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      const l = await tx.coachLink.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      });
      if (status === "ENDED") {
        if (l.status !== "ACTIVE") fail(400, "Связь не активна");
        if (
          !(
            (req.auth.role === "ATHLETE" && l.athleteId === req.auth.userId) ||
            (req.auth.role === "COACH" && l.coachId === req.auth.userId) ||
            req.auth.role === "ADMIN"
          )
        )
          fail(403, "Нет доступа");
      } else {
        role(req, "ATHLETE");
        if (l.athleteId !== req.auth.userId) fail(403, "Нет доступа");
        if (l.status !== "PENDING") fail(400, "Запрос уже обработан");
      }
      await tx.coachLink.update({ where: { id: l.id }, data: { status } });
      await audit(tx, req, status, "CoachLink", l.id);
      await notify(
        tx,
        l.coachId,
        "COACH",
        "COACH_LINK",
        "Связь со спортсменом обновлена",
        `Статус: ${status}`,
        "/connections",
      );
    });
    res.json({ ok: true });
  }),
);
export const directoriesRouter = Router();
directoriesRouter.get(
  "/",
  route(async (req, res) => {
    const items = await db.directory.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    res.json(items);
  }),
);
directoriesRouter.post(
  "/",
  route(async (req, res) => {
    admin(req);
    const data = z
      .object({
        kind: z.enum([
          "DISCIPLINE",
          "MUNICIPALITY",
          "COMPETITION_TYPE",
          "AGE_GROUP",
          "RANK",
          "JUDGE_CATEGORY",
          "JUDGE_POSITION",
        ]),
        name: z.string().trim().min(2).max(150),
        minAge: z.number().int().min(0).max(120).nullable().optional(),
        maxAge: z.number().int().min(0).max(120).nullable().optional(),
      })
      .parse(req.body);
    if (data.minAge != null && data.maxAge != null && data.minAge > data.maxAge)
      fail(400, "Минимальный возраст больше максимального");
    if (data.kind === "DISCIPLINE")
      fail(
        400,
        "В виде спорта предусмотрено шесть дисциплин; можно редактировать существующие",
      );
    const d = await db.$transaction(async (tx) => {
      const d = await tx.directory.create({ data });
      await audit(tx, req, "CREATE", "Directory", d.id);
      return d;
    });
    res.status(201).json(d);
  }),
);
directoriesRouter.patch(
  "/:id",
  route(async (req, res) => {
    admin(req);
    const data = z
      .object({
        name: z.string().trim().min(2).max(150).optional(),
        active: z.boolean().optional(),
        minAge: z.number().int().min(0).max(120).nullable().optional(),
        maxAge: z.number().int().min(0).max(120).nullable().optional(),
      })
      .parse(req.body);
    const d = await db.$transaction(async (tx) => {
      const old = await tx.directory.findUniqueOrThrow({
        where: { id: String(req.params.id) },
      });
      const merged = { ...old, ...data };
      if (
        merged.minAge != null &&
        merged.maxAge != null &&
        merged.minAge > merged.maxAge
      )
        fail(400, "Минимальный возраст больше максимального");
      if (
        old.kind === "AGE_GROUP" &&
        ("minAge" in data || "maxAge" in data) &&
        (await tx.competition.count({ where: { ageGroupId: old.id } }))
      )
        fail(409, "Для изменения границ используемой группы создайте новую");
      const d = await tx.directory.update({ where: { id: old.id }, data });
      await audit(tx, req, "UPDATE", "Directory", d.id, data);
      return d;
    });
    res.json(d);
  }),
);
export const organizationsRouter = Router();
organizationsRouter.get(
  "/",
  route(async (req, res) => {
    const { skip, take, page, limit } = pagination(req);
    const where = {
      name: {
        contains: String(req.query.q || ""),
        mode: "insensitive" as const,
      },
    };
    const [items, total] = await Promise.all([
      db.organization.findMany({ where, skip, take, orderBy: { name: "asc" } }),
      db.organization.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  }),
);
organizationsRouter.post(
  "/",
  route(async (req, res) => {
    admin(req);
    const data = z
      .object({
        name: z.string().trim().min(2).max(200),
        type: z.string().trim().min(2).max(100),
      })
      .parse(req.body);
    const o = await db.$transaction(async (tx) => {
      const o = await tx.organization.create({ data });
      await audit(tx, req, "CREATE", "Organization", o.id);
      return o;
    });
    res.status(201).json(o);
  }),
);
organizationsRouter.patch(
  "/:id",
  route(async (req, res) => {
    admin(req);
    const data = z
      .object({
        name: z.string().trim().min(2).max(200).optional(),
        type: z.string().trim().min(2).max(100).optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);
    const o = await db.$transaction(async (tx) => {
      const o = await tx.organization.update({
        where: { id: String(req.params.id) },
        data,
      });
      await audit(tx, req, "UPDATE", "Organization", o.id, data);
      return o;
    });
    res.json(o);
  }),
);
