import { api, saveBlob } from "../api.js";
import { loadDisciplines } from "../store.js";
import { esc, fmtDate, fmtDateTime, rangeLong, RANK, JCAT, JCAT_SHORT, FORMAT, LEVEL, COMP_STATUS, ORG_TYPE, statusPill, compPill, pill, resultPill, posName, age, initials, dayMonthLong } from "../format.js";
import { loading, toast, $, $$, modal, field, selectField, confirmBox } from "../ui.js";
import { go } from "../router.js";
import { sortByStart, compSub } from "./shared.js";
import { telegramBlock } from "./profile.js";

const OPEN = ["submitted", "under_review"];
const todayISO = () => new Date().toISOString().slice(0, 10);
const NEWS = () => (window.APP_CONFIG && window.APP_CONFIG.NEWS) || [{ title: "Пять лет Федерации спортивного программирования: Москва принимает финал Кубка 2026", tag: "Новости федерации" }];

async function loadAttention(comps) {
  const open = comps.filter(c => ["registration_open", "registration_closed", "in_progress"].includes(c.status));
  const [rankApps, catApps, ...partLists] = await Promise.all([
    api.rankApplications().catch(() => []), api.categoryApplications().catch(() => []),
    ...open.map(c => api.competitionApplications(c.id).catch(() => [])),
  ]);
  const rows = [
    ...partLists.flat().map(a => ({ kind: "part", raw: a, who: a.athlete_name, type: "Участие: " + a.competition_title, at: a.submitted_at, status: a.status })),
    ...rankApps.map(a => ({ kind: "rank", raw: a, who: a.athlete_name, type: "Присвоение разряда " + (RANK[a.requested_rank] || a.requested_rank), at: a.submitted_at, status: a.status })),
    ...catApps.map(a => ({ kind: "judge", raw: a, who: a.judge_name, type: a.application_type === "confirmation" ? "Подтверждение судейской категории" : "Судейская категория", at: a.submitted_at, status: a.status })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return { rows, rankApps, catApps };
}

function attentionTable(rows) {
  if (!rows.length) return `<div class="empty">Заявок, требующих внимания, нет</div>`;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Заявитель</th><th>Тип заявки</th><th>Подана</th><th>Статус</th><th></th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td>${esc(r.who || "—")}</td><td>${esc(r.type)}</td><td>${fmtDate(r.at)}</td><td>${statusPill(r.status)}</td>
    <td class="r">${OPEN.includes(r.status) ? `<button class="link" data-review="${i}">Рассмотреть →</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

function reviewModal(r, done) {
  const a = r.raw, isRank = r.kind === "rank", isJudge = r.kind === "judge";
  modal({
    title: "Рассмотрение заявки", submitText: "Сохранить решение",
    body: `<div class="kv" style="margin:0 0 18px"><small>Заявитель</small><b>${esc(r.who)}</b><small>Тип</small><b>${esc(r.type)}</b><small>Подана</small><b>${fmtDateTime(r.at)}</b>
      ${r.kind === "part" ? `<small>Организация</small><b>${esc(a.athlete_organization || "—")}</b>` : ""}${isRank ? `<small>Результат</small><b>${esc(a.competition_title)}${a.result_place ? ", " + a.result_place + " место" : ""}</b>` : ""}</div>` +
      selectField("Решение", "status", [["approved", "Одобрить"], ["rejected", "Отклонить"], ["under_review", "Взять на рассмотрение"]], "approved") +
      (isRank ? `<div class="fgrid">${field("Номер приказа", "order_number")}${field("Дата присвоения", "assigned_date", { type: "date", value: todayISO() })}</div>` : "") +
      (isJudge ? `<div class="fgrid">${field("Номер приказа", "order_number")}${field("Дата присвоения", "assigned_date", { type: "date", value: todayISO() })}${field("Действует до", "valid_until", { type: "date", value: new Date(Date.now() + 3 * 365 * 864e5).toISOString().slice(0, 10) })}</div>` : "") +
      field("Причина отказа (при отклонении)", "rejection_reason"),
    onSubmit: async (d) => {
      if (d.status === "rejected" && !d.rejection_reason) throw new Error("Укажите причину отказа");
      const base = { status: d.status, rejection_reason: d.status === "rejected" ? d.rejection_reason : null };
      if (r.kind === "part") await api.moderateApplication(a.id, base);
      if (isRank) await api.reviewRankApplication(a.id, { ...base, order_number: d.order_number || null, assigned_date: d.assigned_date || null });
      if (isJudge) await api.reviewCategoryApplication(a.id, { ...base, order_number: d.order_number || null, assigned_date: d.assigned_date || null, valid_until: d.valid_until || null });
      toast("Решение сохранено"); done();
    },
  });
}

async function competitionModal(c, done) {
  const discs = await loadDisciplines();
  const dt = c?.registration_deadline ? new Date(new Date(c.registration_deadline).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "";
  modal({
    title: c ? "Редактирование соревнования" : "Новое соревнование", wide: true, submitText: c ? "Сохранить" : "Создать",
    body: `<div class="fgrid">${field("Название", "title", { value: c?.title || "", required: true })}
      ${selectField("Дисциплина", "discipline_id", discs.map(d => [d.id, d.name]), c?.discipline_id || discs[0]?.id)}
      ${field("Дата начала", "start_date", { type: "date", value: c?.start_date || "", required: true })}${field("Дата окончания", "end_date", { type: "date", value: c?.end_date || "", required: true })}
      ${field("Место проведения", "location", { value: c?.location || "" })}${selectField("Формат", "format", Object.entries(FORMAT), c?.format || "onsite")}
      ${selectField("Уровень", "level", Object.entries(LEVEL), c?.level || "regional")}${field("Возрастная группа", "age_group", { value: c?.age_group || "" })}
      ${field("Мин. возраст", "min_age", { type: "number", value: c?.min_age ?? "" })}${field("Макс. возраст", "max_age", { type: "number", value: c?.max_age ?? "" })}
      ${field("Приём заявок до", "registration_deadline", { type: "datetime-local", value: dt })}${field("№ в ЕКП", "calendar_plan_number", { value: c?.calendar_plan_number || "" })}
      ${c ? selectField("Статус", "status", Object.entries(COMP_STATUS), c.status) : selectField("Статус", "status", Object.entries(COMP_STATUS).filter(([k]) => ["draft", "registration_open"].includes(k)), "registration_open")}</div>
      <label class="f"><span>Описание</span><textarea class="i" name="description" rows="3">${esc(c?.description || "")}</textarea></label>`,
    onSubmit: async (d) => {
      const body = { title: d.title, description: d.description || null, discipline_id: +d.discipline_id, start_date: d.start_date, end_date: d.end_date, location: d.location || null,
        format: d.format, level: d.level, age_group: d.age_group || null, min_age: d.min_age === "" ? null : +d.min_age, max_age: d.max_age === "" ? null : +d.max_age,
        registration_deadline: d.registration_deadline ? new Date(d.registration_deadline).toISOString() : null, calendar_plan_number: d.calendar_plan_number || null };
      if (c) { body.status = d.status; await api.updateCompetition(c.id, body); }
      else { const n = await api.createCompetition(body); if (d.status !== "draft") { try { await api.updateCompetition(n.id, { status: d.status }); } catch {} } }
      toast(c ? "Соревнование обновлено" : "Соревнование создано"); done();
    },
  });
}

export async function home({ el, rerender }) {
  el.innerHTML = loading();
  const [athletes, comps] = await Promise.all([api.users({ role: "athlete" }).catch(() => []), api.competitions()]);
  const { rows, rankApps } = await loadAttention(comps);
  const attn = rows.filter(r => OPEN.includes(r.status));
  const done = comps.filter(c => c.status === "completed").length;
  const awarded = rankApps.filter(a => a.status === "approved").length;
  const near = sortByStart(comps.filter(c => ["registration_open", "registration_closed", "in_progress"].includes(c.status))).slice(0, 2);
  const news = NEWS()[0];
  el.innerHTML = `<div class="stack">
  <div class="grid g4">
    <div class="stat"><small>Занимающихся</small><b>${athletes.length}</b></div>
    <div class="stat"><small>Соревнований</small><b>${done} <em>проведено</em></b></div>
    <div class="stat"><small>Разрядов</small><b>${awarded} <em>присвоено</em></b></div>
    <div class="stat dark"><small>Требуют внимания</small><b>${attn.length} <em>${attn.length % 10 === 1 && attn.length !== 11 ? "заявка" : [2, 3, 4].includes(attn.length % 10) && ![12, 13, 14].includes(attn.length) ? "заявки" : "заявок"}</em></b></div></div>
  <div class="grid g-7-5" style="grid-template-columns:1.45fr 1fr">
    <div class="card"><div style="background:var(--lav);border-radius:18px;height:188px;${news.image ? `background-image:url('${esc(news.image)}');background-size:cover;background-position:center;` : ""}"></div>
      <h2 style="margin:20px 0 6px;font-size:18px">${esc(news.title)}</h2><div class="sub">${esc(news.tag || "Новости федерации")}</div></div>
    <div class="card">${near.length ? near.map(c => `<a class="box" href="#/competitions/${c.id}" style="color:inherit"><div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${c.registration_deadline ? "До " + dayMonthLong(c.registration_deadline) : esc(rangeLong(c.start_date, c.end_date))}</div></div>${compPill(c.status)}</a>`).join("") : `<div class="empty">Нет активных соревнований</div>`}
      <button class="btn block" id="new" style="margin-top:22px">+ Создать соревнование</button></div></div>
  <div class="card"><h2>Заявки, требующие внимания</h2>${attentionTable(attn.slice(0, 6))}</div></div>`;
  $("#new").onclick = () => competitionModal(null, () => go("/competitions"));
  bindReview(el, attn, rerender);
}
function bindReview(el, rows, rerender) {
  el.addEventListener("click", e => { const b = e.target.closest("[data-review]"); if (b) reviewModal(rows[+b.dataset.review], rerender); });
}

export async function competitions({ el, id, rerender }) {
  if (id) return competitionDetail(el, id);
  el.innerHTML = loading();
  const comps = await api.competitions();
  const list = [...comps].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  el.innerHTML = `<div class="card"><div class="head"><h2>Соревнования</h2><button class="btn sm" id="new">+ Создать соревнование</button></div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Название</th><th>Даты</th><th>Дисциплина</th><th>Уровень</th><th>Заявок</th><th>Статус</th></tr></thead><tbody>
  ${list.map(c => `<tr><td><a href="#/competitions/${c.id}"><b>${esc(c.title)}</b></a><div class="sub">${esc(c.location || "")}</div></td><td>${esc(rangeLong(c.start_date, c.end_date))}</td><td>${esc(c.discipline_name || "")}</td><td>${esc(LEVEL[c.level] || c.level)}</td><td>${c.applications_count ?? 0}</td><td>${compPill(c.status)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Соревнований нет</td></tr>`}</tbody></table></div></div>`;
  $("#new").onclick = () => competitionModal(null, rerender);
}

async function competitionDetail(el, id) {
  el.innerHTML = loading();
  let tab = sessionStorage.getItem("ctab") || "apps";
  const draw = async () => {
    const c = await api.competition(id);
    const [apps, judgesA, proto] = await Promise.all([api.competitionApplications(id).catch(() => []), api.judgeAssignments(id).catch(() => []), api.protocol(id).catch(() => null)]);
    el.innerHTML = `<div class="stack"><div class="card"><div class="head"><div><a href="#/competitions" class="link">← Все соревнования</a><h2 style="margin-top:8px">${esc(c.title)}</h2>
      <div class="sub">${esc(rangeLong(c.start_date, c.end_date))} · ${esc(c.location || "место не указано")} · ${esc(compSub(c))} · ${esc(LEVEL[c.level] || c.level)}</div></div>
      <div style="display:flex;gap:10px;align-items:center">${compPill(c.status)}<button class="btn sm ghost" id="edit">Изменить</button></div></div>
      ${c.description ? `<p>${esc(c.description)}</p>` : ""}
      ${c.registration_deadline ? `<div class="hint">Приём заявок до ${fmtDateTime(c.registration_deadline)}</div>` : ""}</div>
      <div class="tabs">${[["apps", `Заявки (${apps.length})`], ["judges", `Судьи (${judgesA.length})`], ["results", "Результаты"], ["docs", "Документы"]].map(([k, t]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <div id="tabbody"></div></div>`;
    $("#edit").onclick = () => competitionModal(c, draw);
    $$("[data-tab]", el).forEach(b => b.onclick = () => { tab = b.dataset.tab; sessionStorage.setItem("ctab", tab); draw(); });
    const body = $("#tabbody");
    if (tab === "apps") appsTab(body, apps, draw);
    if (tab === "judges") await judgesTab(body, c, judgesA, draw);
    if (tab === "results") resultsTab(body, c, apps, proto, draw);
    if (tab === "docs") docsTab(body, c, proto);
  };
  await draw();
}

function appsTab(body, apps, draw) {
  body.innerHTML = `<div class="card">${apps.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Спортсмен</th><th>Организация</th><th>Возраст</th><th>Подал</th><th>Статус</th><th></th></tr></thead><tbody>
  ${apps.map(a => `<tr><td>${esc(a.athlete_name)}</td><td>${esc(a.athlete_organization || "—")}</td><td>${esc(age(a.athlete_birth_date) ?? "—")}</td><td>${esc(a.submitted_by_name || "—")}</td><td>${statusPill(a.status)}${a.rejection_reason ? `<div class="sub">${esc(a.rejection_reason)}</div>` : ""}</td>
  <td class="r">${OPEN.includes(a.status) ? `<button class="link" data-i="${apps.indexOf(a)}">Рассмотреть →</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Заявок пока нет</div>`}</div>`;
  body.onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; const a = apps[+b.dataset.i];
    reviewModal({ kind: "part", raw: a, who: a.athlete_name, type: "Участие: " + a.competition_title, at: a.submitted_at }, draw); };
}

async function judgesTab(body, c, list, draw) {
  body.innerHTML = `<div class="card"><div class="head"><h2>Судейская коллегия</h2><button class="btn sm" id="as">+ Назначить судью</button></div>
  ${list.length ? `<table class="tbl"><thead><tr><th>Судья</th><th>Должность</th></tr></thead><tbody>${list.map(j => `<tr><td>${esc(j.judge_name)}</td><td>${esc(posName(j.position))}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Судьи не назначены</div>`}</div>`;
  $("#as", body).onclick = async () => {
    const judges = await api.judges();
    modal({ title: "Назначить судью", submitText: "Назначить",
      body: selectField("Судья", "judge_id", judges.map(j => [j.judge_id, `${j.full_name} — ${JCAT_SHORT[j.category] || j.category}`]), "", { required: true }) +
        selectField("Должность", "position", ["Главный судья", "Заместитель главного судьи", "Судья-секретарь", "Судья"].map(x => [x, x]), "Судья"),
      onSubmit: async (d) => { await api.assignJudge({ judge_id: d.judge_id, competition_id: c.id, position: d.position }); toast("Судья назначен"); draw(); } });
  };
}

function resultsTab(body, c, apps, proto, draw) {
  const existing = new Map((proto?.results || []).map(r => [r.athlete_id, r]));
  const people = new Map();
  apps.filter(a => a.status === "approved").forEach(a => people.set(a.athlete_id, a.athlete_name));
  existing.forEach((r, k) => people.set(k, r.athlete_name));
  if (!people.size) { body.innerHTML = `<div class="card"><div class="empty">Нет участников: одобрите заявки, чтобы внести результаты</div></div>`; return; }
  const ST = [["normal", "Участвовал"], ["disqualified", "Дисквалифицирован"], ["dns", "Не стартовал"], ["dnf", "Не финишировал"]];
  body.innerHTML = `<form class="card" id="rf"><div class="head"><h2>Протокол результатов</h2><button class="btn sm" type="submit">Сохранить протокол</button></div><div class="err" hidden id="re"></div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Участник</th><th>Место</th><th>Баллы</th><th>Статус</th></tr></thead><tbody>
  ${[...people].map(([id, name]) => { const r = existing.get(id) || {}; return `<tr data-id="${id}"><td>${esc(name)}</td>
    <td><input class="i" style="width:80px" type="number" min="1" name="place" value="${r.place ?? ""}"></td><td><input class="i" style="width:100px" type="number" step="0.01" name="score" value="${r.score ?? ""}"></td>
    <td><select class="i" name="status">${ST.map(([v, t]) => `<option value="${v}" ${r.status === v ? "selected" : ""}>${t}</option>`).join("")}</select></td></tr>`; }).join("")}</tbody></table></div></form>`;
  $("#rf", body).onsubmit = async (e) => {
    e.preventDefault(); const er = $("#re", body); er.hidden = true;
    const items = $$("tbody tr", e.target).map(tr => ({ athlete_id: tr.dataset.id, place: tr.querySelector("[name=place]").value ? +tr.querySelector("[name=place]").value : null,
      score: tr.querySelector("[name=score]").value ? +tr.querySelector("[name=score]").value : null, status: tr.querySelector("[name=status]").value }));
    try { await api.results(c.id, items); toast("Протокол сохранён"); draw(); } catch (err) { er.textContent = err.message; er.hidden = false; }
  };
}

function docsTab(body, c, proto) {
  body.innerHTML = `<div class="card"><h2>Документы</h2><p class="hint">Официальный протокол соревнования${proto?.results?.length ? "" : " (появится после внесения результатов)"}.</p>
  <div style="display:flex;gap:10px"><button class="btn" data-f="docx">Протокол .docx</button><button class="btn light" data-f="pdf">Протокол .pdf</button></div></div>`;
  body.onclick = async e => { const b = e.target.closest("[data-f]"); if (!b) return; b.disabled = true;
    try { saveBlob(await (b.dataset.f === "docx" ? api.protocolDocx(c.id) : api.protocolPdf(c.id)), `protocol-${c.id.slice(0, 8)}.${b.dataset.f}`); } catch (err) { toast(err.message, true); } b.disabled = false; };
}

export async function athletes({ el, rerender }) {
  el.innerHTML = loading();
  const [users, orgs] = await Promise.all([api.users({ role: "athlete" }), api.organizations().catch(() => [])]);
  const f = { q: "", org: "", dq: "" };
  const draw = () => {
    const list = users.filter(u => (!f.q || u.full_name.toLowerCase().includes(f.q.toLowerCase())) && (!f.org || u.organization_id === f.org) && (f.dq === "" || String(!!u.is_disqualified) === f.dq));
    $("#rows").innerHTML = list.map(u => `<tr><td><a href="#" data-u="${u.id}"><b>${esc(u.full_name)}</b></a></td><td>${esc(u.organization_name || "—")}</td><td>${esc(u.municipality || "—")}</td><td>${esc(age(u.birth_date) ?? "—")}</td>
      <td>${u.is_disqualified ? pill("Дисквалифицирован", "p-red") : pill("Допущен", "p-grn")}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Никого не найдено</td></tr>`;
    $("#cnt").textContent = `Найдено: ${list.length}`;
  };
  el.innerHTML = `<div class="card"><div class="head"><h2>Спортсмены</h2><div class="filters"><input class="i" id="q" placeholder="Поиск по ФИО" style="width:220px">
    <select class="i" id="org" style="width:220px"><option value="">Все организации</option>${orgs.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select>
    <select class="i" id="dq" style="width:170px"><option value="">Все статусы</option><option value="false">Допущены</option><option value="true">Дисквалифицированы</option></select></div></div>
    <div class="hint" id="cnt" style="margin-bottom:8px"></div><div class="tblwrap"><table class="tbl"><thead><tr><th>ФИО</th><th>Организация</th><th>Муниципалитет</th><th>Возраст</th><th>Статус</th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
  $("#q").oninput = e => { f.q = e.target.value; draw(); }; $("#org").onchange = e => { f.org = e.target.value; draw(); }; $("#dq").onchange = e => { f.dq = e.target.value; draw(); };
  el.addEventListener("click", e => { const a = e.target.closest("[data-u]"); if (!a) return; e.preventDefault(); athleteModal(users.find(u => u.id === a.dataset.u), rerender); });
  draw();
}

async function athleteModal(u, rerender) {
  const [ranks, results] = await Promise.all([api.athleteRanks(u.id).catch(() => []), api.athleteResults(u.id).catch(() => [])]);
  const m = modal({ title: u.full_name, wide: true, hideSubmit: true, cancelText: "Закрыть",
    body: `<div class="kv" style="margin-top:0"><small>E-mail</small><b>${esc(u.email)}</b><small>Дата рождения</small><b>${fmtDate(u.birth_date)}</b><small>Организация</small><b>${esc(u.organization_name || "—")}</b>
      <small>Телефон</small><b>${esc(u.phone || "—")}</b><small>Антидопинг</small><b>${u.anti_doping_completed ? "Пройден " + fmtDate(u.anti_doping_date) : "Не пройден"}</b>
      ${u.is_disqualified ? `<small>Дисквалификация</small><b>${esc(u.disqualification_reason || "")} ${u.disqualification_until ? "до " + fmtDate(u.disqualification_until) : ""}</b>` : ""}</div>
      <h2 style="margin:20px 0 8px;font-size:16px">Разряды</h2>${ranks.length ? ranks.map(r => `<div class="box"><b>${esc(RANK[r.rank] || r.rank)}</b><span class="hint">${r.valid_until ? "до " + fmtDate(r.valid_until) : "бессрочно"}</span></div>`).join("") : `<div class="hint">Нет</div>`}
      <h2 style="margin:20px 0 8px;font-size:16px">Результаты</h2>${results.length ? results.slice(0, 8).map(r => `<div class="box"><span>${esc(r.competition_title)}</span><span>${esc(r.place ?? "—")} место ${resultPill(r)}</span></div>`).join("") : `<div class="hint">Нет</div>`}
      <div style="margin-top:18px"><button type="button" class="btn ${u.is_disqualified ? "light" : "danger"}" id="dq">${u.is_disqualified ? "Снять дисквалификацию" : "Дисквалифицировать"}</button></div>` });
  $("#dq", m.el).onclick = () => {
    if (u.is_disqualified) return api.setDisqualification(u.id, { is_disqualified: false }).then(() => { toast("Дисквалификация снята"); m.close(); rerender(); }).catch(e => toast(e.message, true));
    m.close();
    modal({ title: "Дисквалификация", submitText: "Дисквалифицировать", body: field("Причина", "reason", { required: true }) + field("До (необязательно)", "until", { type: "date" }),
      onSubmit: async (d) => { await api.setDisqualification(u.id, { is_disqualified: true, disqualification_reason: d.reason, disqualification_until: d.until || null }); toast("Спортсмен дисквалифицирован"); rerender(); } });
  };
}

export async function analytics({ el, rerender }) {
  el.innerHTML = loading();
  const [discs, rosters, ranks, judges] = await Promise.all([loadDisciplines(), api.rosters().catch(() => []), api.expiringRanks(60).catch(() => []), api.expiringJudges(60).catch(() => [])]);
  const y = new Date().getFullYear(), m = new Date().getMonth();
  const season = (m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`);
  const st = { d: discs[0]?.id, s: season, data: null };
  el.innerHTML = `<div class="stack">
  <div class="card"><div class="head"><h2>Рейтинг спортсменов</h2><div class="filters">
    <select class="i" id="d" style="width:230px">${discs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select>
    <input class="i" id="s" value="${season}" style="width:110px" title="Сезон">
    <button class="btn sm" id="roster">Сформировать сборную</button><button class="btn sm light" id="xlsx">Отчёт .xlsx</button></div></div><div id="rating"></div></div>
  <div class="grid g2"><div class="card"><h2>Истекающие разряды (60 дней)</h2>${ranks.length ? `<table class="tbl"><tbody>${ranks.map(r => `<tr><td>${esc(r.athlete_name)}</td><td>${esc(RANK[r.rank] || r.rank)}</td><td class="r">${fmtDate(r.valid_until)} ${pill(r.days_left + " дн.", r.days_left <= 30 ? "p-red" : "p-yel")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Нет</div>`}</div>
  <div class="card"><h2>Истекающие судейские категории</h2>${judges.length ? `<table class="tbl"><tbody>${judges.map(r => `<tr><td>${esc(r.judge_name)}</td><td>${esc(JCAT_SHORT[r.category] || r.category)}</td><td class="r">${fmtDate(r.valid_until)} ${pill(r.days_left + " дн.", r.days_left <= 30 ? "p-red" : "p-yel")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Нет</div>`}</div></div>
  <div class="card"><h2>Сборные региона</h2>${rosters.length ? `<table class="tbl"><thead><tr><th>Сезон</th><th>Дисциплина</th><th>Группа</th><th>Состав</th><th class="r"></th></tr></thead><tbody>${rosters.map(r => `<tr><td>${esc(r.season)}</td><td>${esc(r.discipline_name)}</td><td>${esc(r.age_group || "—")}</td><td>${r.members.map(x => esc(x.athlete_name) + (x.status === "reserve" ? " (р)" : "")).join(", ")}</td><td class="r"><button class="link" data-r="${r.id}">Проект приказа .docx</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">Сборные ещё не формировались</div>`}</div></div>`;
  const loadRating = async () => {
    const box = $("#rating"); box.innerHTML = loading();
    try { st.data = await api.rating({ discipline_id: st.d, season: st.s });
      box.innerHTML = st.data.athletes.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>#</th><th>Спортсмен</th><th>Организация</th><th>Разряд</th><th>Стартов</th><th>Топ-3</th><th class="r">Баллы</th></tr></thead><tbody>
      ${st.data.athletes.map((a, i) => `<tr><td>${i + 1}</td><td><b>${esc(a.athlete_name)}</b></td><td>${esc(a.organization_name || "—")}</td><td>${esc(RANK[a.rank] || a.rank || "—")}</td><td>${a.starts_count}</td><td>${a.top3_count}</td><td class="r"><b>${a.final_points}</b>${a.multiplier_applied ? " " + pill("×1.2", "p-lav") : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Нет данных за сезон</div>`;
    } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  st.d = discs[0]?.id; $("#d").onchange = e => { st.d = e.target.value; loadRating(); }; $("#s").onchange = e => { st.s = e.target.value; loadRating(); };
  $("#xlsx").onclick = async () => { try { saveBlob(await api.statisticsXlsx(), "statistics.xlsx"); } catch (e) { toast(e.message, true); } };
  $("#roster").onclick = () => {
    if (!st.data?.athletes.length) return toast("Нет данных рейтинга для формирования сборной", true);
    modal({ title: "Сформировать сборную", submitText: "Сформировать", body: `<p class="hint">Берутся лидеры рейтинга: ${esc(st.data.discipline_name)}, сезон ${esc(st.s)}.</p>` + field("Основной состав (чел.)", "main", { type: "number", value: 5, required: true }) + field("Резерв (чел.)", "reserve", { type: "number", value: 2, required: true }) + field("Возрастная группа", "age_group"),
      onSubmit: async (d) => { const a = st.data.athletes, mn = +d.main, rs = +d.reserve;
        await api.createRoster({ season: st.s, discipline_id: +st.d, age_group: d.age_group || null, members: a.slice(0, mn + rs).map((x, i) => ({ athlete_id: x.athlete_id, rating_score: x.final_points, status: i < mn ? "main" : "reserve" })) });
        toast("Сборная сформирована"); rerender(); } });
  };
  el.addEventListener("click", async e => { const b = e.target.closest("[data-r]"); if (!b) return; try { saveBlob(await api.rosterDocx(b.dataset.r), "roster-order.docx"); } catch (err) { toast(err.message, true); } });
  loadRating();
}

export async function settings({ el, rerender }) {
  el.innerHTML = loading();
  const [orgs, discs] = await Promise.all([api.organizations().catch(() => []), loadDisciplines()]);
  el.innerHTML = `<div class="stack"><div class="card"><div class="head"><h2>Организации и клубы</h2><button class="btn sm" id="add">+ Добавить организацию</button></div>
  ${orgs.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Название</th><th>Тип</th><th>Муниципалитет</th><th>Контакты</th><th>Участников</th></tr></thead><tbody>
  ${orgs.map(o => `<tr><td><b>${esc(o.name)}</b></td><td>${esc(ORG_TYPE[o.org_type] || o.org_type)}</td><td>${esc(o.municipality || "—")}</td><td>${esc([o.contact_email, o.contact_phone].filter(Boolean).join(", ") || "—")}</td><td>${o.members_count ?? 0}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Организаций нет</div>`}</div>
  <div class="card"><h2>Дисциплины вида спорта</h2>${discs.map(d => `<div class="box"><div><div class="t">${esc(d.name)}</div><div class="s">${esc(d.description || d.code)}</div></div></div>`).join("")}</div>
  <div class="card"><h2>Уведомления в Telegram</h2><div id="tg" class="hint">Загрузка…</div></div></div>`;
  $("#add").onclick = () => modal({ title: "Новая организация", submitText: "Добавить",
    body: field("Название", "name", { required: true }) + selectField("Тип", "org_type", Object.entries(ORG_TYPE), "school") + field("Муниципалитет", "municipality") + field("Адрес", "address") + field("E-mail", "contact_email", { type: "email" }) + field("Телефон", "contact_phone"),
    onSubmit: async (d) => { const b = {}; for (const k in d) b[k] = d[k] || null; b.name = d.name; b.org_type = d.org_type; await api.createOrganization(b); toast("Организация добавлена"); rerender(); } });
  telegramBlock($("#tg"));
}
