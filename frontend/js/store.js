import { api, session } from "./api.js";
export const store = { user: null, notifs: [], disciplines: null };

export async function loadUser(force = false) {
  if (!store.user || force) store.user = await api.me();
  return store.user;
}
export async function loadDisciplines() {
  if (!store.disciplines) store.disciplines = await api.disciplines();
  return store.disciplines;
}
export async function loadNotifs() {
  try { store.notifs = await api.notifications(); } catch { store.notifs = []; }
  return store.notifs;
}
export const reset = () => { store.user = null; store.notifs = []; store.disciplines = null; };
export const role = () => session.get()?.activeRole;
