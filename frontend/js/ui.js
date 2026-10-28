import { esc } from "./format.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function toast(msg, bad = false) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), 4200);
}

export const loading = () => `<div class="spin">Загрузка…</div>`;
export const errorBox = (e) => `<div class="card"><div class="err">${esc(e.message || e)}</div></div>`;

export function modal({ title, body, submitText = "Сохранить", onSubmit, wide = false, hideSubmit = false, cancelText = "Отмена" }) {
  const ov = document.createElement("div");
  ov.className = "ov";
  ov.innerHTML = `<form class="modal ${wide ? "wide" : ""}"><h2>${esc(title)}</h2><div class="err" hidden></div>${body}
    <div class="acts"><button type="button" class="btn ghost" data-x>${esc(cancelText)}</button>${hideSubmit ? "" : `<button class="btn" type="submit">${esc(submitText)}</button>`}</div></form>`;
  document.body.appendChild(ov);
  const form = $("form", ov), errEl = $(".err", ov);
  const close = () => ov.remove();
  $("[data-x]", ov).onclick = close;
  ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = $("button[type=submit]", form); btn.disabled = true; errEl.hidden = true;
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    $$("input[type=checkbox]", form).forEach(c => { data[c.name] = c.checked; });
    try { const r = await onSubmit(data, close); if (r !== false) close(); }
    catch (err) { errEl.textContent = err.message || String(err); errEl.hidden = false; btn.disabled = false; }
  });
  return { el: ov, close, form };
}

export function confirmBox(title, text, okText = "Да") {
  return new Promise(res => {
    modal({ title, body: `<p>${esc(text)}</p>`, submitText: okText, onSubmit: () => { res(true); } })
      .el.querySelector("[data-x]").addEventListener("click", () => res(false));
  });
}

export const field = (label, name, { type = "text", value = "", required = false, placeholder = "", attrs = "" } = {}) =>
  `<label class="f"><span>${esc(label)}</span><input class="i" type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? "required" : ""} ${attrs}></label>`;
export const selectField = (label, name, options, value = "", { required = false } = {}) =>
  `<label class="f"><span>${esc(label)}</span><select class="i" name="${name}" ${required ? "required" : ""}>${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;

export const icons = {
  home: `<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2.5.6 4 2.3 4 5"/>`,
  cal: `<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  trophy: `<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 21h8"/>`,
  doc: `<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>`,
  inbox: `<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5a4 4 0 0 0 8 0h5"/>`,
  award: `<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/>`,
  chart: `<path d="M4 20V4M4 20h16M9 20v-7M14 20V9M19 20v-4"/>`,
  sliders: `<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>`,
  bell: `<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>`,
};
export const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[n]}</svg>`;
