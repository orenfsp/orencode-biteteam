import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LoaderCircle,
  Inbox,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { labels, type Data } from "@/lib/api";
export function PageHead({
  title,
  subtitle,
  children,
  back,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-7">
      <div className="mb-3 text-xs text-muted-foreground">
        Личный кабинет <span className="mx-2">/</span> {title}
      </div>
      {back && (
        <Link
          className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          to={back}
        >
          <ArrowLeft size={14} />
          Назад
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const color = ["APPROVED", "ACTIVE", "COMPLETED"].includes(value)
    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
    : ["OPEN", "PENDING"].includes(value)
      ? "bg-orange-50 text-orange-700 border-orange-100"
      : ["REJECTED", "CANCELLED", "DSQ"].includes(value)
        ? "bg-red-50 text-red-700 border-red-100"
        : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <Badge
      variant="outline"
      className={"gap-1.5 rounded-md px-2 py-1 font-medium " + color}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {labels[value] || value}
    </Badge>
  );
}
export function Loading() {
  return (
    <div className="flex items-center justify-center gap-3 p-16 text-muted-foreground">
      <LoaderCircle className="animate-spin" size={20} />
      Загружаем данные…
    </div>
  );
}
export function Empty({
  text = "Пока нет записей",
  children,
}: {
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
      <Inbox size={30} strokeWidth={1.4} />
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-4 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"
    >
      {error.message}
      {retry && (
        <Button onClick={retry} variant="outline" className="ml-3">
          Повторить
        </Button>
      )}
    </div>
  );
}
export function QueryState({
  query,
  children,
}: {
  query: any;
  children: (data: any) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError)
    return <ErrorBox error={query.error} retry={() => query.refetch()} />;
  return children(query.data);
}
export function Pagination({
  data,
  page,
  setPage,
}: {
  data: any;
  page: number;
  setPage: (n: number) => void;
}) {
  if (!data || data.total <= data.limit) return null;
  return (
    <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
      <span>
        Всего {data.total} записей · Страница {page}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft size={15} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page * data.limit >= data.total}
          onClick={() => setPage(page + 1)}
          aria-label="Следующая страница"
        >
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export type FieldDef = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { id: string; name: string }[];
  hint?: string;
  full?: boolean;
};
export function Form({
  fields,
  initial = {},
  onSubmit,
  pending,
  submit = "Сохранить",
  children,
}: {
  fields: FieldDef[];
  initial?: Data;
  onSubmit: (data: Data) => void;
  pending?: boolean;
  submit?: string;
  children?: ReactNode;
}) {
  const shape: Record<string, z.ZodTypeAny> = {};
  fields.forEach((f) => {
    shape[f.key] =
      f.type === "checkbox"
        ? z.boolean()
        : f.type === "multi"
          ? z
              .array(z.string())
              .refine((v) => !f.required || v.length > 0, "Выберите значение")
          : f.type === "email"
            ? z.string().email("Укажите email")
            : z
                .string()
                .refine(
                  (v) => !f.required || v.trim().length > 0,
                  "Заполните поле",
                );
  });
  const defaults: Data = {};
  for (const f of fields) {
    const v = initial[f.key];
    defaults[f.key] =
      f.type === "checkbox"
        ? !!v
        : f.type === "multi"
          ? v || []
          : f.type === "date"
            ? v
              ? String(v).slice(0, 10)
              : ""
            : f.type === "datetime-local"
              ? v
                ? new Date(
                    new Date(v).getTime() -
                      new Date(v).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ""
              : v == null
                ? ""
                : String(v);
  }
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<Data>({
    defaultValues: defaults,
    resolver: zodResolver(z.object(shape)),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="form-grid">
        {fields.map((f) => (
          <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
            {f.type === "checkbox" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register(f.key)}
                  className="mt-1 accent-orange-600"
                />
                {f.label}
              </label>
            ) : (
              <label className="field">
                {f.label}
                {f.type === "select" ? (
                  <select {...register(f.key)}>
                    <option value="">Выберите…</option>
                    {f.options?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                ) : f.type === "multi" ? (
                  <div className="flex flex-wrap gap-2">
                    {f.options?.map((o) => (
                      <label
                        key={o.id}
                        className="flex items-center gap-2 rounded-md border p-2 text-xs font-normal"
                      >
                        <input
                          type="checkbox"
                          className="accent-orange-600"
                          checked={(watch(f.key) || []).includes(o.id)}
                          onChange={(e) =>
                            setValue(
                              f.key,
                              e.target.checked
                                ? [...(watch(f.key) || []), o.id]
                                : (watch(f.key) || []).filter(
                                    (id: string) => id !== o.id,
                                  ),
                              { shouldValidate: true },
                            )
                          }
                        />
                        {o.name}
                      </label>
                    ))}
                  </div>
                ) : f.type === "textarea" ? (
                  <Textarea rows={3} {...register(f.key)} />
                ) : (
                  <Input type={f.type || "text"} {...register(f.key)} />
                )}
                {f.hint && <small>{f.hint}</small>}
              </label>
            )}
            {errors[f.key] && (
              <p className="mt-1 text-xs text-red-600">
                {String(errors[f.key]?.message)}
              </p>
            )}
          </div>
        ))}
      </div>
      {children}
      <Button disabled={pending} type="submit">
        {pending && <LoaderCircle className="animate-spin" size={15} />}
        {submit}
      </Button>
    </form>
  );
}
