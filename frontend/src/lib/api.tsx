import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export type Data = Record<string, any>;
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => {
    throw new Error(
      "API вернул некорректный ответ. Проверьте доступность backend.",
    );
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("fsp:unauthorized"));
    throw new Error(
      data.message +
        (data.fields
          ? " · " +
            Object.entries(data.fields)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join("; ")
          : ""),
    );
  }
  return data;
}
export const AuthContext = createContext<{
  user: Data;
  refresh: () => Promise<any>;
}>({ user: {}, refresh: async () => {} });
export const ToastContext = createContext<
  (message: string, error?: boolean) => void
>(() => {});
export const useAuth = () => useContext(AuthContext);
export const useApi = (path: string, enabled = true) =>
  useQuery({ queryKey: [path], queryFn: () => api(path), enabled });
export function useAction() {
  const client = useQueryClient(),
    toast = useContext(ToastContext);
  return useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: any;
    }) =>
      api(path, {
        method,
        body:
          body instanceof FormData
            ? body
            : body === undefined
              ? undefined
              : JSON.stringify(body),
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
      toast("Изменения сохранены");
    },
    onError: (e: Error) => toast(e.message, true),
  });
}
export const roles: Data = {
  ADMIN: "Федерация",
  ATHLETE: "Спортсмен",
  COACH: "Тренер",
  JUDGE: "Судья",
};
export const labels: Data = {
  DRAFT: "Черновик",
  OPEN: "Приём заявок",
  CLOSED: "Приём закрыт",
  COMPLETED: "Завершено",
  CANCELLED: "Отменено",
  PENDING: "На рассмотрении",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
  WITHDRAWN: "Отозвана",
  ACTIVE: "Активна",
  ENDED: "Завершена",
  FINISHED: "Завершил",
  DNS: "Неявка",
  DSQ: "Дисквалификация",
  OFFLINE: "Очно",
  ONLINE: "Онлайн",
  HYBRID: "Смешанный",
  REGIONAL: "Региональное",
  INTERREGIONAL: "Межрегиональное",
  NATIONAL: "Всероссийское",
};
export const date = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
export const datetime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
export const qs = (values: Data) =>
  "?" +
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== "" && v !== undefined && v !== false)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
