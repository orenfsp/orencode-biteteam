import { api } from "../api.js";
import { store, loadDisciplines } from "../store.js";
import { esc, fmtDate, rangeLong, FORMAT, LEVEL, COMP_STATUS, compPill, statusPill, ROLE } from "../format.js";
import { loading, errorBox, selectField, $, $$, toast } from "../ui.js";
import { openApplyModal, canApply, sortByStart, loadAppsMap } from "./shared.js";

export async function calendarPage({ el, role, user }) {
  el.innerHTML = loading();
  const [discs, all, apps] = await Promise.all([loadDisciplines(), api.competitions(), loadAppsMap()]);
  let athletes = null;
  if (role === "coach") { try { athletes = (await api.myAthletes()).map(a => ({ id: a.athlete_id, name: a.athlete_name })); } catch { athletes = []; } }
  const f = { discipline_id: "", level: "", format: "", status: "" };

  const draw = () => {
    let list = sortByStart(all.filter(c => c.status !== "draft"));
    if (f.discipline_id) list = list.filter(c => String(c.discipline_id) === f.discipline_id);
    if (f.level) list = list.filter(c => c.level === f.level);
    if (f.format) list = list.filter(c => c.format === f.format);
    if (f.status) list = list.filter(c => c.status === f.status);
    const mine = new Map(apps.filter(a => a.athlete_id === user.id).map(a => [a.competition_id, a]));
    $("#rows").innerHTML = list.length ? list.map(c => {
      const my = mine.get(c.id);
      let act = "";
      if (role === "athlete") act = my ? statusPill(my.status) : canApply(c) ? `<button class="btn sm" data-apply="${c.id}">Подать заявку</button>` : "";
      else if (canApply(c)) act = `<button class="btn sm" data-apply="${c.id}">Подать заявку</button>`;
      return `<tr><td><b>${esc(c.title)}</b><div class="sub">${esc(c.location || "")}</div></td><td>${esc(rangeLong(c.start_date, c.end_date))}</td>
        <td>${esc(c.discipline_name || "")}</td><td>${esc(LEVEL[c.level] || c.level)}</td><td>${esc(FORMAT[c.format] || c.format)}</td>
        <td>${compPill(c.status)}${c.registration_deadline ? `<div class="sub">до ${fmtDate(c.registration_deadline)}</div>` : ""}</td><td class="r">${act}</td></tr>`;
    }).join("") : `<tr><td colspan="7" class="empty">Соревнований не найдено</td></tr>`;
  };

  el.innerHTML = `<div class="card"><div class="head"><h2>Календарь соревнований</h2><div class="filters">
    ${selectField("", "discipline_id", [["", "Все дисциплины"], ...discs.map(d => [d.id, d.name])])}
    ${selectField("", "level", [["", "Любой уровень"], ...Object.entries(LEVEL)])}
    ${selectField("", "format", [["", "Любой формат"], ...Object.entries(FORMAT)])}
    ${selectField("", "status", [["", "Любой статус"], ...Object.entries(COMP_STATUS).filter(([k]) => k !== "draft")])}</div></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Соревнование</th><th>Даты</th><th>Дисциплина</th><th>Уровень</th><th>Формат</th><th>Статус</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>`;
  $$(".filters select", el).forEach(s => { s.parentElement.style.margin = 0; s.onchange = () => { f[s.name] = s.value; draw(); }; });
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-apply]"); if (!b) return;
    const c = all.find(x => x.id === b.dataset.apply);
    openApplyModal(c, { athletes: role === "coach" ? athletes : null, onDone: async () => { apps.splice(0, apps.length, ...await loadAppsMap()); draw(); } });
  });
  draw();
}
