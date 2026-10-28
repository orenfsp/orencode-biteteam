import { api, session } from "../api.js";
import { esc, ROLE } from "../format.js";
import { go } from "../router.js";
import { reset } from "../store.js";
import { telegramBlock } from "./profile.js";

export async function pendingPage(app, user) {
  const s = session.get();
  const pendingRoles = user.pending_roles || [];
  const roleName = pendingRoles.map(r => ROLE[r] || r).join(", ") || (s?.activeRole?.replace(/^pending:?/, "") || "Пользователь");
  const displayRole = ROLE[roleName] || roleName;

  app.innerHTML = `
  <div class="shell" style="grid-template-columns:1fr;display:block;min-height:100vh;background:var(--bg,#f1f5f9);">
    <main class="main" style="max-width:720px;margin:30px auto;padding:20px;">
      <div class="card" style="padding:36px 30px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;line-height:1;margin-bottom:14px">⏳</div>
          <h1 style="margin:0 0 8px;font-size:24px">Заявка на утверждении</h1>
          <p class="auth-sub" style="font-size:15px;margin:0">
            Здравствуйте, <b>${esc(user.full_name)}</b>! Ваш аккаунт успешно зарегистрирован.
          </p>
        </div>

        <div class="kv" style="margin:0 auto 22px;background:var(--card-sub,#fff);padding:18px;border-radius:12px;border:1px solid var(--border,#e2e8f0)">
          <small>Email</small><b>${esc(user.email)}</b>
          <small>Запрошенная роль</small><b><span class="pill p-lav">${esc(displayRole)}</span></b>
          <small>Статус</small><b><span class="pill p-yel">На рассмотрении администратором ФСП</span></b>
          <small>Муниципалитет</small><b>${esc(user.municipality || "—")}</b>
        </div>

        <div style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:14px;line-height:1.5;color:#334155">
          <b>ℹ️ Регламент Федерации:</b><br>
          Согласно правилам ФСП Оренбургской области, доступ к функциям выбранной роли («${esc(displayRole)}») активируется после проверки и утверждения уполномоченным администратором Федерации.
        </div>

        <div class="card" style="border:1px solid var(--border,#e2e8f0);margin-bottom:24px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:16px">🔔 Уведомления в Telegram</h3>
          <p class="hint" style="margin-bottom:14px">
            Привяжите Telegram-бота <b>@fsp123_bot</b>, чтобы сразу получить уведомление на смартфон в момент утверждения вашей роли.
          </p>
          <div id="tg-box">Загрузка данных Telegram...</div>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;margin-top:10px;">
          <button class="btn" id="btn-check-status" style="min-width:180px">🔄 Проверить статус</button>
          <button class="btn alt" id="btn-logout">🚪 Выйти из аккаунта</button>
        </div>
      </div>
    </main>
  </div>`;

  const tgBox = document.getElementById("tg-box");
  if (tgBox) telegramBlock(tgBox);

  document.getElementById("btn-check-status").onclick = async () => {
    try {
      const refreshed = await api.me();
      if (refreshed.roles && refreshed.roles.length > 0) {
        const newActive = refreshed.active_role || refreshed.roles[0];
        session.set({ ...s, roles: refreshed.roles, activeRole: newActive });
        location.hash = "#/home";
        location.reload();
      } else {
        alert("Заявка пока находится на рассмотрении администратором Федерации. Пожалуйста, ожидайте.");
      }
    } catch (e) {
      alert("Ошибка при проверке статуса: " + e.message);
    }
  };

  document.getElementById("btn-logout").onclick = () => {
    session.clear();
    reset();
    go("/login");
  };
}
