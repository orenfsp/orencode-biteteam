import { api } from "../api.js";
import { $ } from "../ui.js";
import { startSession } from "./login.js";

export function registerPage(app) {
  app.innerHTML = `
  <div class="auth">
    <div class="auth-card">
      <img class="auth-logo" src="assets/logo.svg" alt="ФСП">
      <h1>Регистрация</h1>
      <p class="auth-sub">Федерация спортивного программирования</p>
      <form id="f" novalidate>
        <div class="err" id="e" hidden></div>
        <label class="f"><span>ФИО</span><input class="i" type="text" name="full_name" required autocomplete="name" placeholder="Иванов Иван Иванович"></label>
        <label class="f"><span>Email</span><input class="i" type="email" name="email" required autocomplete="username" placeholder="name@example.ru"></label>
        <label class="f"><span>Пароль</span><input class="i" type="password" name="password" required autocomplete="new-password" placeholder="Не короче 6 символов"></label>
        <div class="auth-links">
          <a href="#/login">Уже есть аккаунт?</a>
        </div>
        <button class="btn block" type="submit">Зарегистрироваться</button>
      </form>
    </div>
  </div>`;

  const err = $("#e");
  const showError = (text) => { err.textContent = text; err.hidden = false; };

  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("button[type=submit]");
    const data = new FormData(ev.target);
    const full_name = String(data.get("full_name")).trim();
    const email = String(data.get("email")).trim();
    const password = String(data.get("password"));
    err.hidden = true;
    if (!full_name || !email || !password) return showError("Заполните все поля");
    if (password.length < 6) return showError("Пароль должен быть не короче 6 символов");
    btn.disabled = true;
    try {
      await api.register({ full_name, email, password });
      startSession(await api.login(email, password));
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
    }
  };
}
