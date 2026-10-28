import { api } from "../api.js";
import { store, loadDisciplines } from "../store.js";
import { esc, fmtDate, dayRange, monRange, FORMAT, LEVEL, RANK, RANK_ORDER, rangeLong, pill, statusPill, compPill, shortName, daysWord } from "../format.js";
import { modal, toast, field, selectField, $, $$, loading, errorBox } from "../ui.js";

export const lc = s => (s || "").toLowerCase();
export const sortByStart = list => [...list].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
export const upcoming = list => sortByStart(list.filter(c => !["completed", "cancelled", "draft"].includes(c.status) && new Date(c.end_date) >= new Date(new Date().toDateString())));

export function deadlinePassed(c) { return c.registration_deadline && new Date(c.registration_deadline) < new Date(); }
export const canApply = c => c.status === "registration_open" && !deadlinePassed(c);

export function dateBadge(c) { return `<div class="datebadge">${esc(dayRange(c.start_date, c.end_date))}<small>${esc(monRange(c.start_date, c.end_date))}</small></div>`; }

export function deadlineText(c) {
  if (c.registration_deadline) return `Приём до ${new Date(c.registration_deadline).getDate()} ${monRange(c.registration_deadline)}`;
  return COMP_OPEN_TEXT[c.status] || "";
}
const COMP_OPEN_TEXT = { registration_open: "Приём заявок", registration_closed: "Приём закрыт" };

export const compSub = c => [c.discipline_name || c.discipline?.name, lc(FORMAT[c.format] || c.format)].filter(Boolean).join(" · ");

export function compMiniList(list, { action } = {}) {
  if (!list.length) return `<div class="empty">Ближайших соревнований нет</div>`;
  return list.map(c => `<div class="box"><div style="display:flex;gap:14px;align-items:center;min-width:0">${dateBadge(c)}
    <div class="grow"><div class="t">${esc(c.title)}</div><div class="s">${esc(action ? compSub(c) : (c.status === "registration_open" ? deadlineText(c) : compSub(c)))}</div></div></div>
    ${action ? action(c) : ""}</div>`).join("");
}

export async function openApplyModal(c, { athletes = null, onDone } = {}) {
  const body = (athletes
    ? selectField("Спортсмен", "athlete_id", athletes.map(a => [a.id, a.name]), "", { required: true })
    : "") + `<p>Подать заявку на «${esc(c.title)}» (${esc(rangeLong(c.start_date, c.end_date))})?</p>`;
  modal({
    title: "Заявка на участие", body, submitText: "Подать заявку",
    onSubmit: async (d) => {
      await api.submitApplication({ competition_id: c.id, athlete_id: d.athlete_id || null });
      toast("Заявка подана"); onDone && onDone();
    },
  });
}

export async function openRankApplyModal({ results, athleteId = null, athletes = null, onDone, preferred = "ms" }) {
  const comps = store._comps || (store._comps = await api.competitions());
  const cmap = Object.fromEntries(comps.map(c => [c.id, c]));
  const withPlace = results.filter(r => r.place && r.status === "normal");
  if (!withPlace.length) return toast("Нет результатов с призовым местом для подачи заявки", true);
  const resOpts = (list) => list.map(r => [r.id, `${r.competition_title || cmap[r.competition_id]?.title} — ${r.place} место`]);
  const body = (athletes ? selectField("Спортсмен", "athlete_id", athletes.map(a => [a.id, a.name]), "", { required: true }) : "") +
    selectField("Результат", "result_id", resOpts(withPlace), "", { required: true }) +
    selectField("Запрашиваемый разряд", "requested_rank", RANK_ORDER.map(k => [k, RANK[k]]), preferred) +
    `<div class="hint" id="evsk">Подсказка ЕВСК появится после выбора результата.</div>`;
  const m = modal({
    title: "Заявка на присвоение разряда", body, submitText: "Подать заявку",
    onSubmit: async (d) => {
      const r = withPlace.find(x => x.id === d.result_id);
      await api.applyRank({ athlete_id: d.athlete_id || athleteId || null, requested_rank: d.requested_rank, competition_id: r.competition_id, result_id: r.id });
      toast("Заявка на разряд подана"); onDone && onDone();
    },
  });
  const sel = $("[name=result_id]", m.el), hint = $("#evsk", m.el);
  const upd = async () => {
    const r = withPlace.find(x => x.id === sel.value); const c = r && cmap[r.competition_id]; if (!c) return;
    try { const e = await api.evskCheck({ competition_level: c.level, place: r.place }); hint.textContent = (e.eligible ? `По ЕВСК рекомендуется: ${RANK[e.recommended_rank] || e.recommended_rank}. ` : "По ЕВСК разряд не присваивается. ") + (e.reason || ""); } catch { hint.textContent = ""; }
  };
  sel.onchange = upd; upd();
}

export function bestRank(records) {
  const act = (records || []).filter(r => r.status === "active");
  act.sort((a, b) => RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank));
  return act[0] || null;
}

export function rankDaysText(r) {
  if (!r) return "";
  if (r.valid_until == null) return "Бессрочно";
  return `${r.days_left} ${daysWord(r.days_left)}`;
}

export async function loadAppsMap() {
  try { const a = await api.myApplications(); return a; } catch { return []; }
}
