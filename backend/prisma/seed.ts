import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
const db = new PrismaClient();
const id = (s: string) => {
  const h = createHash("sha256")
    .update("fsp-demo:" + s)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const at = (days: number) => new Date(Date.now() + days * 86400000);
async function main() {
  const dirs: Record<string, string[]> = {
    DISCIPLINE: [
      "Алгоритмическое программирование",
      "Продуктовое программирование",
      "Программирование систем информационной безопасности",
      "Программирование систем искусственного интеллекта",
      "Программирование робототехники",
      "Программирование беспилотных авиационных систем",
    ],
    MUNICIPALITY: ["Оренбург", "Орск", "Бузулук", "Новотроицк"],
    COMPETITION_TYPE: ["Чемпионат", "Первенство", "Кубок", "Турнир"],
    AGE_GROUP: [
      "Юниоры 14–17 лет",
      "Взрослые 18 лет и старше",
      "Открытая 6–99 лет",
    ],
    RANK: [
      "Без разряда",
      "III спортивный разряд",
      "II спортивный разряд",
      "I спортивный разряд",
      "Кандидат в мастера спорта",
    ],
    JUDGE_CATEGORY: [
      "Юный спортивный судья",
      "Третья категория",
      "Вторая категория",
      "Первая категория",
    ],
    JUDGE_POSITION: ["Главный судья", "Главный секретарь", "Судья"],
  };
  for (const [kind, names] of Object.entries(dirs))
    for (const [index, name] of names.entries())
      await db.directory.upsert({
        where: { id: id(`${kind}:${index}`) },
        update: {},
        create: {
          id: id(`${kind}:${index}`),
          kind,
          name,
          ...(kind === "AGE_GROUP"
            ? [
                { minAge: 14, maxAge: 17 },
                { minAge: 18, maxAge: 99 },
                { minAge: 6, maxAge: 99 },
              ][index]
            : {}),
        },
      });
  for (const [i, name] of [
    "Демо · Оренбургский клуб программирования",
    "Демо · Школа цифрового спорта",
    "Демо · Университет технологий",
  ].entries())
    await db.organization.upsert({
      where: { id: id("org:" + i) },
      update: {},
      create: {
        id: id("org:" + i),
        name,
        type: ["Клуб", "Спортивная школа", "Вуз"][i],
      },
    });
  const passwordHash = await bcrypt.hash("Demo2026!", 12);
  const users: [string, string, Role[], string][] = [
    ["admin", "Демо · Анна Соколова", ["ADMIN"], "1986-05-12"],
    ["athlete", "Демо · Максим Волков", ["ATHLETE"], "2004-03-14"],
    ["coach", "Демо · Алексей Морозов", ["COACH"], "1989-07-10"],
    ["judge", "Демо · Елена Кузнецова", ["JUDGE"], "1984-11-23"],
    [
      "multi",
      "Демо · Дмитрий Орлов",
      ["ATHLETE", "COACH", "JUDGE"],
      "2000-08-02",
    ],
    ["junior", "Демо · Софья Лебедева", ["ATHLETE"], "2011-04-15"],
    ["athlete2", "Демо · Артём Васильев", ["ATHLETE"], "2003-09-18"],
    ["athlete3", "Демо · Мария Белова", ["ATHLETE"], "2006-01-21"],
  ];
  for (const [key, fullName, roles, birth] of users) {
    const minor = key === "junior";
    await db.user.upsert({
      where: { email: `${key}@demo.fsp.local` },
      update: {},
      create: {
        id: id("user:" + key),
        email: `${key}@demo.fsp.local`,
        fullName,
        roles,
        birthDate: new Date(birth),
        passwordHash,
        organizationId: id("org:" + (minor ? 1 : 0)),
        municipalityId: id("MUNICIPALITY:0"),
        disciplineIds: [id("DISCIPLINE:0"), id("DISCIPLINE:1")],
        startYear: 2023,
        rankId: roles.includes("ATHLETE") ? id("RANK:2") : null,
        rankExpires: roles.includes("ATHLETE") ? at(20) : null,
        judgeCategoryId: roles.includes("JUDGE")
          ? id("JUDGE_CATEGORY:2")
          : null,
        categoryExpires: roles.includes("JUDGE") ? at(25) : null,
        consents: {
          create: {
            version: "2026-10-27",
            guardianConsent: minor,
            guardianName: minor ? "Демо · Ирина Лебедева" : null,
            guardianContact: minor ? "guardian@example.invalid" : null,
          },
        },
      },
    });
  }
  for (const athlete of ["athlete", "junior"])
    await db.coachLink.upsert({
      where: {
        coachId_athleteId_disciplineId: {
          coachId: id("user:coach"),
          athleteId: id("user:" + athlete),
          disciplineId: id("DISCIPLINE:0"),
        },
      },
      update: {},
      create: {
        id: id("link:" + athlete),
        coachId: id("user:coach"),
        athleteId: id("user:" + athlete),
        disciplineId: id("DISCIPLINE:0"),
        status: "ACTIVE",
      },
    });
  const events = [
    {
      key: "open",
      title: "Кубок Оренбуржья по программированию",
      status: "OPEN" as const,
      days: 14,
      discipline: 0,
      age: 2,
    },
    {
      key: "draft",
      title: "Продуктовый хакатон «Цифровой регион»",
      status: "DRAFT" as const,
      days: 30,
      discipline: 1,
      age: 2,
    },
    {
      key: "closed",
      title: "Первенство области · Финальный этап",
      status: "CLOSED" as const,
      days: 1,
      discipline: 0,
      age: 2,
    },
    {
      key: "completed",
      title: "Чемпионат области · Осенний сезон",
      status: "COMPLETED" as const,
      days: -20,
      discipline: 0,
      age: 2,
    },
    {
      key: "junior",
      title: "Юниорская лига спортивного программирования",
      status: "OPEN" as const,
      days: 21,
      discipline: 0,
      age: 0,
    },
  ];
  for (const e of events) {
    const exists = await db.competition.findUnique({
      where: { id: id("event:" + e.key) },
    });
    if (exists) continue;
    await db.$transaction(async (tx) => {
      const c = await tx.competition.create({
        data: {
          id: id("event:" + e.key),
          title: e.title,
          description:
            "Демонстрационное соревнование регионального отделения ФСП. Все участники и результаты фиктивные.",
          disciplineId: id("DISCIPLINE:" + e.discipline),
          typeId: id("COMPETITION_TYPE:2"),
          ageGroupId: id("AGE_GROUP:" + e.age),
          startsAt: at(e.days),
          endsAt: at(e.days + 1),
          deadline: at(e.days - 3),
          location: "Оренбург · Демо-площадка",
          format: "HYBRID",
          level: "REGIONAL",
          calendarPlan: "Календарный план Оренбургской области",
          calendarNumber: "ДЕМО-2026/042",
          status: e.status,
          protocolVersion: e.key === "completed" ? 1 : 0,
          publishedAt: e.key === "completed" ? at(e.days + 1) : null,
        },
      });
      if (e.key !== "draft")
        await tx.assignment.create({
          data: {
            competitionId: c.id,
            judgeId: id("user:judge"),
            positionId: id("JUDGE_POSITION:0"),
          },
        });
      if (["completed", "closed", "open"].includes(e.key)) {
        for (const [i, key] of ["athlete", "athlete2", "athlete3"].entries()) {
          await tx.application.create({
            data: {
              id: id(`app:${e.key}:${key}`),
              competitionId: c.id,
              athleteId: id("user:" + key),
              submittedBy: id("user:" + key),
              status: e.key === "open" ? "PENDING" : "APPROVED",
              ...(e.key === "completed"
                ? {
                    result: {
                      create: {
                        outcome: "FINISHED",
                        place: i + 1,
                        points: 100 - i * 20,
                      },
                    },
                  }
                : {}),
            },
          });
        }
      }
    });
  }
  for (const [key, , roles] of users) {
    for (const role of roles)
      await db.notification.upsert({
        where: { dedupeKey: `welcome:${key}:${role}` },
        update: {},
        create: {
          userId: id("user:" + key),
          role,
          title: "Добро пожаловать в платформу ФСП",
          body: "Это демонстрационная среда. Все персональные данные фиктивные.",
          event: "WELCOME",
          href: "/",
          dedupeKey: `welcome:${key}:${role}`,
          deliveries: { create: {} },
        },
      });
  }
  console.log(
    "Демо-данные готовы. admin / athlete / coach / judge / multi / junior @demo.fsp.local · пароль Demo2026!",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
