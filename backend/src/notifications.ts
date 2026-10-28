import { db, notify, notifyAdmins } from "./lib.js";
// The application deliberately does not start an external delivery worker.
export type DeliveryMessage = {
  deliveryId: string;
  notificationId: string;
  userId: string;
  telegramChatId: string | null;
  event: string;
  title: string;
  body: string;
  href: string;
};
export type ExternalSender = (message: DeliveryMessage) => Promise<void>;
export async function deliverPending(sender: ExternalSender, limit = 25) {
  // One worker only. Multi-worker deployment will require row claiming / SKIP LOCKED.
  const deliveries = await db.outgoingDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: {
      notification: { include: { user: { select: { telegramChatId: true } } } },
    },
  });
  for (const d of deliveries) {
    const n = d.notification;
    if (!n.user.telegramChatId) continue;
    try {
      await sender({
        deliveryId: d.id,
        notificationId: n.id,
        userId: n.userId,
        telegramChatId: n.user.telegramChatId,
        event: n.event,
        title: n.title,
        body: n.body,
        href: n.href,
      });
      await db.outgoingDelivery.update({
        where: { id: d.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
    } catch (e) {
      const attempts = d.attempts + 1;
      await db.outgoingDelivery.update({
        where: { id: d.id },
        data: {
          status: attempts >= 5 ? "FAILED" : "PENDING",
          attempts,
          lastError: String(e).slice(0, 1000),
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 30000 * 2 ** attempts),
          ),
        },
      });
    }
  }
}
let checking = false;
export async function checkDeadlines() {
  if (checking) return;
  checking = true;
  try {
    const now = new Date(),
      soon = new Date(Date.now() + 3 * 86400000);
    const comps = await db.competition.findMany({
      where: { status: "OPEN", deadline: { lte: soon } },
      include: {
        applications: { where: { status: { in: ["PENDING", "APPROVED"] } } },
      },
    });
    for (const c of comps)
      await db.$transaction(async (tx) => {
        if (c.deadline <= now) {
          await tx.$queryRaw`SELECT id FROM "Competition" WHERE id = ${c.id} FOR UPDATE`;
          const changed = await tx.competition.updateMany({
            where: { id: c.id, status: "OPEN" },
            data: { status: "CLOSED" },
          });
          if (changed.count)
            await tx.auditLog.create({
              data: {
                action: "AUTO_CLOSE",
                entityType: "Competition",
                entityId: c.id,
                details: { source: "deadline-timer" },
              },
            });
          if (changed.count)
            await notifyAdmins(
              tx,
              "DEADLINE",
              "Приём заявок завершён",
              c.title,
              `/competitions/${c.id}`,
              `closed:${c.id}`,
            );
          return;
        }
        await notifyAdmins(
          tx,
          "DEADLINE",
          "Скоро окончание регистрации",
          c.title,
          `/competitions/${c.id}`,
          `deadline:${c.id}`,
        );
        const athletes = await tx.user.findMany({
          where: {
            roles: { has: "ATHLETE" },
            disciplineIds: { has: c.disciplineId },
          },
          select: { id: true, birthDate: true },
        });
        const { ageAt } = await import("./lib.js");
        const group = await tx.directory.findUniqueOrThrow({
          where: { id: c.ageGroupId },
        });
        for (const a of athletes) {
          const age = ageAt(a.birthDate, c.startsAt);
          if (age < (group.minAge ?? 0) || age > (group.maxAge ?? 120))
            continue;
          await notify(
            tx,
            a.id,
            "ATHLETE",
            "DEADLINE",
            "Скоро окончание регистрации",
            c.title,
            `/competitions/${c.id}`,
            `deadline:${c.id}:${a.id}`,
          );
          const links = await tx.coachLink.findMany({
            where: {
              athleteId: a.id,
              disciplineId: c.disciplineId,
              status: "ACTIVE",
            },
          });
          for (const l of links)
            await notify(
              tx,
              l.coachId,
              "COACH",
              "DEADLINE",
              "Дедлайн для подопечных",
              c.title,
              `/competitions/${c.id}`,
              `deadline:${c.id}:${l.coachId}`,
            );
        }
      });
    const users = await db.user.findMany({
      where: {
        OR: [
          {
            rankExpires: {
              gte: now,
              lte: new Date(Date.now() + 30 * 86400000),
            },
          },
          {
            categoryExpires: {
              gte: now,
              lte: new Date(Date.now() + 30 * 86400000),
            },
          },
        ],
      },
    });
    for (const u of users)
      await db.$transaction(async (tx) => {
        for (const [date, role, label] of [
          [u.rankExpires, "ATHLETE", "разряда"],
          [u.categoryExpires, "JUDGE", "судейской категории"],
        ] as const) {
          if (
            !date ||
            date < now ||
            date > new Date(Date.now() + 30 * 86400000) ||
            !u.roles.includes(role)
          )
            continue;
          const key = `expires:${role}:${u.id}:${date.toISOString()}`;
          await notify(
            tx,
            u.id,
            role,
            "EXPIRY",
            `Истекает срок ${label}`,
            date.toLocaleDateString("ru-RU"),
            "/profile",
            key,
          );
          await notifyAdmins(
            tx,
            "EXPIRY",
            `Истекает срок ${label}`,
            u.fullName,
            "/registry",
            key + ":admin",
          );
          if (role === "ATHLETE") {
            const links = await tx.coachLink.findMany({
              where: { athleteId: u.id, status: "ACTIVE" },
            });
            for (const l of links)
              await notify(
                tx,
                l.coachId,
                "COACH",
                "EXPIRY",
                "Истекает разряд подопечного",
                u.fullName,
                "/connections",
                key + ":coach:" + l.coachId,
              );
          }
        }
      });
    await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  } catch (e) {
    console.error("Deadline check failed", e);
  } finally {
    checking = false;
  }
}
