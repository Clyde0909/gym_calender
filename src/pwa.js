// Capture the browser event early. prompt() must run directly from a user tap.
export function createInstaller(host = window, onChange = () => {}) {
  let pending = null,
    installed = false;
  let display;
  try {
    display = host.matchMedia?.("(display-mode: standalone)");
  } catch {}

  const isInstalled = () =>
    installed ||
    Boolean(display?.matches) ||
    host.navigator?.standalone === true;
  host.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pending = event;
    onChange();
  });
  host.addEventListener("appinstalled", () => {
    installed = true;
    pending = null;
    onChange();
  });
  // PWA detection is optional: older browsers may expose only addListener,
  // or throw when registering a display-mode listener.
  try {
    if (typeof display?.addEventListener === "function")
      display.addEventListener("change", onChange);
    else display?.addListener?.(onChange);
  } catch {}
  return {
    isInstalled,
    async install() {
      if (isInstalled()) return "installed";
      if (!pending) return "instructions";
      const event = pending;
      pending = null;
      try {
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome;
      } finally {
        onChange();
      }
    },
  };
}
