const routes = [];
export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return "([^/]+)"; }) + "/?$");
  routes.push({ re, keys, handler });
}
export const go = (path) => { location.hash = "#" + path; };
export const current = () => (location.hash.slice(1) || "/");
export function match(path) {
  for (const r of routes) {
    const m = r.re.exec(path); if (!m) continue;
    const params = {}; r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
    return { handler: r.handler, params };
  }
  return null;
}
