import { esc, initials, shortName, ROLE, ROLE_SHORT, fmtDateTime } from "./format.js";
import { NAV, HEADER } from "./nav.js";
import { icon, $, $$, modal, toast } from "./ui.js";
import { api, session } from "./api.js";
import { store, loadNotifs, reset } from "./store.js";
import { go } from "./router.js";

export function renderShell(app, { role, page, user }) {
  const s = session.get();
  const [h1, h2] = HEADER[role] || HEADER.athlete;
  const unread = store.notifs.filter(n => !n.is_read).length;
  app.innerHTML = `
  <div class="shell">
    <div class="logo"><img src="assets/logo.png" alt="ФСП"></div>
    <header class="top">
      <div class="crumb"><small>${esc(h1)}</small><b>${esc(h2)}</b></div>
      <div class="user">
        <button class="bell" id="bell" title="Уведомления">${icon("bell").replace("<svg", '<svg width="24" height="24"')}${unread ? `<i>${unread}</i>` : ""}</button>
        <div class="who"><b>${esc(ROLE_SHORT[role])}: ${esc(shortName(user.full_name))}</b><span>${esc(user.municipality ? "г. " + user.municipality.replace(/^г\.\s*/, "") : "")}</span></div>
        <button class="avatar" id="avatar" title="Меню">${esc(initials(user.full_name))}</button>
      </div>
    </header>
    <nav class="side">${NAV[role].map(([k, t, ic]) => `<a href="#/${k}" class="${page === k ? "on" : ""}">${icon(ic)}${esc(t)}</a>`).join("")}</nav>
    <main class="main" id="main"></main>
  </div>`;

  $("#bell").onclick = () => showNotifs();
  $("#avatar").onclick = (e) => { e.stopPropagation(); toggleMenu(s, user); };
  return $("#main");
}

function toggleMenu(s, user) {
  const ex = $(".menu"); if (ex) { ex.remove(); return; }
  const m = document.createElement("div"); m.className = "menu";
  const roles = s.roles || [];
  m.innerHTML = `<div class="lbl">${esc(user.email)}</div>
    ${roles.length > 1 ? `<div class="lbl">Сменить роль</div>` + roles.map(r => `<button data-role="${r}" class="${r === s.activeRole ? "on" : ""}">${r === s.activeRole ? "✓ " : ""}${esc(ROLE[r] || r)}</button>`).join("") + "<hr>" : ""}
    <button data-act="logout">Выйти</button>`;
  $(".user").appendChild(m);
  const closer = () => { m.remove(); document.removeEventListener("click", closer); };
  setTimeout(() => document.addEventListener("click", closer), 0);
  m.onclick = async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.act === "logout") { session.clear(); reset(); go("/login"); return; }
    if (b.dataset.role && b.dataset.role !== s.activeRole) {
      try {
        const t = await api.switchRole(b.dataset.role);
        session.set({ ...s, token: t.access_token, activeRole: t.active_role, roles: t.roles });
        go("/home"); location.reload();
      } catch (err) { toast(err.message, true); }
    }
  };
}

async function showNotifs() {
  await loadNotifs();
  const list = store.notifs;
  const m = modal({
    title: "Уведомления", hideSubmit: true, cancelText: "Закрыть", wide: false,
    body: list.length ? list.map(n => `<div class="box" style="margin-bottom:10px;${n.is_read ? "opacity:.6" : ""}">
        <div class="grow"><div class="t">${esc(n.title)}</div><div class="s">${esc(n.body)}</div><div class="s">${esc(fmtDateTime(n.created_at))}</div></div>
        ${n.is_read ? "" : `<button type="button" class="link" data-read="${n.id}">Прочитано</button>`}</div>`).join("") : `<div class="empty">Уведомлений нет</div>`,
  });
  m.el.addEventListener("click", async (e) => {
    const id = e.target.dataset?.read; if (!id) return;
    try { await api.readNotification(id); e.target.closest(".box").style.opacity = ".6"; e.target.remove(); await loadNotifs(); const i = $("#bell i"); const n = store.notifs.filter(x => !x.is_read).length; if (i) { n ? i.textContent = n : i.remove(); } } catch (err) { toast(err.message, true); }
  });
}
