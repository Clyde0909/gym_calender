const pages = new Set([
  "calendar",
  "routines",
  "programs",
  "guide",
  "stats",
  "transfer",
  "settings",
]);
export function pageFromHash(hash) {
  const page = String(hash || "").replace(/^#\/?/, "");
  return pages.has(page) ? page : "calendar";
}
// Hash routes work on Pages subpaths without a server-side SPA rewrite.
// Only menu pages enter history; dates, filters, sets and timers never do.
export function createPageRouter(host, onNavigate) {
  let current = pageFromHash(host.location.hash);
  function url(page) {
    const result = new URL(host.location.href);
    result.hash = "/" + page;
    return result;
  }
  host.history.replaceState(host.history.state, "", url(current));
  function restore() {
    const page = pageFromHash(host.location.hash);
    if (host.location.hash !== "#/" + page)
      host.history.replaceState(host.history.state, "", url(page));
    if (page === current) return;
    current = page;
    onNavigate(page);
  }
  host.addEventListener("popstate", restore);
  host.addEventListener("hashchange", restore);
  return {
    get current() {
      return current;
    },
    navigate(page) {
      const next = pages.has(page) ? page : "calendar";
      if (next !== current) {
        host.history.pushState(null, "", url(next));
        current = next;
      }
      return current;
    },
  };
}
