(function () {
  var lang = (
    new URLSearchParams(location.search).get("lang") ||
    navigator.language ||
    "en"
  )
    .toLowerCase()
    .split(/[-_]/)[0];
  var messages = {
    en: [
      "Reload app files while keeping your saved workout records and photos. An internet connection is required.",
      "Reload app files",
      "Back to app",
      "Checking the connection…",
      "Recovery failed. Check your connection and retry.",
    ],
    ko: [
      "저장된 운동 기록과 사진을 유지하면서 앱 화면 파일을 다시 받습니다. 인터넷 연결이 필요합니다.",
      "앱 화면 파일 다시 받기",
      "앱으로 돌아가기",
      "인터넷 연결을 확인하고 있습니다…",
      "복구하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.",
    ],
    ja: [
      "保存済みの運動記録と写真を保持し、アプリの画面ファイルを再取得します。インターネット接続が必要です。",
      "画面ファイルを再取得",
      "アプリに戻る",
      "接続を確認しています…",
      "復旧できませんでした。接続を確認して再試行してください。",
    ],
  };
  var text = messages[lang] || messages.en;
  document.documentElement.lang = messages[lang] ? lang : "en";
  var message = document.getElementById("message"),
    button = document.getElementById("recover");
  message.textContent = text[0];
  button.textContent = text[1];
  document.getElementById("back").textContent = text[2];
  button.onclick = function () {
    button.disabled = true;
    message.textContent = text[3];
    var scope = new URL("./", location.href).href;
    // This recovery file was never precached by older workers: confirm an online
    // response before removing any app-shell cache. Do not touch user storage.
    fetch("./recover.js?online=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw Error("Network unavailable");
        if (!("caches" in window)) return;
        return caches.keys().then(function (names) {
          return Promise.all(
            names
              .filter(function (name) {
                return name.indexOf("gym-log-") === 0;
              })
              .map(function (name) {
                return caches.open(name).then(function (cache) {
                  return cache.keys().then(function (requests) {
                    return Promise.all(
                      requests
                        .filter(function (request) {
                          return request.url.indexOf(scope) === 0;
                        })
                        .map(function (request) {
                          return cache.delete(request);
                        }),
                    );
                  });
                });
              }),
          );
        });
      })
      .then(function () {
        if (!("serviceWorker" in navigator)) return;
        return navigator.serviceWorker
          .getRegistration(scope)
          .then(function (registration) {
            if (registration && registration.scope === scope)
              return registration.unregister();
          });
      })
      .then(function () {
        location.replace("./?lang=" + (messages[lang] ? lang : "en"));
      })
      .catch(function (error) {
        message.textContent = text[4];
        document.getElementById("error").textContent = error.message;
        button.disabled = false;
      });
  };
})();
