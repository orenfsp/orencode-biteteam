import { api, saveBlob } from "../api.js";
import { esc, fmtDate, rangeLong, dayRange, monRange, JCAT, JCAT_SHORT, posName, statusPill, pill, daysWord } from "../format.js";
import { loading, toast, $, modal, selectField } from "../ui.js";
import { sortByStart } from "./shared.js";

const LS = id => `fsp_jcat_apps_${id}`;
const localApps = id => { try { return JSON.parse(localStorage.getItem(LS(id))) || []; } catch { return []; } };
const saveLocal = (id, a) => { try { localStorage.setItem(LS(id), JSON.stringify(a.slice(0, 20))); } catch {} };

async function load(user) {
  const [judges, comps] = await Promise.all([api.judges().catch(() => []), api.competitions()]);
  const me = judges.find(j => j.judge_id === user.id) || null;
  const lists = await Promise.all(comps.filter(c => c.status !== "draft").map(c => api.judgeAssignments(c.id).then(l => l.map(a => ({ ...a, comp: c }))).catch(() => [])));
  const assigns = lists.flat().filter(a => a.judge_id === user.id).sort((a, b) => new Date(a.comp.start_date) - new Date(b.comp.start_date));
  let apps = [];
  try { apps = (await api.categoryApplications()).filter(a => a.judge_id === user.id); } catch { apps = localApps(user.id); }
  return { me, assigns, apps, comps };
}
const today = () => new Date(new Date().toDateString());
const assignCard = a => `<div class="box"><div style="display:flex;gap:14px;align-items:center;min-width:0"><div class="datebadge">${esc(dayRange(a.comp.start_date, a.comp.end_date))}<small>${esc(monRange(a.comp.start_date, a.comp.end_date))}</small></div>
  <div class="grow"><div class="t">${esc(a.comp.title)}</div><div class="s">${esc(rangeLong(a.comp.start_date, a.comp.end_date))}</div></div></div>
  ${a.position === "Главный судья" || /chief|главн/i.test(a.position) ? `<span class="pill p-dark">${esc(posName(a.position))}</span>` : `<span class="pill p-lav" style="padding:12px 18px;font-size:13px">${esc(posName(a.position))}</span>`}</div>`;
const appCard = a => `<div class="box"><div><div class="t">Заявка на ${a.application_type === "confirmation" ? "подтверждение" : "присвоение"} ${esc(JCAT_SHORT[a.requested_category] || a.requested_category)} категории</div>
  <div class="s">Подана: ${esc(fmtDate(a.submitted_at))}</div>${a.rejection_reason ? `<div class="s">${esc(a.rejection_reason)}</div>` : ""}</div>
  <div style="display:flex;gap:12px;align-items:center"><span class="hint">Статус</span>${statusPill(a.status)}</div></div>`;

function categoryCard(me) {
  if (!me || me.category === "Без категории") return `<div class="darkbox"><small>Текущая категория</small><b>Без категории</b></div>`;
  return `<div class="darkbox" style="padding:44px 24px"><small>Текущая категория</small><b style="font-size:26px;margin-top:20px">${esc(JCAT[me.category] || me.category)}</b></div>
    <div class="box" style="margin-top:18px"><span class="hint" style="font-weight:600">Действует до</span><b style="font-size:16px">${esc(fmtDate(me.valid_until))}</b></div>
    ${me.is_expiring_soon ? `<div style="margin-top:14px">${pill(`Истекает через ${me.days_left} ${daysWord(me.days_left)}`, "p-yel")}</div>` : ""}`;
}

export async function home({ el, user, rerender }) {
  el.innerHTML = loading();
  const { me, assigns, apps } = await load(user);
  const up = assigns.filter(a => new Date(a.comp.end_date) >= today());
  el.innerHTML = `<div class="stack"><div class="grid g-7-5" style="grid-template-columns:1fr 1.85fr">
    <div class="card"><h2>Моя категория</h2>${categoryCard(me)}</div>
    <div class="card"><h2>Ближайшие назначения</h2>${up.length ? up.slice(0, 3).map(assignCard).join("") : `<div class="empty">Назначений пока нет</div>`}</div></div>
    <div class="card"><div class="head"><h2>Мои заявки и статусы</h2><button class="btn sm" id="apply">Подать заявку</button></div>${apps.length ? apps.map(appCard).join("") : `<div class="empty">Заявок пока нет</div>`}</div></div>`;
  $("#apply").onclick = () => applyModal(user, me, rerender);
}

function applyModal(user, me, done) {
  modal({
    title: "Заявка на судейскую категорию", submitText: "Подать заявку",
    body: selectField("Тип заявки", "application_type", [["confirmation", "Подтверждение категории"], ["assignment", "Присвоение категории"]], me && me.category !== "Без категории" ? "confirmation" : "assignment") +
      selectField("Категория", "requested_category", Object.entries(JCAT_SHORT).map(([k, v]) => [k, v]), me?.category in JCAT_SHORT ? me.category : "third"),
    onSubmit: async (d) => {
      const a = await api.applyCategory({ requested_category: d.requested_category, application_type: d.application_type });
      saveLocal(user.id, [a, ...localApps(user.id)]); toast("Заявка подана"); done();
    },
  });
}

export async function category({ el, user, rerender }) {
  el.innerHTML = loading();
  const { me, apps } = await load(user);
  el.innerHTML = `<div class="grid g2"><div class="card"><h2>Моя категория</h2>${categoryCard(me)}<button class="btn" id="apply" style="margin-top:18px">Подать заявку</button></div>
    <div class="card"><h2>Заявки и статусы</h2>${apps.length ? apps.map(appCard).join("") : `<div class="empty">Заявок пока нет</div>`}</div></div>`;
  $("#apply").onclick = () => applyModal(user, me, rerender);
}

export async function assignments({ el, user }) {
  el.innerHTML = loading();
  const { assigns } = await load(user);
  const up = assigns.filter(a => new Date(a.comp.end_date) >= today()), past = assigns.filter(a => new Date(a.comp.end_date) < today()).reverse();
  el.innerHTML = `<div class="stack">
    <div class="card">
      <div class="head">
        <h2>Судейские назначения</h2>
        <button class="btn sm light" id="btn-judge-report">📄 Скачать отчёт о судействе (.docx)</button>
      </div>
    </div>
    <div class="card"><h2>Ближайшие назначения</h2>${up.length ? up.map(assignCard).join("") : `<div class="empty">Назначений нет</div>`}</div>
    <div class="card"><h2>Прошедшие (Мои соревнования)</h2>${past.length ? past.map(assignCard).join("") : `<div class="empty">Пока пусто</div>`}</div></div>`;

  const btnRep = $("#btn-judge-report", el);
  if (btnRep) {
    btnRep.onclick = async () => {
      btnRep.disabled = true;
      try {
        saveBlob(await api.judgeReportDocx(user.id), `judge-report-${user.full_name}.docx`);
        toast("Отчёт о судействе скачан");
      } catch (err) {
        toast(err.message, true);
      } finally {
        btnRep.disabled = false;
      }
    };
  }
}
