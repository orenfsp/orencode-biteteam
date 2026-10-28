import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Users,
  FileCheck2,
  ClipboardList,
  Clock3,
  MapPin,
  Code2,
  Plus,
} from "lucide-react";
import { useApi, useAuth, date, labels } from "@/lib/api";
import { PageHead, QueryState, Status, Empty } from "@/components/common";
import { Button } from "@/components/ui/button";
export function Dashboard() {
  const { user } = useAuth(),
    query = useApi("/dashboard");
  const isAdmin = user.activeRole === "ADMIN",
    isJudge = user.activeRole === "JUDGE";
  return (
    <>
      <PageHead
        title="Обзор платформы"
        subtitle={`Добро пожаловать, ${user.fullName.replace("Демо · ", "").split(" ")[0]}. Всё важное — в одном месте.`}
      >
        {isAdmin && (
          <Button asChild>
            <Link to="/competitions/new">
              <Plus size={16} />
              Создать соревнование
            </Link>
          </Button>
        )}
      </PageHead>
      <QueryState query={query}>
        {(d) => (
          <>
            <div className="relative mb-6 overflow-hidden rounded-xl bg-[#232b38] p-7 text-white sm:p-8">
              <div className="relative z-10 max-w-xl">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[.15em] text-orange-300">
                  <span className="size-1.5 rounded-full bg-orange-400" />
                  СПОРТИВНОЕ ПРОГРАММИРОВАНИЕ
                </div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Одна платформа.
                  <br />
                  Больше возможностей.
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
                  Развиваем цифровой спорт Оренбуржья: от первой заявки до новых
                  достижений.
                </p>
                <Link
                  className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-orange-300"
                  to="/competitions"
                >
                  Перейти к соревнованиям <ArrowRight size={15} />
                </Link>
              </div>
              <Code2
                strokeWidth={0.7}
                className="absolute -right-8 top-0 size-64 -rotate-12 text-white/[.055] sm:right-10"
              />
            </div>
            <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                {
                  label: isAdmin
                    ? "Спортсменов в реестре"
                    : user.activeRole === "COACH"
                      ? "Мои спортсмены"
                      : isJudge
                        ? "Мои назначения"
                        : "Мои заявки",
                  value:
                    isAdmin || user.activeRole === "COACH"
                      ? d.athletes
                      : isJudge
                        ? d.assignments
                        : d.applications,
                  icon: Users,
                  href: isAdmin
                    ? "/registry"
                    : user.activeRole === "COACH"
                      ? "/connections"
                      : isJudge
                        ? "/assignments"
                        : "/competitions",
                  note: "Единый учёт участников",
                },
                {
                  label: "Соревнований",
                  value: d.competitions,
                  icon: CalendarDays,
                  href: "/competitions",
                  note: "В календаре федерации",
                },
                {
                  label: isJudge
                    ? "Новых уведомлений"
                    : "Заявки на рассмотрении",
                  value: isJudge ? d.unread : d.pending,
                  icon: ClipboardList,
                  href: isJudge ? "/notifications" : "/competitions",
                  note: isJudge ? "События вашего кабинета" : "Ожидают решения",
                },
                {
                  label: isJudge
                    ? "Завершённых назначений"
                    : "Опубликованных результатов",
                  value: isJudge ? d.completedAssignments : d.protocols,
                  icon: FileCheck2,
                  href: isAdmin
                    ? "/competitions"
                    : isJudge
                      ? "/assignments"
                      : user.activeRole === "COACH"
                        ? "/connections"
                        : "/results",
                  note: "В протоколах соревнований",
                },
              ].map((s) => (
                <Link
                  key={s.label}
                  to={s.href}
                  className="panel p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-orange-50 p-2.5 text-primary">
                      <s.icon size={18} />
                    </div>
                    <ArrowUpRight size={15} className="text-slate-300" />
                  </div>
                  <div className="stat-number mt-4">{s.value}</div>
                  <div className="mt-1 text-xs font-medium">{s.label}</div>
                  <div className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
                    {s.note}
                  </div>
                </Link>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
              <section className="panel">
                <div className="flex items-center justify-between border-b p-5">
                  <h2 className="font-semibold">Ближайшие соревнования</h2>
                  <Link
                    className="flex items-center gap-1 text-xs text-primary"
                    to="/competitions"
                  >
                    Все <ArrowRight size={14} />
                  </Link>
                </div>
                {d.upcoming.length ? (
                  d.upcoming.map((c: any) => (
                    <Link
                      to={"/competitions/" + c.id}
                      key={c.id}
                      className="flex gap-4 border-b p-5 last:border-0 hover:bg-slate-50"
                    >
                      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 text-xs">
                        <b className="text-lg leading-5">
                          {new Date(c.startsAt).getDate()}
                        </b>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.startsAt).toLocaleDateString("ru-RU", {
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 text-xs text-muted-foreground">
                          {c.discipline.name}
                        </div>
                        <h3 className="font-medium">{c.title}</h3>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {c.location}
                          </span>
                          <span>{labels[c.format]}</span>
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <Status value={c.status} />
                      </div>
                    </Link>
                  ))
                ) : (
                  <Empty text="Новых соревнований пока нет" />
                )}
              </section>
              <div className="space-y-6">
                <section className="panel">
                  <div className="flex items-center gap-2 border-b p-5">
                    <Clock3 size={16} className="text-primary" />
                    <h2 className="font-semibold">Последние события</h2>
                  </div>
                  {d.recent.map((n: any) => (
                    <Link
                      to={n.href}
                      key={n.id}
                      className="flex gap-3 border-b p-5 last:border-0 hover:bg-slate-50"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {date(n.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {!d.recent.length && <Empty text="Новых событий нет" />}
                </section>
                <section className="rounded-xl border border-orange-100 bg-orange-50/60 p-5">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <Code2 size={18} className="text-primary" />
                    Шесть дисциплин. Один спорт.
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Алгоритмы, продукты, искусственный интеллект, информационная
                    безопасность, робототехника и беспилотные системы.
                  </p>
                </section>
              </div>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
