export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pad = n => String(n).padStart(2, "0");
const toDate = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
export const fmtDate = v => { const d = toDate(v); return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : "—"; };
export const fmtDateTime = v => { const d = toDate(v); return d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—"; };
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONF = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const monShort = v => { const d = toDate(v); return d ? MON[d.getMonth()] : ""; };
export const dayMonthLong = v => { const d = toDate(v); return d ? `${d.getDate()} ${MONF[d.getMonth()]}` : ""; };
export function dayRange(a, b) {
  const s = toDate(a), e = toDate(b || a); if (!s) return "";
  return s.getTime() === e?.getTime() || !e ? `${s.getDate()}` : (s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()}` : `${s.getDate()}–${e.getDate()}`);
}
export function monRange(a, b) { const e = toDate(b || a) || toDate(a); return monShort(e); }
export function rangeLong(a, b) {
  const s = toDate(a), e = toDate(b || a); if (!s) return "";
  if (!e || s.getTime() === e.getTime()) return `${dayMonthLong(s)} ${s.getFullYear()}`;
  return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ${MONF[e.getMonth()]} ${e.getFullYear()}` : `${dayMonthLong(s)} – ${dayMonthLong(e)} ${e.getFullYear()}`;
}
export const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";
export function shortName(name = "") {
  const p = name.trim().split(/\s+/); if (p.length < 2) return name;
  return `${p[0]} ${p.slice(1).map(w => w[0] + ".").join("")}`;
}
export function daysWord(n) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "дней"; if (b === 1) return "день"; if (b > 1 && b < 5) return "дня"; return "дней";
}
export const age = v => { const d = toDate(v); if (!d) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };

export const ROLE = { federation: "Администратор ФСП", athlete: "Спортсмен", coach: "Тренер", judge: "Судья" };
export const ROLE_SHORT = { federation: "Администратор", athlete: "Спортсмен", coach: "Тренер", judge: "Судья" };
export const RANK = { third_youth: "3 юношеский", second_youth: "2 юношеский", first_youth: "1 юношеский", third: "3 разряд", second: "2 разряд", first: "1 разряд", cms: "КМС", ms: "МС", msic: "МСМК" };
export const RANK_ORDER = ["third_youth", "second_youth", "first_youth", "third", "second", "first", "cms", "ms", "msic"];
export const JCAT = { third: "Судья 3-й категории", second: "Судья 2-й категории", first: "Судья 1-й категории", all_russian: "Судья всероссийской категории", international: "Судья международной категории" };
export const JCAT_SHORT = { third: "3-й категории", second: "2-й категории", first: "1-й категории", all_russian: "Всероссийской", international: "Международной" };
export const FORMAT = { onsite: "Очно", online: "Онлайн", mixed: "Смешанный" };
export const LEVEL = { championship_russia: "Чемпионат России", first_russia: "Первенство России", interregional: "Межрегиональный", regional: "Региональный" };
export const COMP_STATUS = { draft: "Черновик", registration_open: "Приём заявок", registration_closed: "Приём закрыт", in_progress: "Проходит", completed: "Завершено", cancelled: "Отменено" };
export const ORG_TYPE = { school: "Школа", university: "Университет", sport_school: "Спортивная школа", club: "Клуб", other: "Другое" };
export const POSITION = { chief: "Главный судья", chief_judge: "Главный судья", secretary: "Судья-секретарь", judge: "Судья", deputy: "Заместитель главного судьи" };
export const posName = p => POSITION[p] || p || "Судья";

export function pill(text, cls) { return `<span class="pill ${cls}">${esc(text)}</span>`; }
const ST = {
  submitted: ["Новая", "p-lav"], under_review: ["На рассмотрении", "p-yel"], approved: ["Одобрена", "p-grn"],
  rejected: ["Отклонена", "p-red"], withdrawn: ["Отозвана", "p-gry"],
};
export const statusPill = s => { const [t, c] = ST[s] || [s, "p-gry"]; return pill(t, c); };
export function resultPill(r) {
  if (r.status === "disqualified") return pill("Дисквалифицирован", "p-red");
  if (r.status === "dns") return pill("Не стартовал", "p-gry");
  if (r.status === "dnf") return pill("Не финишировал", "p-yel");
  return pill("Подтверждён", "p-grn");
}
export function compPill(s) {
  const c = { registration_open: "p-lav", draft: "p-gry", registration_closed: "p-yel", in_progress: "p-yel", completed: "p-grn", cancelled: "p-red" }[s] || "p-gry";
  return pill(COMP_STATUS[s] || s, c);
}
