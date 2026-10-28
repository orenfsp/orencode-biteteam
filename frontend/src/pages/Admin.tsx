import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Bell, Pencil, X } from "lucide-react";
import { useApi, useAction, qs, date, datetime, type Data } from "@/lib/api";
import {
  PageHead,
  QueryState,
  Empty,
  Pagination,
  Form,
  Status,
  type FieldDef,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const kinds: Data = {
  DISCIPLINE: "Дисциплины",
  MUNICIPALITY: "Муниципалитеты",
  COMPETITION_TYPE: "Типы соревнований",
  AGE_GROUP: "Возрастные группы",
  RANK: "Разряды",
  JUDGE_CATEGORY: "Судейские категории",
  JUDGE_POSITION: "Судейские должности",
};
export function Directories() {
  const query = useApi("/directories"),
    action = useAction();
  const [kind, setKind] = useState("MUNICIPALITY"),
    [edit, setEdit] = useState<Data | null>(null);
  const fields: FieldDef[] = [
    { key: "name", label: "Название", required: true, full: true },
    ...(kind === "AGE_GROUP"
      ? [
          { key: "minAge", label: "Минимальный возраст", type: "number" },
          { key: "maxAge", label: "Максимальный возраст", type: "number" },
        ]
      : []),
  ];
  return (
    <>
      <PageHead
        title="Справочники"
        subtitle="Общие значения для профилей и соревнований"
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {Object.entries(kinds).map(([k, n]) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? "default" : "outline"}
            onClick={() => {
              setKind(k);
              setEdit(null);
            }}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <QueryState query={query}>
          {(items) => (
            <div className="panel">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{kinds[kind]}</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .filter((d: any) => d.kind === kind)
                      .map((d: any) => (
                        <tr key={d.id}>
                          <td className="whitespace-normal">
                            {d.name}
                            {kind === "AGE_GROUP" && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Возраст: {d.minAge ?? 0}–{d.maxAge ?? "∞"}
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={
                                d.active
                                  ? "text-emerald-700"
                                  : "text-muted-foreground"
                              }
                            >
                              {d.active ? "Активно" : "Отключено"}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label={"Изменить " + d.name}
                                onClick={() => setEdit(d)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={action.isPending}
                                onClick={() =>
                                  action.mutate({
                                    path: "/directories/" + d.id,
                                    method: "PATCH",
                                    body: { active: !d.active },
                                  })
                                }
                              >
                                {d.active ? "Отключить" : "Включить"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </QueryState>
        <div className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">
              {edit ? "Редактирование" : "Новая запись"}
            </h2>
            {edit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Отменить редактирование"
                onClick={() => setEdit(null)}
              >
                <X size={15} />
              </Button>
            )}
          </div>
          {kind === "DISCIPLINE" && !edit ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              В системе шесть дисциплин вида спорта. Выберите существующую
              запись для редактирования.
            </p>
          ) : (
            <Form
              key={edit?.id || kind}
              fields={fields}
              initial={edit || {}}
              pending={action.isPending}
              onSubmit={(d) => {
                const body: Data = { ...d };
                if (kind === "AGE_GROUP") {
                  body.minAge = d.minAge === "" ? null : Number(d.minAge);
                  body.maxAge = d.maxAge === "" ? null : Number(d.maxAge);
                }
                if (!edit) body.kind = kind;
                action.mutate(
                  {
                    path: "/directories" + (edit ? "/" + edit.id : ""),
                    method: edit ? "PATCH" : "POST",
                    body,
                  },
                  { onSuccess: () => setEdit(null) },
                );
              }}
            />
          )}
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Отключённые значения сохраняются в существующих записях. Возрастные
            границы используемой группы не изменяются: создайте новую группу.
          </p>
        </div>
      </div>
    </>
  );
}
export function Organizations() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Data | null>(null);
  const query = useApi("/organizations" + qs({ q, page })),
    action = useAction();
  return (
    <>
      <PageHead
        title="Организации"
        subtitle="Клубы, школы, вузы и организации спортивной подготовки"
      />
      <div className="mb-5 max-w-sm">
        <Input
          aria-label="Найти организацию"
          placeholder="Поиск организации…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <QueryState query={query}>
          {(d) => (
            <div className="panel">
              {d.items.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((o: any) => (
                        <tr key={o.id}>
                          <td className="whitespace-normal font-medium">
                            {o.name}
                          </td>
                          <td>{o.type}</td>
                          <td>{o.active ? "Активна" : "Отключена"}</td>
                          <td>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEdit(o)}
                                aria-label={"Изменить " + o.name}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={action.isPending}
                                onClick={() =>
                                  action.mutate({
                                    path: "/organizations/" + o.id,
                                    method: "PATCH",
                                    body: { active: !o.active },
                                  })
                                }
                              >
                                {o.active ? "Отключить" : "Включить"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty />
              )}
              <Pagination data={d} page={page} setPage={setPage} />
            </div>
          )}
        </QueryState>
        <div className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">
              {edit ? "Редактирование" : "Добавить организацию"}
            </h2>
            {edit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEdit(null)}
                aria-label="Отменить"
              >
                <X size={15} />
              </Button>
            )}
          </div>
          <Form
            key={edit?.id || "new"}
            fields={[
              { key: "name", label: "Название", required: true, full: true },
              {
                key: "type",
                label: "Тип организации",
                required: true,
                full: true,
              },
            ]}
            initial={edit || {}}
            pending={action.isPending}
            onSubmit={(body) =>
              action.mutate(
                {
                  path: "/organizations" + (edit ? "/" + edit.id : ""),
                  method: edit ? "PATCH" : "POST",
                  body,
                },
                { onSuccess: () => setEdit(null) },
              )
            }
          />
        </div>
      </div>
    </>
  );
}
export function Notifications() {
  const [page, setPage] = useState(1);
  const query = useApi("/notifications" + qs({ page })),
    action = useAction();
  return (
    <>
      <PageHead
        title="Уведомления"
        subtitle="События и сроки в пределах активного кабинета"
      />
      <QueryState query={query}>
        {(d) => (
          <div className="panel">
            {d.items.length ? (
              d.items.map((n: any) => (
                <div
                  key={n.id}
                  className={
                    "flex items-start gap-4 border-b p-5 last:border-0 " +
                    (!n.readAt ? "bg-orange-50/20" : "")
                  }
                >
                  <div className="rounded-lg bg-orange-50 p-2 text-primary">
                    <Bell size={17} />
                  </div>
                  <div className="flex-1">
                    <Link
                      to={n.href}
                      className="font-medium hover:text-primary"
                    >
                      {n.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {datetime(n.createdAt)}
                    </p>
                  </div>
                  {!n.readAt && (
                    <Button
                      aria-label="Отметить прочитанным"
                      variant="outline"
                      size="icon"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: `/notifications/${n.id}/read`,
                          method: "PATCH",
                        })
                      }
                    >
                      <Check size={15} />
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <Empty text="Уведомлений пока нет" />
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </div>
        )}
      </QueryState>
    </>
  );
}
export function Audit() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [open, setOpen] = useState("");
  const query = useApi("/audit-log" + qs({ q, page }));
  return (
    <>
      <PageHead
        title="Журнал действий"
        subtitle="Кто, когда и какие данные изменил"
      />
      <Input
        className="mb-5 max-w-sm"
        placeholder="Имя сотрудника или действие…"
        aria-label="Поиск в журнале"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <QueryState query={query}>
        {(d) => (
          <div className="panel">
            {d.items.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Пользователь</th>
                      <th>Действие</th>
                      <th>Объект</th>
                      <th>Изменения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((a: any) => (
                      <tr key={a.id}>
                        <td>{datetime(a.createdAt)}</td>
                        <td>{a.actor?.fullName || "Система"}</td>
                        <td>{a.action}</td>
                        <td>
                          {a.entityType}
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {a.entityId}
                          </div>
                        </td>
                        <td>
                          {a.details && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setOpen(open === a.id ? "" : a.id)
                                }
                              >
                                Подробности
                              </Button>
                              {open === a.id && (
                                <pre className="mt-2 max-w-md overflow-auto whitespace-pre-wrap text-xs">
                                  {JSON.stringify(a.details, null, 2)}
                                </pre>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </div>
        )}
      </QueryState>
    </>
  );
}
export function Assignments() {
  const [page, setPage] = useState(1);
  const query = useApi("/assignments" + qs({ page }));
  return (
    <>
      <PageHead
        title="Мои назначения"
        subtitle="Соревнования, на которых вы входите в судейскую коллегию"
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
                      <th>Дата</th>
                      <th>Дисциплина</th>
                      <th>Должность</th>
                      <th>Статус</th>
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
                        <td>{date(a.competition.startsAt)}</td>
                        <td>{a.competition.discipline.name}</td>
                        <td>{a.position.name}</td>
                        <td>
                          <Status value={a.competition.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Назначений пока нет" />
            )}
            <Pagination data={d} page={page} setPage={setPage} />
          </div>
        )}
      </QueryState>
    </>
  );
}
