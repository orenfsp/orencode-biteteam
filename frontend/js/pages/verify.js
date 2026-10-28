import { api } from "../api.js";
import { esc } from "../format.js";

export async function verifyPage(app, number) {
  app.innerHTML = `<div class="vbox"><div class="spin">Проверка документа…</div></div>`;
  try {
    const v = await api.verify(number);
    app.innerHTML = `<div class="vbox"><img src="assets/logo.png" style="height:56px" alt="">
      <h1 style="margin-top:14px">${v.valid ? "Документ подлинный" : "Документ не найден"}</h1>
      <p class="hint">${esc(v.federation_name)}</p>
      <div class="kv"><small>Номер</small><b>${esc(v.number)}</b><small>Спортсмен</small><b>${esc(v.athlete_name)}</b>
      <small>Соревнование</small><b>${esc(v.competition_title)}</b><small>Дисциплина</small><b>${esc(v.discipline_name)}</b>
      <small>Даты</small><b>${esc(v.competition_date)}</b><small>Место</small><b>${esc(v.place ?? "—")}</b>
      <small>Статус</small><b>${esc(v.status)}</b><small>Выдан</small><b>${esc(v.issued_at)}</b></div></div>`;
  } catch (e) {
    app.innerHTML = `<div class="vbox"><h1>Документ не найден</h1><p class="hint">${esc(e.message)}</p></div>`;
  }
}
