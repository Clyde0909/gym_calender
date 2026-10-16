// Deliberately independent of the application module and modern PWA APIs.
// A failed module load must still leave a readable, recoverable screen.
(function () {
  var lang = "en";
  try {
    var requested = new URLSearchParams(location.search).get("lang");
    lang = (
      requested ||
      localStorage.getItem("gym-log-language") ||
      navigator.language ||
      "en"
    )
      .toLowerCase()
      .split(/[-_]/)[0];
  } catch (ignore) {}
  var messages = {
    en: [
      "Loading your workout journal…",
      "The app could not finish loading. Retry online to check for an update. Your saved workout data will be kept.",
      "Check for updates and retry",
      "Error details",
    ],
    ko: [
      "운동 기록을 불러오는 중입니다…",
      "앱을 불러오지 못했습니다. 온라인에서 최신 버전을 확인하고 다시 시도하세요. 저장된 운동 기록은 유지됩니다.",
      "최신 버전 확인 후 다시 시도",
      "오류 상세",
    ],
    ja: [
      "運動記録を読み込んでいます…",
      "アプリを読み込めませんでした。オンラインで最新版を確認して再試行してください。保存済みの運動記録は保持されます。",
      "最新版を確認して再試行",
      "エラー詳細",
    ],
  };
  var text = messages[lang] || messages.en;
  var status = document.getElementById("startup-status");
  var retry = document.getElementById("startup-retry");
  var recovery = document.getElementById("startup-recovery");
  recovery.textContent =
    { ko: "앱 화면 파일 복구", ja: "画面ファイルを復旧" }[lang] ||
    "Recover app files";
  recovery.href = "./recover.html?lang=" + (messages[lang] ? lang : "en");
  status.textContent = text[0];
  retry.textContent = text[2];
  document.getElementById("startup-details-label").textContent = text[3];
  function failed(reason) {
    if (!document.getElementById("startup-screen")) return;
    status.textContent = text[1];
    retry.hidden = false;
    recovery.hidden = false;
    document.getElementById("startup-details").hidden = false;
    document.getElementById("startup-error").textContent =
      String(reason || "Startup did not finish") + "\n" + navigator.userAgent;
  }
  window.addEventListener(
    "error",
    function (event) {
      failed(
        event.message ||
          (event.target && event.target.src
            ? "Could not load " + event.target.src
            : "Resource load failed"),
      );
    },
    true,
  );
  window.addEventListener("unhandledrejection", function (event) {
    failed((event.reason && event.reason.message) || "Startup promise failed");
  });
  setTimeout(function () {
    failed("Startup timeout");
  }, 15000);
  retry.onclick = function () {
    retry.disabled = true;
    var reloaded = false;
    function reload() {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    }
    if (!("serviceWorker" in navigator)) {
      reload();
      return;
    }
    navigator.serviceWorker.addEventListener("controllerchange", reload, {
      once: true,
    });
    setTimeout(reload, 5000);
    navigator.serviceWorker
      .getRegistration()
      .then(function (registration) {
        if (!registration) {
          reload();
          return;
        }
        return registration.update();
      })
      .catch(reload);
  };
  // Register independently: a broken cached app module cannot block updates.
  var module = document.querySelector('script[type="module"][src]');
  if (
    "serviceWorker" in navigator &&
    module &&
    module.src.indexOf("/assets/") !== -1
  ) {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .catch(function () {});
  }
})();
