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
        <label class="f" id="lbl-pwd"><span>Пароль</span><input class="i" type="password" name="password" autocomplete="current-password" placeholder="Введите пароль"></label>
        <label class="f" id="lbl-code" style="display:none"><span>6-значный проверочный код</span><input class="i" type="text" name="code" placeholder="123456" maxlength="6" style="letter-spacing:4px;font-size:18px;font-weight:bold;text-align:center"></label>
        <div class="auth-links">
          <a href="#/login" id="forgot">Забыли пароль?</a>
          <a href="#/register">Зарегистрироваться</a>
        </div>
        <button class="btn block" type="submit" id="btn-submit">Войти</button>
        <button type="button" class="btn alt block" id="btn-toggle-code" style="margin-top:10px;font-size:13px">Вход по проверочному коду (Email / Telegram)</button>
        <div style="text-align:center;margin-top:14px;">
          <a href="#/navigator" class="link" style="font-size:13px;display:inline-flex;align-items:center;gap:4px;">🧭 Навигатор для новичка: с чего начать?</a>
        </div>
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

  let isCodeMode = false;
  const toggleBtn = $("#btn-toggle-code");
  const pwdLbl = $("#lbl-pwd");
  const codeLbl = $("#lbl-code");

  toggleBtn.onclick = async () => {
    isCodeMode = !isCodeMode;
    if (isCodeMode) {
      const email = String($("[name=email]").value).trim();
      if (!email) {
        showError("Сначала введите адрес электронной почты");
        isCodeMode = false;
        return;
      }
      try {
        toggleBtn.disabled = true;
        toggleBtn.textContent = "Отправка проверочного кода...";
        const res = await api.requestCode(email, "login");
        pwdLbl.style.display = "none";
        codeLbl.style.display = "block";
        $("#btn-submit").textContent = "Подтвердить и войти";
        toggleBtn.textContent = "Вернуться ко входу по паролю";
        err.className = "hint";
        err.style.color = "#16a34a";
        err.textContent = `Код успешно отправлен! Проверьте вашу почту или Telegram-бота.`;
        err.hidden = false;
      } catch (e) {
        showError(e.message);
        isCodeMode = false;
      } finally {
        toggleBtn.disabled = false;
      }
    } else {
      pwdLbl.style.display = "block";
      codeLbl.style.display = "none";
      $("#btn-submit").textContent = "Войти";
      toggleBtn.textContent = "Вход по проверочному коду (Email / Telegram)";
      err.hidden = true;
      err.className = "err";
      err.style.color = "";
    }
  };

  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = $("#btn-submit");
    const data = new FormData(ev.target);
    const email = String(data.get("email")).trim();
    err.className = "err";
    err.style.color = "";
    err.hidden = true;

    if (!email) return showError("Введите адрес электронной почты");

    btn.disabled = true;
    try {
      if (isCodeMode) {
        const code = String(data.get("code")).trim();
        if (!code) throw new Error("Введите 6-значный проверочный код");
        startSession(await api.loginWithCode(email, code));
      } else {
        const password = String(data.get("password"));
        if (!password) throw new Error("Введите пароль");
        startSession(await api.login(email, password));
      }
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
    }
  };
}
