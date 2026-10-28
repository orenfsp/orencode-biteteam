import { api } from "../api.js";
import { esc, fmtDate, RANK, statusPill, pill, shortName } from "../format.js";
import { loading, toast, $, $$, modal, selectField } from "../ui.js";
import { upcoming, compMiniList, openApplyModal, openRankApplyModal, bestRank, canApply } from "./shared.js";

async function load() {
  const links = await api.myAthletes().catch(() => []);
  const ids = [...new Set(links.map(l => l.athlete_id))];
  const [ranksArr, comps, apps, rankApps, users] = await Promise.all([
    Promise.all(ids.map(id => api.athleteRanks(id).catch(() => []))), api.competitions(),
    api.myApplications().catch(() => []), api.rankApplications().catch(() => []),
    api.users({ role: "athlete" }).catch(() => []),
  ]);
  const ranks = Object.fromEntries(ids.map((id, i) => [id, ranksArr[i]]));
  const umap = Object.fromEntries(users.map(u => [u.id, u]));
  const mineIds = new Set(ids);
  const feed = [
    ...apps.map(a => ({ title: "Участие: " + a.competition_title, athlete: a.athlete_name, at: a.submitted_at, status: a.status })),
    ...rankApps.filter(a => mineIds.has(a.athlete_id)).map(a => ({ title: "Присвоение разряда " + (RANK[a.requested_rank] || a.requested_rank), athlete: a.athlete_name, at: a.submitted_at, status: a.status })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return { links, ids, ranks, comps, feed, umap };
}
const athleteRows = (links, ranks, umap) => links.map(l => {
  const r = bestRank(ranks[l.athlete_id]);
  return { id: l.athlete_id, name: l.athlete_name, disc: l.discipline_name, rank: r, org: umap[l.athlete_id]?.organization_name };
});

export async function home({ el, rerender }) {
  el.innerHTML = loading();
  const { links, ranks, comps, feed, umap } = await load();
  const rows = athleteRows(links, ranks, umap);
  const up = upcoming(comps);
  const expiring = rows.filter(r => r.rank?.is_expiring_soon).length;
  const pending = feed.filter(f => ["submitted", "under_review"].includes(f.status)).length;
  const athletes = rows.map(r => ({ id: r.id, name: r.name }));
  el.innerHTML = `<div class="stack">
  <div class="grid g4">
    <div class="stat"><small>Мои спортсмены</small><b>${rows.length}</b></div>
    <div class="stat"><small>Ближайших турниров</small><b>${up.length}</b></div>
    <div class="stat"><small>Разряды истекают</small><b>${expiring}</b></div>
    <div class="stat dark"><small>Заявки на рассмотрении</small><b>${pending}</b></div></div>
  <div class="grid g-7-5">
    <div class="card"><h2>Мои спортсмены</h2>${athleteTable(rows.slice(0, 5))}</div>
    <div class="card">${compMiniList(up.slice(0, 2))}<button class="btn block" id="team" style="margin-top:18px">Подать командную заявку</button></div></div>
  <div class="card"><h2>Заявки и статусы</h2>${feedTable(feed.slice(0, 6))}</div></div>`;
  $("#team").onclick = () => teamApply(up.filter(canApply), athletes, rerender);
}

function athleteTable(rows) {
  if (!rows.length) return `<div class="empty">Спортсменов пока нет</div>`;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>ФИО</th><th>Разряд</th><th>Дисциплина</th><th>Действует до</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.rank ? RANK[r.rank.rank] : "—")}</td><td>${esc(r.disc || "—")}</td><td>${r.rank ? (r.rank.valid_until ? fmtDate(r.rank.valid_until) : "Бессрочно") : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}
function feedTable(feed) {
  if (!feed.length) return `<div class="empty">Заявок пока нет</div>`;
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Заявка</th><th>Спортсмен</th><th>Подана</th><th>Статус</th></tr></thead><tbody>
  ${feed.map(f => `<tr><td>${esc(f.title)}</td><td>${esc(f.athlete || "—")}</td><td>${fmtDate(f.at)}</td><td>${statusPill(f.status)}</td></tr>`).join("")}</tbody></table></div>`;
}

function teamApply(comps, athletes, done) {
  if (!comps.length) return toast("Сейчас нет соревнований с открытым приёмом заявок", true);
  if (!athletes.length) return toast("У вас пока нет привязанных спортсменов", true);
  modal({
    title: "Командная заявка", submitText: "Подать заявки",
    body: selectField("Соревнование", "competition_id", comps.map(c => [c.id, c.title]), "", { required: true }) +
      `<div class="hint" style="margin-bottom:8px">Спортсмены</div>` + athletes.map(a => `<label class="chk"><input type="checkbox" name="a_${a.id}"> ${esc(a.name)}</label>`).join(""),
    onSubmit: async (d) => {
      const ids = athletes.filter(a => d["a_" + a.id]).map(a => a.id);
      if (!ids.length) throw new Error("Выберите хотя бы одного спортсмена");
      let ok = 0; const errs = [];
      for (const id of ids) { try { await api.submitApplication({ competition_id: d.competition_id, athlete_id: id }); ok++; } catch (e) { errs.push(e.message); } }
      if (errs.length) { toast(`Подано: ${ok}. Ошибки: ${errs.join("; ")}`, true); } else toast(`Подано заявок: ${ok}`);
      done();
    },
  });
}

export async function athletes({ el, rerender }) {
  el.innerHTML = loading();
  const { links, ranks, comps, umap } = await load();
  const rows = athleteRows(links, ranks, umap);
  el.innerHTML = `<div class="card"><div class="head"><h2>Мои спортсмены</h2><button class="btn sm" id="add">+ Привязать спортсмена</button></div>
    ${rows.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>ФИО</th><th>Организация</th><th>Разряд</th><th>Дисциплина</th><th>Действует до</th><th class="r"></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.org || "—")}</td><td>${esc(r.rank ? RANK[r.rank.rank] : "—")}</td><td>${esc(r.disc || "—")}</td>
      <td>${r.rank ? (r.rank.valid_until ? fmtDate(r.rank.valid_until) + (r.rank.is_expiring_soon ? " " + pill("истекает", "p-yel") : "") : "Бессрочно") : "—"}</td>
      <td class="r"><button class="link" data-rank="${r.id}">Заявка на разряд</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Спортсменов пока нет — привяжите первого</div>`}</div>`;
  $("#add").onclick = async () => {
    const [users, discs] = await Promise.all([api.users({ role: "athlete" }), api.disciplines()]);
    const linked = new Set(links.map(l => l.athlete_id));
    modal({ title: "Привязать спортсмена", submitText: "Привязать",
      body: selectField("Спортсмен", "athlete_id", users.filter(u => !linked.has(u.id)).map(u => [u.id, u.full_name]), "", { required: true }) + selectField("Дисциплина", "discipline_id", discs.map(d => [d.id, d.name]), "", { required: true }),
      onSubmit: async (d) => { await api.linkAthlete({ athlete_id: d.athlete_id, discipline_id: +d.discipline_id }); toast("Спортсмен привязан"); rerender(); } });
  };
  el.onclick = async (e) => {
    const b = e.target.closest("[data-rank]"); if (!b) return;
    const results = await api.athleteResults(b.dataset.rank);
    openRankApplyModal({ results, athleteId: b.dataset.rank, onDone: rerender });
  };
}

export async function applications({ el, rerender }) {
  el.innerHTML = loading();
  const { links, comps, feed } = await load();
  const athletes = links.map(l => ({ id: l.athlete_id, name: l.athlete_name }));
  el.innerHTML = `<div class="card"><div class="head"><h2>Заявки и статусы</h2><button class="btn sm" id="new">+ Новая заявка на участие</button></div>${feedTable(feed)}</div>`;
  $("#new").onclick = () => {
    const open = comps.filter(canApply);
    if (!open.length) return toast("Нет соревнований с открытым приёмом заявок", true);
    modal({ title: "Заявка на участие", submitText: "Подать", body: selectField("Соревнование", "cid", open.map(c => [c.id, c.title]), "", { required: true }) + selectField("Спортсмен", "aid", athletes.map(a => [a.id, a.name]), "", { required: true }),
      onSubmit: async (d) => { await api.submitApplication({ competition_id: d.cid, athlete_id: d.aid }); toast("Заявка подана"); rerender(); } });
  };
}
