import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserRound,
  Bell,
  Building2,
  BookOpen,
  ScrollText,
  Link2,
  Trophy,
  Gavel,
  LogOut,
  Code2,
  Menu,
  ChevronRight,
  CircleHelp,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  api,
  AuthContext,
  ToastContext,
  useApi,
  useAction,
  useAuth,
  roles,
  type Data,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loading, ErrorBox } from "@/components/common";
import { AuthPage } from "@/pages/Auth";
import { Dashboard } from "@/pages/Dashboard";
import {
  Competitions,
  CompetitionDetail,
  CompetitionEditor,
} from "@/pages/Competitions";
import { Profile, Registry, Connections, Results } from "@/pages/People";
import {
  Directories,
  Organizations,
  Notifications,
  Audit,
  Assignments,
} from "@/pages/Admin";
function Guard({
  allowed,
  children,
}: {
  allowed: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return allowed.includes(user.activeRole) ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}
function Shell() {
  const { user, refresh } = useAuth(),
    nav = useNavigate(),
    client = useQueryClient(),
    action = useAction(),
    location = useLocation();
  const [mobile, setMobile] = useState(false);
  const n = useApi("/notifications?limit=1");
  const navigation = [
    {
      to: "/",
      name: "Обзор",
      icon: LayoutDashboard,
      roles: ["ADMIN", "ATHLETE", "COACH", "JUDGE"],
    },
    {
      to: "/competitions",
      name: "Соревнования",
      icon: CalendarDays,
      roles: ["ADMIN", "ATHLETE", "COACH", "JUDGE"],
    },
    {
      to: "/registry",
      name: "Реестр участников",
      icon: Users,
      roles: ["ADMIN"],
    },
    {
      to: "/connections",
      name: user.activeRole === "COACH" ? "Мои спортсмены" : "Мои тренеры",
      icon: Link2,
      roles: ["COACH", "ATHLETE"],
    },
    {
      to: "/results",
      name: "Мои результаты",
      icon: Trophy,
      roles: ["ATHLETE"],
    },
    {
      to: "/assignments",
      name: "Мои назначения",
      icon: Gavel,
      roles: ["JUDGE"],
    },
    {
      to: "/organizations",
      name: "Организации",
      icon: Building2,
      roles: ["ADMIN"],
    },
    {
      to: "/directories",
      name: "Справочники",
      icon: BookOpen,
      roles: ["ADMIN"],
    },
    {
      to: "/notifications",
      name: "Уведомления",
      icon: Bell,
      roles: ["ADMIN", "ATHLETE", "COACH", "JUDGE"],
    },
    {
      to: "/audit-log",
      name: "Журнал действий",
      icon: ScrollText,
      roles: ["ADMIN"],
    },
    {
      to: "/profile",
      name: "Мой профиль",
      icon: UserRound,
      roles: ["ADMIN", "ATHLETE", "COACH", "JUDGE"],
    },
  ].filter((i) => i.roles.includes(user.activeRole));
  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-3 px-6 py-7">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
          <Code2 size={26} />
        </div>
        <div>
          <b className="text-lg tracking-tight">
            ФСП <span className="font-normal text-slate-400">/</span> Оренбуржье
          </b>
          <p className="mt-0.5 text-[9px] tracking-[.06em] text-muted-foreground">
            ЦИФРОВАЯ ПЛАТФОРМА ФЕДЕРАЦИИ
          </p>
        </div>
      </Link>
      <div className="mx-5 mb-6 rounded-lg border bg-slate-50/60 p-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Активный кабинет
        </p>
        <select
          aria-label="Активный кабинет"
          value={user.activeRole}
          disabled={action.isPending}
          className="border-0 bg-transparent px-0 py-0 text-xs font-medium"
          onChange={async (e) => {
            try {
              await action.mutateAsync({
                path: "/auth/role",
                body: { role: e.target.value },
              });
              await client.cancelQueries();
              client.removeQueries({
                predicate: (q) => q.queryKey[0] !== "/auth/me",
              });
              await refresh();
              nav("/");
            } catch {}
          }}
        >
          {user.roles.map((r: string) => (
            <option key={r} value={r}>
              {roles[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="px-5 text-[9px] font-semibold uppercase tracking-[.13em] text-slate-400">
        Рабочее пространство
      </div>
      <nav className="mt-3 space-y-1 px-4">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setMobile(false)}
            className={({ isActive }) =>
              "nav-item " + (isActive ? "active" : "")
            }
          >
            <item.icon size={17} strokeWidth={1.7} />
            <span className="flex-1">{item.name}</span>
            {item.to === "/notifications" && !!n.data?.unread && (
              <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] text-white">
                {n.data.unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-5">
        <div className="mb-5 rounded-xl bg-slate-50 p-4">
          <CircleHelp size={18} className="mb-2 text-muted-foreground" />
          <p className="text-xs font-medium">Демонстрационная версия</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Все персональные данные и результаты фиктивные.
          </p>
        </div>
        <button
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
          onClick={async () => {
            await api("/auth/logout", { method: "POST" });
            client.clear();
            await refresh();
            nav("/login");
          }}
        >
          <LogOut size={15} />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] border-r bg-white lg:block">
        {sidebar}
      </aside>
      <div className="lg:ml-[260px]">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between gap-3 border-b bg-white/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={mobile} onOpenChange={setMobile}>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="lg:hidden"
                  aria-label="Открыть меню"
                >
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] gap-0 p-0">
                <SheetTitle className="sr-only">Меню платформы</SheetTitle>
                <SheetDescription className="sr-only">
                  Навигация личного кабинета
                </SheetDescription>
                {sidebar}
              </SheetContent>
            </Sheet>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Региональное отделение ФСП
            </span>
            <ChevronRight
              size={13}
              className="hidden text-slate-300 sm:block"
            />
            <span className="text-xs font-medium">Оренбургская область</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/notifications"
              className="relative rounded-md p-2 hover:bg-slate-50"
              aria-label="Уведомления"
            >
              <Bell size={19} strokeWidth={1.5} />
              {!!n.data?.unread && (
                <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-primary" />
              )}
            </Link>
            <div className="h-7 border-l" />
            <Link to="/profile" className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-primary">
                {user.fullName
                  .replace("Демо · ", "")
                  .split(" ")
                  .slice(0, 2)
                  .map((s: string) => s[0])
                  .join("")}
              </div>
              <div className="hidden sm:block">
                <p className="max-w-48 truncate text-xs font-semibold">
                  {user.fullName.replace("Демо · ", "")}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {roles[user.activeRole]}
                </p>
              </div>
            </Link>
          </div>
        </header>
        <main
          key={user.activeRole}
          className="mx-auto max-w-[1600px] p-5 sm:p-8"
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route
              path="/competitions/new"
              element={
                <Guard allowed={["ADMIN"]}>
                  <CompetitionEditor />
                </Guard>
              }
            />
            <Route
              path="/competitions/:id/edit"
              element={
                <Guard allowed={["ADMIN"]}>
                  <CompetitionEditor />
                </Guard>
              }
            />
            <Route path="/competitions/:id" element={<CompetitionDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/registry"
              element={
                <Guard allowed={["ADMIN"]}>
                  <Registry />
                </Guard>
              }
            />
            <Route
              path="/registry/:id"
              element={
                <Guard allowed={["ADMIN"]}>
                  <Profile />
                </Guard>
              }
            />
            <Route
              path="/connections"
              element={
                <Guard allowed={["COACH", "ATHLETE"]}>
                  <Connections />
                </Guard>
              }
            />
            <Route
              path="/results"
              element={
                <Guard allowed={["ATHLETE"]}>
                  <Results />
                </Guard>
              }
            />
            <Route
              path="/results/:athleteId"
              element={
                <Guard allowed={["COACH"]}>
                  <Results />
                </Guard>
              }
            />
            <Route
              path="/organizations"
              element={
                <Guard allowed={["ADMIN"]}>
                  <Organizations />
                </Guard>
              }
            />
            <Route
              path="/directories"
              element={
                <Guard allowed={["ADMIN"]}>
                  <Directories />
                </Guard>
              }
            />
            <Route
              path="/assignments"
              element={
                <Guard allowed={["JUDGE"]}>
                  <Assignments />
                </Guard>
              }
            />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/audit-log"
              element={
                <Guard allowed={["ADMIN"]}>
                  <Audit />
                </Guard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="mt-12 flex flex-wrap justify-between gap-2 border-t pt-5 text-[10px] text-slate-400">
            <span>© 2026 ФСП Оренбургской области</span>
            <span>Единая цифровая платформа · MVP</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  const client = useQueryClient(),
    [toast, setToast] = useState<{ message: string; error?: boolean } | null>(
      null,
    );
  const me = useQuery({
    queryKey: ["/auth/me"],
    queryFn: () => api("/auth/me"),
    retry: false,
    staleTime: 30000,
  });
  const location = useLocation();
  useEffect(() => {
    const handler = () => {
      client.setQueryData(["/auth/me"], null);
    };
    window.addEventListener("fsp:unauthorized", handler);
    return () => window.removeEventListener("fsp:unauthorized", handler);
  }, [client]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const refresh = () => me.refetch();
  let body;
  if (me.isPending) body = <Loading />;
  else if (me.error && !String(me.error.message).includes("Войдите"))
    body = (
      <div className="mx-auto max-w-lg p-10">
        <ErrorBox error={me.error} retry={() => me.refetch()} />
      </div>
    );
  else if (!me.data)
    body =
      location.pathname === "/register" ? (
        <AuthPage register refresh={refresh} />
      ) : (
        <AuthPage refresh={refresh} />
      );
  else
    body = (
      <AuthContext.Provider value={{ user: me.data, refresh }}>
        <Shell />
      </AuthContext.Provider>
    );
  return (
    <ToastContext.Provider
      value={(message, error) => setToast({ message, error })}
    >
      {body}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={
            "fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-40px)] items-start gap-3 rounded-xl border bg-white p-4 shadow-lg " +
            (toast.error
              ? "border-red-200 text-red-700"
              : "border-emerald-200 text-emerald-800")
          }
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
          <p className="max-w-md text-sm">{toast.message}</p>
          <button
            aria-label="Закрыть уведомление"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
