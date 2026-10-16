// Capture the browser event early. prompt() must run directly from a user tap.
export function createInstaller(host = window, onChange = () => {}) {
  let pending = null,
    installed = false;
  const display = host.matchMedia("(display-mode: standalone)");
  const isInstalled = () =>
    installed || display.matches || host.navigator.standalone === true;
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
  display.addEventListener?.("change", onChange);
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
