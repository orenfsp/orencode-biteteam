import { api, saveBlob } from "../api.js";
import { loadDisciplines } from "../store.js";
import { esc, fmtDate, RANK, resultPill, statusPill, pill, ORG_TYPE } from "../format.js";
import { loading, toast, $, $$ } from "../ui.js";
import { go } from "../router.js";
import { upcoming, compMiniList, canApply, deadlinePassed, openApplyModal, openRankApplyModal, bestRank, rankDaysText, loadAppsMap } from "./shared.js";

async function data(user) {
  const [ranks, results, comps, apps] = await Promise.all([
    api.athleteRanks(user.id).catch(() => []), api.athleteResults(user.id).catch(() => []), api.competitions(), loadAppsMap(),
  ]);
  const cmap = Object.fromEntries(comps.map(c => [c.id, c]));
  return { ranks, results, comps, cmap, apps };
}
const resRows = (results, cmap) => results.map(r => { const c = cmap[r.competition_id] || {}; return { r, c }; })
  .sort((a, b) => new Date(b.c.start_date || b.r.created_at) - new Date(a.c.start_date || a.r.created_at));

function resultsTable(rows, limit) {
  if (!rows.length) return `<div class="empty">Результатов пока нет</div>`;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Соревнование</th><th>Дата</th><th>Дисциплина</th><th>Место</th><th>Статус</th></tr></thead><tbody>
  ${rows.slice(0, limit || 999).map(({ r, c }) => `<tr><td>${esc(r.competition_title || c.title)}</td><td>${fmtDate(c.start_date)}</td><td>${esc(c.discipline_name || "—")}</td><td>${esc(r.place ?? "—")}</td><td>${resultPill(r)}</td></tr>`).join("")}</tbody></table></div>`;
}

export async function home({ el, user, rerender }) {
  el.innerHTML = loading();
  const { ranks, results, comps, cmap, apps } = await data(user);
  const rank = bestRank(ranks);
  const rows = resRows(results, cmap);
  const discs = [...new Set(rows.map(x => x.c.discipline_name).filter(Boolean))];
  const mine = new Map(apps.filter(a => a.athlete_id === user.id).map(a => [a.competition_id, a]));
  const up = upcoming(comps).slice(0, 3);
  const org = user.organization_name || "—";

  el.innerHTML = `<div class="stack">
  <div class="card"><div class="profile"><div class="big">${esc(user.full_name.split(/\s+/).slice(0, 2).map(w => w[0]).join(""))}</div>
    <div class="grow"><h1>${esc(user.full_name)}</h1><div class="sub">Дата рождения: ${esc(fmtDate(user.birth_date))}</div>
    <div class="facts"><div><small>Муниципалитет</small><b>${esc(user.municipality ? "г. " + user.municipality.replace(/^г\.\s*/, "") : "—")}</b></div>
      <div><small>Организация</small><b>${esc(org)}</b></div>
      <div><small>Дисциплины</small><b>${esc(discs.join(", ") || "—")}</b></div>
      <div><small>Тренер</small><b>${esc(user.coach_name || "—")}</b></div></div></div></div></div>
  <div class="grid g2">
    <div class="card"><div class="darkbox"><div class="row"><div><small>Текущий разряд</small><b>${esc(rank ? RANK[rank.rank] || rank.rank : "Нет разряда")}</b></div>
      ${rank ? `<div style="text-align:right"><small>${rank.valid_until ? "До окончания" : "Срок действия"}</small><b>${esc(rankDaysText(rank))}</b></div>` : ""}</div></div>
      <div class="box" style="margin-top:18px"><span>${user.anti_doping_completed ? `Онлайн-курс РУСАДА пройден ${esc(fmtDate(user.anti_doping_date))}` : "Онлайн-курс РУСАДА не пройден"}</span>
        ${user.anti_doping_completed ? `<a class="link" href="#/documents">Скачать сертификат</a>` : `<a class="link" href="#/profile">Отметить в профиле</a>`}</div>
      <button class="btn" id="rank" style="margin-top:18px">Подать заявку на МС</button></div>
    <div class="card">${compMiniList(up, { action: c => { const m = mine.get(c.id); return m ? statusPill(m.status) : canApply(c) ? `<button class="btn sm" data-apply="${c.id}">Подать заявку</button>` : pill("Приём закрыт", "p-gry"); } })}</div>
  </div>
  <div class="card"><h2>Мои результаты</h2>${resultsTable(rows, 5)}</div></div>`;

  $("#rank").onclick = () => openRankApplyModal({ results, onDone: rerender });
  $$("[data-apply]", el).forEach(b => b.onclick = () => openApplyModal(cmap[b.dataset.apply], { onDone: rerender }));
}

export async function results({ el, user }) {
  el.innerHTML = loading();
  const { results, cmap, ranks } = await data(user);
  el.innerHTML = `<div class="stack"><div class="card"><h2>Мои результаты</h2>${resultsTable(resRows(results, cmap))}</div>
    <div class="card"><h2>История разрядов</h2>${ranks.length ? `<table class="tbl"><thead><tr><th>Разряд</th><th>Присвоен</th><th>Приказ</th><th>Действует до</th><th>Статус</th></tr></thead><tbody>
    ${ranks.map(r => `<tr><td><b>${esc(RANK[r.rank] || r.rank)}</b></td><td>${fmtDate(r.assigned_date)}</td><td>${esc(r.order_number || "—")}</td><td>${r.valid_until ? fmtDate(r.valid_until) : "Бессрочно"}</td>
    <td>${r.status === "active" ? pill(r.is_expiring_soon ? "Истекает" : "Действует", r.is_expiring_soon ? "p-yel" : "p-grn") : pill("Не действует", "p-gry")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Разрядов пока нет</div>`}</div></div>`;
}

export async function documents({ el, user, rerender }) {
  el.innerHTML = loading();
  const { results, cmap, apps } = await data(user);
  let rankApps = [];
  const rows = resRows(results, cmap).filter(x => x.r.status === "normal" && x.r.place);
  el.innerHTML = `<div class="stack"><div class="card"><div class="head"><h2>Документы</h2></div>
    <p class="hint">Справка об участии с QR-кодом подтверждает результат. Проверить её подлинность можно по QR-коду на публичной странице.</p>
    ${rows.length ? `<table class="tbl"><thead><tr><th>Соревнование</th><th>Дата</th><th>Место</th><th class="r">Справка</th></tr></thead><tbody>
    ${rows.map(({ r, c }) => `<tr><td>${esc(r.competition_title || c.title)}</td><td>${fmtDate(c.start_date)}</td><td>${esc(r.place)}</td>
      <td class="r"><button class="btn sm light" data-cert="${r.id}" data-t="${esc(r.competition_title || c.title)}">Скачать справку (PDF)</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">Справки доступны после подтверждённых результатов</div>`}</div>
    <div class="card"><h2>Мои заявки</h2>${apps.length ? `<table class="tbl"><thead><tr><th>Соревнование</th><th>Подана</th><th>Статус</th></tr></thead><tbody>
    ${apps.map(a => `<tr><td>${esc(a.competition_title)}</td><td>${fmtDate(a.submitted_at)}</td><td>${statusPill(a.status)}${a.rejection_reason ? `<div class="sub">${esc(a.rejection_reason)}</div>` : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Заявок нет</div>`}</div></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-cert]"); if (!b) return;
    b.disabled = true;
    try { const c = await api.createCertificate(b.dataset.cert); saveBlob(await api.certificatePdf(c.id), `spravka-${c.number}.pdf`); toast("Справка скачана"); }
    catch (err) { toast(err.message, true); } finally { b.disabled = false; }
  };
}
