import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Search,
  ArrowUpRight,
  UserRound,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import {
  useApi,
  useAction,
  useAuth,
  qs,
  date,
  roles,
  labels,
  type Data,
} from "@/lib/api";
import {
  PageHead,
  QueryState,
  Status,
  Empty,
  Pagination,
  Form,
  type FieldDef,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function Profile() {
  const { id } = useParams(),
    { user } = useAuth(),
    target = id || user.id;
  const query = useApi("/users/" + target),
    dirs = useApi("/directories"),
    orgs = useApi("/organizations?limit=100"),
    action = useAction();
  if (dirs.isPending || dirs.isError)
    return <QueryState query={dirs}>{() => null}</QueryState>;
  if (orgs.isPending || orgs.isError)
    return <QueryState query={orgs}>{() => null}</QueryState>;
  const isAdmin = user.activeRole === "ADMIN",
    self = target === user.id;
  return (
    <QueryState query={query}>
      {(u) => {
        const options = (kind: string) =>
          (dirs.data || []).filter(
            (d: any) =>
              d.kind === kind &&
              (d.active ||
                [
                  u.municipalityId,
                  u.rankId,
                  u.judgeCategoryId,
                  ...u.disciplineIds,
                ].includes(d.id)),
          );
        const fields: FieldDef[] = [
          { key: "fullName", label: "ФИО", required: true, full: true },
          ...(isAdmin
            ? [
                {
                  key: "birthDate",
                  label: "Дата рождения",
                  type: "date",
                  required: true,
                },
              ]
            : []),
          {
            key: "organizationId",
            label: "Организация",
            type: "select",
            options: [
              { id: "", name: "Без организации" },
              ...(orgs.data?.items || []).filter(
                (o: any) => o.active || o.id === u.organizationId,
              ),
            ],
          },
          {
            key: "municipalityId",
            label: "Муниципалитет",
            type: "select",
            options: options("MUNICIPALITY"),
          },
          { key: "startYear", label: "Год начала занятий", type: "number" },
          {
            key: "disciplineIds",
            label: "Дисциплины",
            type: "multi",
            options: options("DISCIPLINE"),
            full: true,
          },
          { key: "antidopingDate", label: "Курс РУСАДА пройден", type: "date" },
          { key: "antidopingUrl", label: "Ссылка на сертификат", type: "url" },
          ...(isAdmin
            ? [
                {
                  key: "rankId",
                  label: "Разряд",
                  type: "select",
                  options: options("RANK"),
                },
                {
                  key: "rankExpires",
                  label: "Разряд действует до",
                  type: "date",
                },
                {
                  key: "judgeCategoryId",
                  label: "Судейская категория",
                  type: "select",
                  options: options("JUDGE_CATEGORY"),
                },
                {
                  key: "categoryExpires",
                  label: "Категория действует до",
                  type: "date",
                },
              ]
            : []),
        ];
        return (
          <>
            <PageHead
              title={self ? "Мой профиль" : "Профиль пользователя"}
              subtitle="Личные данные, дисциплины и спортивная квалификация"
              back={id ? "/registry" : undefined}
            />
            <div className="grid items-start gap-6 xl:grid-cols-[1fr_2fr]">
              <aside className="space-y-5">
                <div className="panel p-6">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-xl bg-orange-50 text-primary">
                    <UserRound size={30} strokeWidth={1.5} />
                  </div>
                  <h2 className="text-lg font-semibold">{u.fullName}</h2>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {u.email}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {u.roles.map((r: string) => (
                      <span
                        key={r}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px]"
                      >
                        {roles[r]}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 space-y-3 border-t pt-5 text-sm">
                    <p>
                      <span className="text-xs text-muted-foreground">
                        Дата рождения
                      </span>
                      <br />
                      {date(u.birthDate)}
                    </p>
                    <p>
                      <span className="text-xs text-muted-foreground">
                        Разряд
                      </span>
                      <br />
                      {u.rank?.name || "Не указан"}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Действует до {date(u.rankExpires)}
                      </span>
                    </p>
                    <p>
                      <span className="text-xs text-muted-foreground">
                        Категория судьи
                      </span>
                      <br />
                      {u.judgeCategory?.name || "Не указана"}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Действует до {date(u.categoryExpires)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="panel p-5">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <ShieldCheck size={16} className="text-primary" />
                    Антидопинг
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    Актуальные материалы и онлайн-курс доступны на официальном
                    сайте РУСАДА.
                  </p>
                  <a
                    className="flex items-center gap-1 text-xs text-primary"
                    href="https://rusada.ru"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Перейти на rusada.ru <ExternalLink size={12} />
                  </a>
                </div>
                {self && (
                  <div className="panel p-5">
                    <p className="mb-2 text-sm font-semibold">
                      Согласие на обработку данных
                    </p>
                    {user.consents?.map((c: any) => (
                      <p
                        key={c.id}
                        className="text-xs leading-relaxed text-muted-foreground"
                      >
                        Принято {date(c.acceptedAt)} · версия {c.version}
                        {c.guardianConsent && (
                          <>
                            <br />
                            Представитель: {c.guardianName}
                            <br />
                            {c.guardianContact}
                          </>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </aside>
              <div className="space-y-5">
                <div className="panel p-6">
                  <h2 className="mb-6 font-semibold">Основная информация</h2>
                  <Form
                    key={u.id}
                    fields={fields}
                    initial={u}
                    pending={action.isPending}
                    onSubmit={(d) => {
                      const body = { ...d };
                      for (const k of [
                        "organizationId",
                        "municipalityId",
                        "rankId",
                        "judgeCategoryId",
                        "rankExpires",
                        "categoryExpires",
                        "antidopingDate",
                      ])
                        if (k in body) body[k] = body[k] || null;
                      body.startYear = body.startYear
                        ? Number(body.startYear)
                        : null;
                      action.mutate({
                        path: "/users/" + u.id,
                        method: "PATCH",
                        body,
                      });
                    }}
                  />
                </div>
                {isAdmin && (
                  <div className="panel p-6">
                    <h2 className="mb-4 font-semibold">Роли аккаунта</h2>
                    <Form
                      key={u.id + u.roles.join()}
                      initial={{ roles: u.roles }}
                      fields={[
                        {
                          key: "roles",
                          label: "Доступные кабинеты",
                          type: "multi",
                          options: [
                            "ATHLETE",
                            "COACH",
                            "JUDGE",
                            ...(u.roles.includes("ADMIN") ? ["ADMIN"] : []),
                          ].map((id) => ({ id, name: roles[id] })),
                          required: true,
                          full: true,
                        },
                      ]}
                      pending={action.isPending}
                      submit="Обновить роли"
                      onSubmit={(body) =>
                        action.mutate({
                          path: `/users/${u.id}/roles`,
                          method: "PUT",
                          body,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}
export function Registry() {
  const [q, setQ] = useState(""),
    [role, setRole] = useState(""),
    [disciplineId, setDiscipline] = useState(""),
    [organizationId, setOrganization] = useState(""),
    [municipalityId, setMunicipality] = useState(""),
    [rankId, setRank] = useState(""),
    [ageGroupId, setAge] = useState(""),
    [page, setPage] = useState(1);
  const query = useApi(
      "/users" +
        qs({
          q,
          role,
          disciplineId,
          organizationId,
          municipalityId,
          rankId,
          ageGroupId,
          page,
        }),
    ),
    dirs = useApi("/directories"),
    orgs = useApi("/organizations?limit=100");
  const opts = (kind: string) =>
    (dirs.data || []).filter((d: any) => d.kind === kind);
  return (
    <>
      <PageHead
        title="Реестр участников"
        subtitle="Спортсмены, тренеры и судьи Оренбургской области"
      />
      <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            aria-label="Поиск участника"
            className="pl-9"
            value={q}
            placeholder="ФИО участника…"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Роль"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все роли</option>
          {Object.entries(roles).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {[
          [disciplineId, setDiscipline, opts("DISCIPLINE"), "Все дисциплины"],
          [
            organizationId,
            setOrganization,
            orgs.data?.items || [],
            "Все организации",
          ],
          [
            municipalityId,
            setMunicipality,
            opts("MUNICIPALITY"),
            "Все муниципалитеты",
          ],
          [rankId, setRank, opts("RANK"), "Все разряды"],
          [ageGroupId, setAge, opts("AGE_GROUP"), "Все возрастные группы"],
        ].map(([value, set, options, title]: any) => (
          <select
            aria-label={title}
            key={title}
            value={value}
            onChange={(e) => {
              set(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{title}</option>
            {options.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ))}
      </div>
      <QueryState query={query}>
        {(d) => (
          <div className="panel">
            {d.items.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Участник</th>
                      <th>Роли</th>
                      <th>Организация</th>
                      <th>Муниципалитет</th>
                      <th>Разряд</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <Link
                            to={"/registry/" + u.id}
                            className="font-medium hover:text-primary"
                          >
                            {u.fullName}
                          </Link>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {u.email}
                          </div>
                        </td>
                        <td>
                          {u.roles.map((r: string) => roles[r]).join(", ")}
                        </td>
                        <td>{u.organization?.name || "Без организации"}</td>
                        <td>{u.municipality?.name || "—"}</td>
                        <td>{u.rank?.name || "—"}</td>
                        <td>
                          <Link
                            to={"/registry/" + u.id}
                            aria-label={"Открыть " + u.fullName}
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Участники не найдены" />
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </div>
        )}
      </QueryState>
    </>
  );
}
export function Connections() {
  const { user } = useAuth(),
    action = useAction();
  const [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState(""),
    [discipline, setDiscipline] = useState("");
  const query = useApi("/coach-links" + qs({ page })),
    search = useApi(
      "/users" + qs({ q, limit: 20 }),
      user.activeRole === "COACH" && q.length >= 2,
    ),
    dirs = useApi("/directories");
  return (
    <>
      <PageHead
        title={user.activeRole === "COACH" ? "Мои спортсмены" : "Мои тренеры"}
        subtitle="Подтверждённые связи по дисциплинам и запросы на привязку"
      />
      {user.activeRole === "COACH" && (
        <div className="panel mb-6 p-5">
          <h2 className="mb-4 font-semibold">Пригласить спортсмена</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="field min-w-48 flex-1">
              Поиск по ФИО
              <Input
                placeholder="Не менее двух символов"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected("");
                }}
              />
            </label>
            <label className="field min-w-48 flex-1">
              Спортсмен
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Выберите результат поиска</option>
                {search.data?.items.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} · {u.organization?.name || "Без организации"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field min-w-48 flex-1">
              Дисциплина
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
              >
                <option value="">Выберите дисциплину</option>
                {dirs.data
                  ?.filter((d: any) => d.kind === "DISCIPLINE" && d.active)
                  .map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              disabled={action.isPending || !selected || !discipline}
              onClick={() =>
                action.mutate({
                  path: "/coach-links",
                  body: { athleteId: selected, disciplineId: discipline },
                })
              }
            >
              Отправить запрос
            </Button>
          </div>
        </div>
      )}
      <QueryState query={query}>
        {(d) => (
          <div className="panel">
            {d.items.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        {user.activeRole === "COACH" ? "Спортсмен" : "Тренер"}
                      </th>
                      <th>Дисциплина</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((l: any) => (
                      <tr key={l.id}>
                        <td className="font-medium">
                          {user.activeRole === "COACH"
                            ? l.athlete.fullName
                            : l.coach.fullName}
                        </td>
                        <td>{l.discipline.name}</td>
                        <td>
                          <Status value={l.status} />
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {l.status === "PENDING" &&
                              user.activeRole === "ATHLETE" && (
                                <>
                                  {["ACTIVE", "REJECTED"].map((status) => (
                                    <Button
                                      key={status}
                                      size="sm"
                                      variant={
                                        status === "ACTIVE"
                                          ? "default"
                                          : "outline"
                                      }
                                      disabled={action.isPending}
                                      onClick={() =>
                                        action.mutate({
                                          path: "/coach-links/" + l.id,
                                          method: "PATCH",
                                          body: { status },
                                        })
                                      }
                                    >
                                      {status === "ACTIVE"
                                        ? "Подтвердить"
                                        : "Отклонить"}
                                    </Button>
                                  ))}
                                </>
                              )}
                            {l.status === "ACTIVE" && (
                              <>
                                {user.activeRole === "COACH" && (
                                  <Button asChild size="sm" variant="outline">
                                    <Link to={"/results/" + l.athleteId}>
                                      Результаты
                                    </Link>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={action.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Завершить связь с тренером / спортсменом?",
                                      )
                                    )
                                      action.mutate({
                                        path: "/coach-links/" + l.id,
                                        method: "PATCH",
                                        body: { status: "ENDED" },
                                      });
                                  }}
                                >
                                  Завершить связь
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Подтверждённых связей и запросов пока нет" />
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </div>
        )}
      </QueryState>
    </>
  );
}
export function Results() {
  const { athleteId } = useParams(),
    { user } = useAuth(),
    [page, setPage] = useState(1);
  const query = useApi(`/users/${athleteId || user.id}/results` + qs({ page }));
  return (
    <>
      <PageHead
        title="История выступлений"
        subtitle="Результаты из опубликованных протоколов"
        back={athleteId ? "/connections" : undefined}
      />
      <QueryState query={query}>
        {(d) => (
          <div className="panel">
            {d.items.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Соревнование</th>
                      <th>Дисциплина</th>
                      <th>Уровень</th>
                      <th>Дата</th>
                      <th>Место</th>
                      <th>Баллы</th>
                      <th>Протокол</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((a: any) => (
                      <tr key={a.id}>
                        <td>
                          <Link
                            className="font-medium hover:text-primary"
                            to={"/competitions/" + a.competitionId}
                          >
                            {a.competition.title}
                          </Link>
                        </td>
                        <td>{a.competition.discipline.name}</td>
                        <td>{labels[a.competition.level]}</td>
                        <td>{date(a.competition.startsAt)}</td>
                        <td>
                          {a.result?.place || labels[a.result?.outcome] || "—"}
                        </td>
                        <td>{a.result?.points ?? "—"}</td>
                        <td>
                          <a
                            className="text-primary"
                            href={`/api/competitions/${a.competitionId}/protocol`}
                          >
                            DOCX ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Опубликованных результатов пока нет" />
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </div>
        )}
      </QueryState>
    </>
  );
}
