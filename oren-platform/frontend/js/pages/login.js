import { api, session } from "../api.js";
import { esc } from "../format.js";
import { $, $$ } from "../ui.js";
import { go } from "../router.js";
import { reset } from "../store.js";

const DEMO = [
  ["athlete.smirnov@fsp56.ru", "Спортсмен"],
  ["coach.ivanov@fsp56.ru", "Тренер"],
  ["judge.petrov@fsp56.ru", "Судья"],
  ["admin@fsp56.ru", "Администратор"],
  ["coach.morozov@fsp56.ru", "Тренер + спортсмен"],
];

export function startSession(t) {
  reset();
  session.set({ token: t.access_token, userId: t.user_id, roles: t.roles, activeRole: t.active_role, fullName: t.full_name });
  go("/home");
  location.reload();
}

export function loginPage(app) {
  const demo = window.APP_CONFIG?.SHOW_DEMO === true
    ? `<div class="demo">Демо-аккаунты (пароль <b>secret123</b>):${DEMO.map(([e, t]) => `<button type="button" data-e="${esc(e)}">${esc(t)} — ${esc(e)}</button>`).join("")}</div>`
    : "";

  app.innerHTML = `
  <div class="auth">
    <div class="auth-card">
      <img class="auth-logo" src="assets/logo.svg" alt="ФСП">
      <h1>Вход в личный кабинет</h1>
      <p class="auth-sub">Федерация спортивного программирования</p>
      <form id="f" novalidate>
        <div class="err" id="e" hidden></div>
        <label class="f"><span>Email</span><input class="i" type="email" name="email" required autocomplete="username" placeholder="name@example.ru"></label>
        <label class="f"><span>Пароль</span><input class="i" type="password" name="password" required autocomplete="current-password" placeholder="Введите пароль"></label>
        <div class="auth-links">
          <a href="#/login" id="forgot">Забыли пароль?</a>
          <a href="#/register">Зарегистрироваться</a>
        </div>
        <button class="btn block" type="submit">Войти</button>
      </form>
    </div>
    ${demo}
  </div>`;

  const err = $("#e");
  const showError = (text) => { err.textContent = text; err.hidden = false; };

  $("#forgot").onclick = (ev) => {
    ev.preventDefault();
    showError("Для восстановления пароля обратитесь к администратору федерации");
  };

  $$("[data-e]").forEach(b => b.onclick = () => {
    $("[name=email]").value = b.dataset.e;
    $("[name=password]").value = "secret123";
  });

  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("button[type=submit]");
    const data = new FormData(ev.target);
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    err.hidden = true;
    if (!email || !password) return showError("Введите электронную почту и пароль");
    btn.disabled = true;
    try {
      startSession(await api.login(email, password));
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
    }
  };
}
