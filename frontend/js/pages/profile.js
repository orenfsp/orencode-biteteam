import { api } from "../api.js";
import { store, loadUser, loadDisciplines } from "../store.js";
import { esc, fmtDate, initials, ROLE } from "../format.js";
import { loading, field, selectField, toast, $, errorBox } from "../ui.js";

export async function profilePage({ el, user }) {
  el.innerHTML = loading();
  let orgs = []; try { orgs = await api.organizations(); } catch {}
  const u = user;
  const isAth = u.roles.includes("athlete");
  el.innerHTML = `<div class="stack">
  <div class="card"><div class="profile"><div class="big">${esc(initials(u.full_name))}</div><div><h1>${esc(u.full_name)}</h1>
    <div class="sub">${esc(u.email)} · ${u.roles.map(r => esc(ROLE[r] || r)).join(", ")}</div></div></div></div>
  <form class="card" id="pf"><h2>Личные данные</h2><div class="err" id="pe" hidden></div>
    <div class="fgrid">
      ${field("ФИО", "full_name", { value: u.full_name, required: true })}
      ${field("Дата рождения", "birth_date", { type: "date", value: u.birth_date || "" })}
      ${field("Муниципалитет", "municipality", { value: u.municipality || "" })}
      ${field("Телефон", "phone", { value: u.phone || "", type: "tel" })}
      ${selectField("Организация", "organization_id", [["", "— не выбрана —"], ...orgs.map(o => [o.id, o.name])], u.organization_id || "")}
      ${isAth ? field("Год начала занятий", "year_started", { type: "number", value: u.year_started || "" }) : ""}
      ${isAth ? field("Этап подготовки", "sport_preparation_stage", { value: u.sport_preparation_stage || "" }) : ""}
    </div>
    ${isAth ? `<h2 style="margin-top:8px">Антидопинг и законный представитель</h2><div class="fgrid">
      <label class="chk"><input type="checkbox" name="anti_doping_completed" ${u.anti_doping_completed ? "checked" : ""}> Курс РУСАДА пройден</label>
      ${field("Дата прохождения", "anti_doping_date", { type: "date", value: u.anti_doping_date || "" })}
      ${field("Законный представитель", "legal_rep_name", { value: u.legal_rep_name || "" })}
      ${field("Телефон представителя", "legal_rep_phone", { value: u.legal_rep_phone || "" })}
      ${field("E-mail представителя", "legal_rep_email", { type: "email", value: u.legal_rep_email || "" })}</div>` : ""}
    <button class="btn" type="submit">Сохранить</button></form>
  <div class="card"><h2>Уведомления в Telegram</h2><div id="tg" class="hint">Загрузка…</div></div></div>`;

  $("#pf").onsubmit = async (e) => {
    e.preventDefault(); const er = $("#pe"); er.hidden = true;
    const fd = new FormData(e.target); const d = {};
    for (const [k, v] of fd.entries()) d[k] = v === "" ? null : v;
    if (isAth) d.anti_doping_completed = e.target.anti_doping_completed.checked;
    if (d.year_started) d.year_started = +d.year_started;
    try { store.user = await api.updateMe(d); toast("Профиль сохранён"); }
    catch (err) { er.textContent = err.message; er.hidden = false; }
  };
  telegramBlock($("#tg"));
}

export async function telegramBlock(box) {
  try {
    const t = await api.telegramLinkCode();
    box.className = "";
    box.innerHTML = t.is_linked ? `<span class="pill p-grn">Telegram привязан</span>` :
      `<p>Чтобы получать уведомления в Telegram, откройте бота и отправьте код привязки.</p>
       <p>Код: <b style="font-size:20px">${esc(t.link_code)}</b></p>
       ${t.deep_link ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(t.deep_link)}">Открыть бота${t.bot_username ? " @" + esc(t.bot_username) : ""}</a>` : ""}`;
  } catch (e) { box.textContent = "Недоступно: " + e.message; }
}
