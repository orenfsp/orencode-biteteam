import { api } from "../api.js";
import { $ } from "../ui.js";
import { startSession } from "./login.js";

export function registerPage(app) {
  app.innerHTML = `
  <div class="auth">
    <div class="auth-card" style="max-width:440px;">
      <img class="auth-logo" src="assets/logo.svg" alt="ФСП">
      <h1>Регистрация</h1>
      <p class="auth-sub">Федерация спортивного программирования</p>
      <form id="f" novalidate>
        <div class="err" id="e" hidden></div>
        <label class="f"><span>ФИО</span><input class="i" type="text" name="full_name" required autocomplete="name" placeholder="Иванов Иван Иванович"></label>
        <label class="f"><span>Email</span><input class="i" type="email" name="email" required autocomplete="username" placeholder="name@example.ru"></label>
        <label class="f"><span>Пароль</span><input class="i" type="password" name="password" required autocomplete="new-password" placeholder="Не короче 6 символов"></label>
        
        <label class="f">
          <span>Желаемая роль в системе</span>
          <select class="i" name="role" required style="font-weight:500;">
            <option value="athlete">🏃 Спортсмен (участие в соревнованиях, разряды)</option>
            <option value="coach">👨‍🏫 Тренер (ведение команды, подача заявок)</option>
            <option value="judge">⚖️ Спортивный судья (судейство, судейские категории)</option>
          </select>
        </label>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <label class="f"><span>Город / Район</span><input class="i" type="text" name="municipality" placeholder="г. Оренбург"></label>
          <label class="f"><span>Телефон</span><input class="i" type="tel" name="phone" placeholder="+7 (900) 000-00-00"></label>
        </div>

        <div style="background:#f1f5f9;border-radius:8px;padding:10px 12px;margin:8px 0 16px;font-size:12px;line-height:1.4;color:#475569;">
          ℹ️ <b>Утверждение роли:</b> Выбранная вами роль отправляется на проверку администратору Федерации. После одобрения вам станут доступны все функции кабинета.
        </div>

        <div class="auth-links">
          <a href="#/login">Уже есть аккаунт?</a>
          <a href="#/navigator">🧭 Навигатор новичка</a>
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
    const role = String(data.get("role") || "athlete");
    const municipality = String(data.get("municipality") || "").trim() || null;
    const phone = String(data.get("phone") || "").trim() || null;

    err.hidden = true;
    if (!full_name || !email || !password) return showError("Заполните все обязательные поля");
    if (password.length < 6) return showError("Пароль должен быть не короче 6 символов");
    btn.disabled = true;
    try {
      await api.register({ full_name, email, password, role, municipality, phone });
      startSession(await api.login(email, password));
    } catch (e) {
      showError(e.message);
      btn.disabled = false;
    }
  };
}
