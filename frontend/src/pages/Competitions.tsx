import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Search,
  MapPin,
  CalendarDays,
  Users,
  ArrowUpRight,
  Download,
  FileText,
  Upload,
  Pencil,
} from "lucide-react";
import {
  useApi,
  useAction,
  useAuth,
  qs,
  date,
  datetime,
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
export function Competitions() {
  const { user } = useAuth();
  const [q, setQ] = useState(""),
    [disciplineId, setDiscipline] = useState(""),
    [ageGroupId, setAgeGroup] = useState(""),
    [status, setStatus] = useState(""),
    [eligible, setEligible] = useState(false),
    [page, setPage] = useState(1);
  const dirs = useApi("/directories"),
    query = useApi(
      "/competitions" +
        qs({ q, disciplineId, ageGroupId, status, eligible, page }),
    );
  return (
    <>
      <PageHead
        title="Соревнования"
        subtitle="Календарь событий и регистрация на соревнования"
      >
        {user.activeRole === "ADMIN" && (
          <Button asChild>
            <Link to="/competitions/new">
              <Plus size={16} />
              Создать соревнование
            </Link>
          </Button>
        )}
      </PageHead>
      <div className="panel mb-6 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-48 flex-1">
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            aria-label="Поиск соревнования"
            className="pl-9"
            placeholder="Найти соревнование…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Дисциплина"
          className="sm:max-w-60"
          value={disciplineId}
          onChange={(e) => {
            setDiscipline(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все дисциплины</option>
          {dirs.data
            ?.filter((d: any) => d.kind === "DISCIPLINE")
            .map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
        <select
          aria-label="Возрастная группа"
          className="sm:max-w-52"
          value={ageGroupId}
          onChange={(e) => {
            setAgeGroup(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все возрастные группы</option>
          {dirs.data
            ?.filter((d: any) => d.kind === "AGE_GROUP")
            .map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
        <select
          aria-label="Статус"
          className="sm:max-w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          {[
            "OPEN",
            "CLOSED",
            "COMPLETED",
            "CANCELLED",
            ...(user.activeRole === "ADMIN" ? ["DRAFT"] : []),
          ].map((v) => (
            <option key={v} value={v}>
              {labels[v]}
            </option>
          ))}
        </select>
        {user.activeRole === "ATHLETE" && (
          <label className="flex items-center gap-2 px-2 text-xs">
            <input
              type="checkbox"
              checked={eligible}
              onChange={(e) => {
                setEligible(e.target.checked);
                setPage(1);
              }}
            />
            Подходят по возрасту
          </label>
        )}
      </div>
      <QueryState query={query}>
        {(d) => (
          <>
            {d.items.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {d.items.map((c: any) => (
                  <Link
                    to={"/competitions/" + c.id}
                    key={c.id}
                    className="panel group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between border-b bg-gradient-to-br from-slate-50 to-orange-50/30 p-5">
                      <div className="rounded-lg border bg-white p-3 text-primary">
                        <CalendarDays size={23} strokeWidth={1.5} />
                      </div>
                      <Status value={c.status} />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="mb-2 text-[11px] text-primary">
                        {c.discipline.name}
                      </p>
                      <h2 className="mb-4 text-base font-semibold group-hover:text-primary">
                        {c.title}
                      </h2>
                      <div className="mb-4 space-y-2.5 text-xs text-muted-foreground">
                        <p className="flex gap-2">
                          <CalendarDays size={14} />
                          {date(c.startsAt)} — {date(c.endsAt)}
                        </p>
                        <p className="flex gap-2">
                          <MapPin size={14} />
                          {c.location}
                        </p>
                        <p className="flex gap-2">
                          <Users size={14} />
                          {c.ageGroup.name}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t pt-4 text-xs">
                        <span className="text-muted-foreground">
                          {labels[c.format]} · {labels[c.level]}
                        </span>
                        <ArrowUpRight size={16} className="text-primary" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="panel">
                <Empty text="Соревнования не найдены" />
              </div>
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </>
        )}
      </QueryState>
    </>
  );
}
export function CompetitionEditor() {
  const { id } = useParams(),
    nav = useNavigate(),
    action = useAction();
  const dirs = useApi("/directories"),
    query = useApi("/competitions/" + id, !!id);
  if (id && (query.isPending || query.isError))
    return <QueryState query={query}>{() => null}</QueryState>;
  if (dirs.isPending || dirs.isError)
    return <QueryState query={dirs}>{() => null}</QueryState>;
  const options = (kind: string) =>
    (dirs.data || []).filter(
      (d: any) =>
        d.kind === kind &&
        (d.active ||
          [
            query.data?.disciplineId,
            query.data?.typeId,
            query.data?.ageGroupId,
          ].includes(d.id)),
    );
  const fields: FieldDef[] = [
    { key: "title", label: "Название", required: true, full: true },
    { key: "description", label: "Описание", type: "textarea", full: true },
    {
      key: "disciplineId",
      label: "Дисциплина",
      type: "select",
      options: options("DISCIPLINE"),
      required: true,
    },
    {
      key: "typeId",
      label: "Тип соревнования",
      type: "select",
      options: options("COMPETITION_TYPE"),
      required: true,
    },
    {
      key: "ageGroupId",
      label: "Возрастная группа",
      type: "select",
      options: options("AGE_GROUP"),
      required: true,
    },
    {
      key: "level",
      label: "Уровень",
      type: "select",
      required: true,
      options: ["REGIONAL", "INTERREGIONAL", "NATIONAL"].map((id) => ({
        id,
        name: labels[id],
      })),
    },
    {
      key: "startsAt",
      label: "Начало",
      type: "datetime-local",
      required: true,
    },
    {
      key: "endsAt",
      label: "Окончание",
      type: "datetime-local",
      required: true,
    },
    {
      key: "deadline",
      label: "Дедлайн регистрации",
      type: "datetime-local",
      required: true,
    },
    {
      key: "format",
      label: "Формат",
      type: "select",
      required: true,
      options: ["OFFLINE", "ONLINE", "HYBRID"].map((id) => ({
        id,
        name: labels[id],
      })),
    },
    {
      key: "location",
      label: "Место / онлайн-площадка",
      required: true,
      full: true,
    },
    { key: "calendarPlan", label: "Календарный план" },
    { key: "calendarNumber", label: "Номер в плане" },
  ];
  return (
    <>
      <PageHead
        title={id ? "Редактирование соревнования" : "Новое соревнование"}
        subtitle="Сохраните черновик, добавьте положение и откройте регистрацию"
        back={id ? "/competitions/" + id : "/competitions"}
      />
      <div className="panel max-w-4xl p-6">
        <Form
          key={id || "new"}
          fields={fields}
          initial={query.data || { format: "OFFLINE", level: "REGIONAL" }}
          pending={action.isPending}
          submit="Сохранить черновик"
          onSubmit={(d) => {
            const data = { ...d };
            for (const f of ["startsAt", "endsAt", "deadline"])
              data[f] = new Date(data[f]).toISOString();
            action.mutate(
              {
                path: "/competitions" + (id ? "/" + id : ""),
                method: id ? "PATCH" : "POST",
                body: data,
              },
              { onSuccess: (r) => nav("/competitions/" + (id || r.id)) },
            );
          }}
        />
      </div>
    </>
  );
}
function Review({ c }: { c: Data }) {
  const action = useAction(),
    [reasons, setReasons] = useState<Data>({});
  return (
    <div className="panel">
      <div className="border-b p-5 font-semibold">
        Заявки участников{" "}
        <span className="ml-2 text-muted-foreground">
          {c.applications.length}
        </span>
      </div>
      {c.applications.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Спортсмен</th>
                <th>Организация</th>
                <th>Статус</th>
                <th>Решение</th>
              </tr>
            </thead>
            <tbody>
              {c.applications.map((a: any) => (
                <tr key={a.id}>
                  <td>{a.athlete.fullName}</td>
                  <td>{a.athlete.organization?.name || "Без организации"}</td>
                  <td>
                    <Status value={a.status} />
                    {a.reason && (
                      <p className="mt-1 max-w-52 whitespace-normal text-xs text-red-600">
                        {a.reason}
                      </p>
                    )}
                  </td>
                  <td>
                    {a.status === "PENDING" && c.status !== "CANCELLED" ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              path: `/competitions/${c.id}/applications/${a.id}`,
                              method: "PATCH",
                              body: { status: "APPROVED" },
                            })
                          }
                        >
                          Одобрить
                        </Button>
                        <Input
                          placeholder="Причина отказа"
                          aria-label={"Причина отказа " + a.athlete.fullName}
                          value={reasons[a.id] || ""}
                          onChange={(e) =>
                            setReasons({ ...reasons, [a.id]: e.target.value })
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!reasons[a.id] || action.isPending}
                          onClick={() =>
                            action.mutate({
                              path: `/competitions/${c.id}/applications/${a.id}`,
                              method: "PATCH",
                              body: {
                                status: "REJECTED",
                                reason: reasons[a.id],
                              },
                            })
                          }
                        >
                          Отклонить
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="Заявок пока нет" />
      )}
    </div>
  );
}
function ResultsEditor({ c }: { c: Data }) {
  const action = useAction(),
    approved = c.applications.filter((a: any) => a.status === "APPROVED"),
    [values, setValues] = useState<Data>(() =>
      Object.fromEntries(
        approved.map((a: any) => [
          a.id,
          {
            outcome: a.result?.outcome || "FINISHED",
            place: a.result?.place ?? "",
            points: a.result?.points ?? "",
          },
        ]),
      ),
    );
  const change = (id: string, key: string, value: string) =>
    setValues((v) => ({ ...v, [id]: { ...v[id], [key]: value } }));
  return (
    <div className="panel">
      <div className="border-b p-5">
        <h2 className="font-semibold">Ввод результатов</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Укажите исход для каждого одобренного участника. Совпадение мест
          допустимо.
        </p>
      </div>
      {approved.length ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Исход</th>
                  <th>Место</th>
                  <th>Баллы</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((a: any) => (
                  <tr key={a.id}>
                    <td>{a.athlete.fullName}</td>
                    <td>
                      <select
                        aria-label={"Исход " + a.athlete.fullName}
                        value={values[a.id]?.outcome}
                        onChange={(e) =>
                          change(a.id, "outcome", e.target.value)
                        }
                      >
                        {["FINISHED", "DNS", "DSQ"].map((s) => (
                          <option key={s} value={s}>
                            {labels[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Input
                        aria-label={"Место " + a.athlete.fullName}
                        type="number"
                        min="1"
                        disabled={values[a.id]?.outcome !== "FINISHED"}
                        value={values[a.id]?.place}
                        onChange={(e) => change(a.id, "place", e.target.value)}
                      />
                    </td>
                    <td>
                      <Input
                        aria-label={"Баллы " + a.athlete.fullName}
                        type="number"
                        min="0"
                        step="any"
                        disabled={values[a.id]?.outcome !== "FINISHED"}
                        value={values[a.id]?.points}
                        onChange={(e) => change(a.id, "points", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 border-t p-5">
            <Button
              disabled={action.isPending}
              onClick={() => {
                action.mutate({
                  path: `/competitions/${c.id}/results`,
                  method: "PUT",
                  body: {
                    results: approved.map((a: any) => ({
                      applicationId: a.id,
                      outcome: values[a.id].outcome,
                      place:
                        values[a.id].place === ""
                          ? null
                          : Number(values[a.id].place),
                      points:
                        values[a.id].points === ""
                          ? null
                          : Number(values[a.id].points),
                    })),
                  },
                });
              }}
            >
              {c.protocolVersion
                ? "Сохранить исправления"
                : "Сохранить результаты"}
            </Button>
            {!c.protocolVersion && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({ path: `/competitions/${c.id}/publish` })
                }
              >
                Опубликовать протокол
              </Button>
            )}
            <span className="self-center text-xs text-muted-foreground">
              {c.protocolVersion
                ? `Текущая версия протокола: ${c.protocolVersion}`
                : "Сначала сохраните результаты, затем опубликуйте протокол"}
            </span>
          </div>
        </>
      ) : (
        <Empty text="Нет одобренных участников" />
      )}
    </div>
  );
}
export function CompetitionDetail() {
  const { id } = useParams(),
    { user } = useAuth(),
    query = useApi("/competitions/" + id),
    action = useAction();
  const admin = user.activeRole === "ADMIN";
  const dirs = useApi("/directories"),
    judges = useApi("/users?role=JUDGE&limit=100", admin),
    links = useApi("/coach-links?limit=100", user.activeRole === "COACH");
  const [athleteId, setAthleteId] = useState(""),
    [tab, setTab] = useState("overview");
  return (
    <QueryState query={query}>
      {(c) => (
        <>
          <PageHead
            title={c.title}
            subtitle={c.discipline.name}
            back="/competitions"
          >
            <div className="flex flex-wrap gap-2">
              {admin && c.status === "DRAFT" && (
                <Button asChild variant="outline">
                  <Link to={`/competitions/${c.id}/edit`}>
                    <Pencil size={14} />
                    Изменить
                  </Link>
                </Button>
              )}
              {c.protocolVersion > 0 && (
                <Button asChild variant="outline">
                  <a href={`/api/competitions/${c.id}/protocol`}>
                    <Download size={15} />
                    Протокол DOCX
                  </a>
                </Button>
              )}
            </div>
          </PageHead>
          <div className="mb-5 flex flex-wrap gap-2 border-b pb-3">
            {[
              ["overview", "Обзор"],
              ["applications", admin ? "Заявки" : "Мои заявки"],
              ...(admin && ["CLOSED", "COMPLETED"].includes(c.status)
                ? [["results", "Результаты"]]
                : []),
              ...(c.protocolVersion ? [["protocol", "Протокол"]] : []),
            ].map(([key, title]) => (
              <Button
                key={key}
                variant={tab === key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTab(key)}
              >
                {title}
              </Button>
            ))}
          </div>
          {tab === "overview" && (
            <div className="grid items-start gap-6 xl:grid-cols-[1.7fr_1fr]">
              <section className="panel p-6">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <Status value={c.status} />
                  <span className="text-xs text-muted-foreground">
                    {labels[c.level]} · {c.type.name}
                  </span>
                </div>
                <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {c.description || "Описание соревнования пока не добавлено."}
                </p>
                <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
                  {[
                    [
                      "Даты проведения",
                      `${datetime(c.startsAt)} — ${datetime(c.endsAt)}`,
                    ],
                    ["Место", c.location],
                    ["Формат", labels[c.format]],
                    ["Возрастная группа", c.ageGroup.name],
                    ["Календарный план", c.calendarPlan || "Не указан"],
                    ["Номер в плане", c.calendarNumber || "Не указан"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {label}
                      </p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-7 border-t pt-5">
                  <h3 className="mb-3 font-semibold">Положение и документы</h3>
                  {c.files.length ? (
                    c.files.map((f: any) => (
                      <a
                        key={f.id}
                        className="mb-2 flex items-center gap-2 text-sm text-primary"
                        href={`/api/competitions/${c.id}/files/${f.id}`}
                      >
                        <FileText size={16} />
                        {f.name} <Download size={14} />
                      </a>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Положение пока не загружено
                    </p>
                  )}
                  {admin && c.status === "DRAFT" && (
                    <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs">
                      <Upload size={14} />
                      Загрузить PDF / DOCX до 10 МБ
                      <input
                        className="sr-only"
                        type="file"
                        accept=".pdf,.docx"
                        disabled={action.isPending}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const form = new FormData();
                            form.append("file", f);
                            action.mutate({
                              path: `/competitions/${c.id}/files`,
                              body: form,
                            });
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </section>
              <div className="space-y-5">
                <section className="panel p-5">
                  <h3 className="mb-3 font-semibold">Регистрация</h3>
                  <p className="text-xs text-muted-foreground">
                    Приём заявок до
                  </p>
                  <p className="mt-1 text-base font-semibold">
                    {datetime(c.deadline)}
                  </p>
                  {!admin &&
                    c.status === "OPEN" &&
                    new Date(c.deadline) > new Date() &&
                    ["ATHLETE", "COACH"].includes(user.activeRole) && (
                      <div className="mt-5 space-y-3">
                        {user.activeRole === "COACH" && (
                          <select
                            aria-label="Спортсмен для заявки"
                            value={athleteId}
                            onChange={(e) => setAthleteId(e.target.value)}
                          >
                            <option value="">Выберите спортсмена</option>
                            {links.data?.items
                              .filter(
                                (l: any) =>
                                  l.status === "ACTIVE" &&
                                  l.disciplineId === c.disciplineId,
                              )
                              .map((l: any) => (
                                <option key={l.id} value={l.athleteId}>
                                  {l.athlete.fullName}
                                </option>
                              ))}
                          </select>
                        )}
                        <Button
                          className="w-full"
                          disabled={
                            action.isPending ||
                            (user.activeRole === "ATHLETE"
                              ? c.applications.some(
                                  (a: any) => a.athleteId === user.id,
                                )
                              : !athleteId)
                          }
                          onClick={() =>
                            action.mutate({
                              path: `/competitions/${c.id}/applications`,
                              body: {
                                athleteId:
                                  user.activeRole === "ATHLETE"
                                    ? user.id
                                    : athleteId,
                              },
                            })
                          }
                        >
                          {user.activeRole === "ATHLETE" &&
                          c.applications.length
                            ? "Заявка уже подана"
                            : "Подать заявку"}
                        </Button>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Возраст проверяется на дату начала соревнования.
                          Дисциплина должна быть указана в профиле.
                        </p>
                      </div>
                    )}
                  {admin && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {c.status === "DRAFT" && (
                        <Button
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              path: `/competitions/${c.id}/status`,
                              body: { status: "OPEN" },
                            })
                          }
                        >
                          Открыть приём заявок
                        </Button>
                      )}
                      {c.status === "OPEN" && (
                        <Button
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({
                              path: `/competitions/${c.id}/status`,
                              body: { status: "CLOSED" },
                            })
                          }
                        >
                          Закрыть приём
                        </Button>
                      )}
                      {["DRAFT", "OPEN", "CLOSED"].includes(c.status) && (
                        <Button
                          variant="outline"
                          disabled={action.isPending}
                          onClick={() => {
                            if (window.confirm("Отменить соревнование?"))
                              action.mutate({
                                path: `/competitions/${c.id}/status`,
                                body: { status: "CANCELLED" },
                              });
                          }}
                        >
                          Отменить соревнование
                        </Button>
                      )}
                    </div>
                  )}
                </section>
                <section className="panel p-5">
                  <h3 className="mb-4 font-semibold">Судейская коллегия</h3>
                  {c.assignments.length ? (
                    c.assignments.map((a: any) => (
                      <div key={a.id} className="mb-4">
                        <p className="text-sm font-medium">
                          {a.judge.fullName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.position.name}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="mb-4 text-xs text-muted-foreground">
                      Судьи пока не назначены
                    </p>
                  )}
                  {admin && !["COMPLETED", "CANCELLED"].includes(c.status) && (
                    <Form
                      fields={[
                        {
                          key: "judgeId",
                          label: "Судья",
                          type: "select",
                          options: judges.data?.items.map((u: any) => ({
                            id: u.id,
                            name: u.fullName,
                          })),
                          required: true,
                          full: true,
                        },
                        {
                          key: "positionId",
                          label: "Должность",
                          type: "select",
                          options: dirs.data?.filter(
                            (d: any) => d.kind === "JUDGE_POSITION" && d.active,
                          ),
                          required: true,
                          full: true,
                        },
                      ]}
                      onSubmit={(body) =>
                        action.mutate({
                          path: `/competitions/${c.id}/assignments`,
                          body,
                        })
                      }
                      pending={action.isPending}
                      submit="Назначить"
                    />
                  )}
                </section>
              </div>
            </div>
          )}
          {tab === "applications" &&
            (admin ? (
              <Review c={c} />
            ) : (
              <div className="panel">
                {c.applications.length ? (
                  c.applications.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-4 border-b p-5"
                    >
                      <div>
                        <p className="mb-2 font-medium">{a.athlete.fullName}</p>
                        <Status value={a.status} />
                        {a.reason && (
                          <p className="mt-2 text-xs text-red-600">
                            {a.reason}
                          </p>
                        )}
                      </div>
                      {c.status === "OPEN" &&
                        new Date(c.deadline) > new Date() &&
                        ["PENDING", "APPROVED"].includes(a.status) && (
                          <Button
                            variant="outline"
                            disabled={action.isPending}
                            onClick={() =>
                              action.mutate({
                                path: `/competitions/${c.id}/applications/${a.id}`,
                                method: "PATCH",
                                body: { status: "WITHDRAWN" },
                              })
                            }
                          >
                            Отозвать
                          </Button>
                        )}
                    </div>
                  ))
                ) : (
                  <Empty text="Заявок пока нет" />
                )}
              </div>
            ))}
          {tab === "results" && admin && (
            <ResultsEditor
              key={
                c.protocolVersion +
                ":" +
                c.applications.map((a: any) => a.id).join(",")
              }
              c={c}
            />
          )}
          {tab === "protocol" && (
            <div className="panel">
              <div className="border-b p-5">
                <h2 className="font-semibold">
                  Протокол · версия {c.protocolVersion}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Демонстрационная форма · опубликован {datetime(c.publishedAt)}
                </p>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Место</th>
                      <th>Участник</th>
                      <th>Организация</th>
                      <th>Баллы</th>
                      <th>Исход</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...c.protocol]
                      .sort(
                        (a: any, b: any) =>
                          (a.result?.place ?? 1e9) - (b.result?.place ?? 1e9),
                      )
                      .map((a: any) => (
                        <tr key={a.id}>
                          <td className="font-semibold">
                            {a.result?.place || "—"}
                          </td>
                          <td>{a.athlete.fullName}</td>
                          <td>
                            {a.athlete.organization?.name || "Без организации"}
                          </td>
                          <td>{a.result?.points ?? "—"}</td>
                          <td>{labels[a.result?.outcome] || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </QueryState>
  );
}
