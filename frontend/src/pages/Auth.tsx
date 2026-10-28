import { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Code2, ArrowRight, ShieldCheck, Users, Trophy } from "lucide-react";
import { Form, ErrorBox, type FieldDef } from "@/components/common";
import { api, ToastContext, type Data } from "@/lib/api";
import { Button } from "@/components/ui/button";
export function AuthPage({
  register = false,
  refresh,
}: {
  register?: boolean;
  refresh: () => Promise<any>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const navigate = useNavigate(),
    toast = useContext(ToastContext);
  const fields: FieldDef[] = register
    ? [
        { key: "fullName", label: "ФИО", required: true, full: true },
        {
          key: "birthDate",
          label: "Дата рождения",
          type: "date",
          required: true,
        },
        { key: "email", label: "Email", type: "email", required: true },
        {
          key: "password",
          label: "Пароль",
          type: "password",
          required: true,
          hint: "Не менее 8 символов",
          full: true,
        },
        {
          key: "consent",
          label:
            "Даю согласие на обработку персональных данных (версия от 27.10.2026)",
          type: "checkbox",
          full: true,
        },
        {
          key: "guardianName",
          label: "ФИО представителя",
          hint: "Обязательно для несовершеннолетнего",
        },
        { key: "guardianContact", label: "Контакт представителя" },
        {
          key: "guardianConsent",
          label: "Законный представитель согласен на обработку данных ребёнка",
          type: "checkbox",
          full: true,
        },
      ]
    : [
        {
          key: "email",
          label: "Email",
          type: "email",
          required: true,
          full: true,
        },
        {
          key: "password",
          label: "Пароль",
          type: "password",
          required: true,
          full: true,
        },
      ];
  async function submit(data: Data) {
    setBusy(true);
    setError(null);
    try {
      await api("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: JSON.stringify(data),
      });
      await refresh();
      navigate("/");
      toast(register ? "Аккаунт создан" : "Вы вошли в систему");
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#202632] p-14 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary">
            <Code2 size={30} />
          </div>
          <div className="text-xl font-bold">
            ФСП <span className="font-normal text-white/50">/ Оренбуржье</span>
          </div>
        </div>
        <div className="my-auto py-16">
          <p className="mb-6 text-xs font-semibold tracking-[.2em] text-orange-400">
            ЕДИНАЯ ЦИФРОВАЯ ПЛАТФОРМА
          </p>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.15] tracking-tight">
            Спорт начинается
            <br />с твоего кода<span className="text-primary">.</span>
          </h1>
          <p className="mt-7 max-w-sm text-base leading-relaxed text-white/55">
            Соревнования, результаты и сообщество спортивного программирования
            Оренбургской области.
          </p>
          <div className="mt-12 flex gap-8 text-xs text-white/65">
            {[
              [Trophy, "Соревнования"],
              [Users, "Сообщество"],
              [ShieldCheck, "Единый профиль"],
            ].map(([Icon, text]: any) => (
              <div key={text}>
                <Icon size={23} className="mb-3 text-orange-400" />
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/35">
          Федерация спортивного программирования · 2026
        </p>
        <div className="pointer-events-none absolute -bottom-24 -right-20 text-[300px] font-bold leading-none text-white/[.025]">
          &lt;/&gt;
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-10 flex items-center gap-2 text-xl font-bold lg:hidden">
            <Code2 className="text-primary" />
            ФСП Оренбуржье
          </div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">
            Личный кабинет
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            {register ? "Регистрация" : "С возвращением"}
          </h2>
          <p className="mb-8 mt-2 text-muted-foreground">
            {register
              ? "Создайте профиль спортсмена"
              : "Войдите, чтобы продолжить работу с платформой"}
          </p>
          {error && <ErrorBox error={error} />}
          <Form
            key={register ? "register" : "login"}
            fields={fields}
            onSubmit={submit}
            pending={busy}
            submit={register ? "Создать аккаунт" : "Войти в кабинет"}
          />
          <p className="mt-6 text-sm text-muted-foreground">
            {register ? "Уже есть аккаунт?" : "Впервые на платформе?"}{" "}
            <Link
              className="text-primary"
              to={register ? "/login" : "/register"}
            >
              {register ? "Войти" : "Зарегистрироваться"}{" "}
              <ArrowRight size={13} className="inline" />
            </Link>
          </p>
          {!register && (
            <div className="mt-9 rounded-xl border bg-white p-5">
              <p className="text-xs font-semibold">Попробовать демоверсию</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Вход с фиктивными данными в один клик
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["admin", "Федерация"],
                  ["athlete", "Спортсмен"],
                  ["coach", "Тренер"],
                  ["judge", "Судья"],
                  ["multi", "Несколько ролей"],
                ].map(([key, title]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      submit({
                        email: `${key}@demo.fsp.local`,
                        password: "Demo2026!",
                      })
                    }
                  >
                    {title}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Демонстрационная среда. Используйте только фиктивные данные.
            Согласие сохраняет ФИО, контакты, дату рождения и сведения об
            участии для работы платформы. Для прекращения обработки обратитесь в
            федерацию.
          </p>
        </div>
      </div>
    </div>
  );
}
