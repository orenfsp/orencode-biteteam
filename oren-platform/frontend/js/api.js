const cfg = () => (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "/api/v1";
const KEY = "fsp_session";

export const session = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
  set(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function errText(body, status) {
  const d = body && body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(x => (x.loc ? x.loc.slice(1).join(".") + ": " : "") + x.msg).join("; ");
  return `Ошибка ${status}`;
}

async function raw(path, { method = "GET", body, query, auth = true, blob = false } = {}) {
  const url = new URL(cfg().replace(/\/$/, "") + path, location.href);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  const headers = {};
  const s = session.get();
  if (auth && s) { headers.Authorization = "Bearer " + s.token; if (s.activeRole) headers["X-Active-Role"] = s.activeRole; }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try { res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError(0, "Нет связи с сервером. Проверьте адрес API в config.js"); }
  if (res.status === 401 && auth && s) { session.clear(); location.hash = "#/login"; location.reload(); throw new ApiError(401, "Сессия истекла"); }
  if (!res.ok) { let b = null; try { b = await res.json(); } catch {} throw new ApiError(res.status, errText(b, res.status)); }
  if (blob) return res.blob();
  if (res.status === 204) return null;
  return res.json();
}

const get = (p, query) => raw(p, { query });
const post = (p, body) => raw(p, { method: "POST", body });
const patch = (p, body) => raw(p, { method: "PATCH", body });
const put = (p, body) => raw(p, { method: "PUT", body });

export const api = {
  login: (email, password) => raw("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (data) => raw("/auth/register", { method: "POST", body: data, auth: false }),
  me: () => get("/auth/me"),
  updateMe: (d) => put("/auth/me", d),
  switchRole: (role) => post("/auth/switch-role", { role }),

  disciplines: () => get("/disciplines"),
  organizations: (q) => get("/organizations", q),
  createOrganization: (d) => post("/organizations", d),
  users: (q) => get("/users", q),
  user: (id) => get("/users/" + id),
  setDisqualification: (id, d) => post(`/users/${id}/disqualification`, d),
  myAthletes: () => get("/users/coach/my-athletes"),
  linkAthlete: (d) => post("/users/coach/link-athlete", d),

  competitions: (q) => get("/competitions", q),
  competition: (id) => get("/competitions/" + id),
  createCompetition: (d) => post("/competitions", d),
  updateCompetition: (id, d) => put("/competitions/" + id, d),
  competitionTypes: () => get("/competitions/meta/types"),

  submitApplication: (d) => post("/applications", d),
  myApplications: () => get("/applications/my"),
  competitionApplications: (id, status) => get("/applications/competition/" + id, { status }),
  moderateApplication: (id, d) => patch(`/applications/${id}/status`, d),

  results: (compId, items) => post(`/competitions/${compId}/results`, { items }),
  protocol: (compId) => get(`/competitions/${compId}/protocol`),
  athleteResults: (id) => get("/results/athlete/" + id),

  athleteRanks: (id) => get("/ranks/athlete/" + id),
  expiringRanks: (days = 30) => get("/ranks/expiring", { days }),
  evskCheck: (q) => get("/ranks/evsk-check", q),
  applyRank: (d) => post("/ranks/apply", d),
  rankApplications: (status) => get("/ranks/applications", { status }),
  reviewRankApplication: (id, d) => patch("/ranks/applications/" + id, d),

  judges: () => get("/judges"),
  expiringJudges: (days = 30) => get("/judges/expiring", { days }),
  assignJudge: (d) => post("/judges/assign", d),
  judgeAssignments: (compId) => get("/judges/competitions/" + compId),
  applyCategory: (d) => post("/judges/category-apply", d),
  categoryApplications: (status) => get("/judges/category-applications", { status }),
  reviewCategoryApplication: (id, d) => patch("/judges/category-applications/" + id, d),

  rating: (q) => get("/rating", q),
  rosters: () => get("/rating/rosters"),
  createRoster: (d) => post("/rating/roster", d),

  notifications: () => get("/notifications"),
  readNotification: (id) => patch(`/notifications/${id}/read`),
  telegramLinkCode: () => post("/notifications/telegram/link-code"),

  createCertificate: (resultId) => post("/documents/certificate/" + resultId),
  certificatePdf: (id) => raw(`/documents/certificate/${id}/pdf`, { blob: true }),
  protocolDocx: (id) => raw(`/documents/protocol/${id}/docx`, { blob: true }),
  protocolPdf: (id) => raw(`/documents/protocol/${id}/pdf`, { blob: true }),
  rosterDocx: (id) => raw(`/documents/roster/${id}/docx`, { blob: true }),
  statisticsXlsx: () => raw("/documents/statistics/xlsx", { blob: true }),

  verify: (num) => raw("/verify/" + encodeURIComponent(num), { auth: false }),
};

export function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
