let audio,
  wakeLock,
  active = false;
export function primeAlerts() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!audio && Audio) audio = new Audio();
    if (audio?.state === "suspended") audio.resume().catch(() => {});
  } catch {
    /* Visual alerts always remain available. */
  }
}
export async function keepScreenAwake(enabled) {
  active = enabled;
  if (!enabled) {
    await wakeLock?.release().catch(() => {});
    wakeLock = null;
    return;
  }
  if (wakeLock && !wakeLock.released) return;
  if (!navigator.wakeLock || document.visibilityState !== "visible") return;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (!active) await lock.release();
    else wakeLock = lock;
  } catch {}
}
export function alertRest(title, body) {
  try {
    if (audio?.state === "running") {
      for (const offset of [0, 0.25]) {
        const oscillator = audio.createOscillator(),
          gain = audio.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(
          0.15,
          audio.currentTime + offset + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audio.currentTime + offset + 0.18,
        );
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(audio.currentTime + offset);
        oscillator.stop(audio.currentTime + offset + 0.2);
      }
    }
    navigator.vibrate?.([180, 100, 180]);
  } catch {}
  if (
    document.visibilityState === "hidden" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => {
        if (registration)
          return registration.showNotification(title, {
            body,
            tag: "gym-rest-complete",
          });
        // Some mobile browsers only support service-worker notifications.
        try {
          new Notification(title, { body, tag: "gym-rest-complete" });
        } catch {}
      })
      .catch(() => {});
  }
}
