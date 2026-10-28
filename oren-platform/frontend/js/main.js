import { api, session } from "./api.js";
import { store, loadUser, loadNotifs, reset } from "./store.js";
import { renderShell } from "./layout.js";
import { NAV } from "./nav.js";
import { errorBox, loading } from "./ui.js";
import { go, current } from "./router.js";
import { loginPage } from "./pages/login.js";
import { registerPage } from "./pages/register.js";
import { verifyPage } from "./pages/verify.js";
import { pages } from "./pages/index.js";

const app = document.getElementById("app");
let token = 0;

async function render() {
  const path = current();
  const my = ++token;
  const verify = path.match(/^\/verify\/(.+)$/);
  if (verify) return verifyPage(app, decodeURIComponent(verify[1]));

  const s = session.get();
  if (!s) {
    if (path === "/register") return registerPage(app);
    if (path !== "/login") return go("/login");
    return loginPage(app);
  }
  if (path === "/login" || path === "/register" || path === "/" || path === "") return go("/home");

  const role = s.activeRole;
  const [page, id] = path.replace(/^\//, "").split("/");
  const allowed = NAV[role] || [];
  const known = allowed.some(([k]) => k === page) || (role === "federation" && page === "competitions");
  if (!known) return go("/home");

  app.innerHTML = `<div class="shell"><div class="logo"></div><div class="top"></div><nav class="side"></nav><main class="main">${loading()}</main></div>`;
  try {
    const user = await loadUser();
    if (!store.notifs.length) await loadNotifs();
    if (my !== token) return;
    const main = renderShell(app, { role, page, user });
    const handler = pages[role]?.[page];
    if (!handler) return go("/home");
    await handler({ el: main, user, role, id, rerender: render });
  } catch (e) {
    if (my !== token) return;
    const m = document.getElementById("main");
    if (m) m.innerHTML = errorBox(e); else app.innerHTML = errorBox(e);
  }
}

window.addEventListener("hashchange", render);
render();
