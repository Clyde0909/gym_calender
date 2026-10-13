import { nextPending, remainingRest, focusProgress } from "./focus.js";
import { primeAlerts, alertRest, keepScreenAwake } from "./alerts.js";
import { createSessionShareCache, shareData } from "./sharing.js";
import {
  t as tr,
  language,
  locale,
  setLanguage,
  weekdays,
  monthLabel,
  dateLabel,
} from "./i18n.js";
import "./style.css";
import {
  exercises,
  newState,
  validateState,
  volume,
  completed,
  mergeSessions,
} from "./data.js";
import { load, save, photoData } from "./storage.js";
import { encode, decode } from "./codec.js";
import {
  library,
  searchExercises,
  estimate1RM,
  defaultSettings,
  exerciseLabel,
  canonicalExercise,
} from "./library.js";
const app = document.querySelector("#app");
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = dateKey(new Date());
let selected = today,
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  tab = "calendar",
  state,
  newExercise = "",
  timer = null,
  remaining = 0,
  imported = null,
  guideQuery = "",
  guideBody = "",
  guideEquipment = "",
  editing = null,
  deadline = 0;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const unit = () => state.settings?.unit || "kg";
const displayWeight = (n) =>
  Math.round(n * (unit() === "lbs" ? 2.2046226218 : 1) * 10) / 10;
const toKg = (n) => (unit() === "lbs" ? n / 2.2046226218 : n);
const fmt = (n) => new Intl.NumberFormat(locale()).format(n);
const session = () => state.sessions.find((s) => s.date === selected);
function ensure(date = selected) {
  let s = state.sessions.find((s) => s.date === date);
  if (!s) {
    s = { date, note: "", exercises: [], photo: null };
    state.sessions.push(s);
  }
  return s;
}
function toast(message) {
  const t = document.querySelector("#toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => t.classList.remove("show"), 4000);
}
let queue = Promise.resolve();
function mutate(fn, rerender = true) {
  const operation = queue.then(async () => {
    const previous = structuredClone(state);
    try {
      fn();
      await save(state);
      if (rerender) render();
    } catch (e) {
      state = previous;
      render();
      throw Error(tr("저장하지 못했습니다: ") + e.message);
    }
  });
  queue = operation.catch(() => {});
  return operation;
}

function shell(content) {
  return `<aside class="sidebar"><a class="brand" href="#">GYM<span>LOG</span><i>●</i></a><p class="brand-sub">${tr("나의 꾸준함이 쌓이는 곳")}</p><nav>${[
    ["calendar", "▦", tr("운동 캘린더")],
    ["routines", "☷", tr("나의 루틴")],
    ["guide", "◇", tr("운동 가이드")],
    ["stats", "↗", tr("기록 분석")],
    ["transfer", "⇄", tr("백업 & 공유")],
    ["settings", "⚙", tr("개인 설정")],
  ]
    .map(
      ([id, icon, label]) =>
        `<button data-tab="${id}" class="nav ${tab === id ? "active" : ""}"><span>${icon}</span>${label}</button>`,
    )
    .join(
      "",
    )}</nav><div class="local-card"><span class="status-dot"></span> ${tr("내 기기에 안전하게 저장")}<p>${tr("계정 없이, 나만의 운동 기록.")}<br>${tr("주기적으로 백업을 내보내세요.")}</p></div><div class="sidebar-foot">${tr("SHOW UP. GET STRONGER.")}</div></aside><main><header><div class="eyebrow">${tr("YOUR PERSONAL TRAINING JOURNAL")}</div><div class="topline"><h1>${{ calendar: tr("운동 캘린더"), routines: tr("나의 루틴"), guide: tr("운동 가이드"), settings: tr("개인 설정"), stats: tr("기록 분석"), transfer: tr("백업 & 공유") }[tab]}</h1><select id="language-select" class="language-select" aria-label="${tr("Language")}">${[
    ["en", "English"],
    ["ko", "한국어"],
    ["ja", "日本語"],
  ]
    .map(
      ([code, label]) =>
        `<option value="${code}" ${language() === code ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select><span class="today-pill">${today.replaceAll("-", ".")} <b>${tr("오늘")}</b></span></div></header>${content}<footer>${tr("GYM LOG · 당신의 기록은 이 브라우저에만 저장됩니다.")}</footer></main><div class="timer" ${remaining ? "" : "hidden"}><span id="timer-value">${remaining}${tr("초 휴식")}</span><button data-action="stop-timer" aria-label="${tr("타이머 종료")}">×</button></div>`;
}
function render() {
  document.body.classList.toggle("focus-active", !!focusState);
  document.documentElement.lang = language();
  document.title = `GYM LOG · ${tr("운동 기록")}`;
  document.querySelector('meta[name="description"]').content =
    tr("metaDescription");
  app.innerHTML = shell(
    tab === "calendar"
      ? calendar()
      : tab === "routines"
        ? routines()
        : tab === "guide"
          ? guide()
          : tab === "settings"
            ? settings()
            : tab === "stats"
              ? stats()
              : transfer(),
  );
  if (focusState) {
    app.insertAdjacentHTML("beforeend", focusView());
    app.querySelectorAll("aside,main").forEach((el) => (el.inert = true));
  }
  sessionShares.prepare(session()).catch(() => {});
}
function calendar() {
  const active = state.sessions.filter((s) => completed(s) > 0),
    s = session();
  const year = month.getFullYear(),
    m = month.getMonth(),
    days = new Date(year, m + 1, 0).getDate(),
    offset = new Date(year, m, 1).getDay();
  return `<div class="summary"><div><span>${tr("누적 운동")}</span><strong>${active.length}<small>${tr("일")}</small></strong></div><div><span>${tr("이번 달 운동")}</span><strong>${active.filter((s) => s.date.startsWith(`${year}-${String(m + 1).padStart(2, "0")}`)).length}<small>${tr("일")}</small></strong></div><div><span>${tr("누적 볼륨")}</span><strong>${fmt(displayWeight(active.reduce((n, s) => n + volume(s), 0)))}<small>${unit()}</small></strong></div><div class="summary-quote">${tr("ONE MORE REP.")}<br><span>${tr("어제보다 강한 오늘.")}</span></div></div><div class="workspace"><section class="panel calendar-panel"><div class="panel-title"><h2>${monthLabel(month)}</h2><div class="row"><button class="icon" data-action="prev-month" aria-label="${tr("이전 달")}">‹</button><button class="text-button" data-action="today">${tr("오늘")}</button><button class="icon" data-action="next-month" aria-label="${tr("다음 달")}">›</button></div></div><div class="weekdays">${weekdays()
    .map((d) => `<span>${d}</span>`)
    .join(
      "",
    )}</div><div class="days">${"<span></span>".repeat(offset)}${Array.from(
    { length: days },
    (_, i) => {
      const d = `${year}-${String(m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
        entry = state.sessions.find((s) => s.date === d);
      const weekday = new Date(d + "T12:00:00").getDay();
      const planned = state.routines.some(
        (r) => r.id === state.settings.schedule[weekday],
      );
      const rest =
        Object.hasOwn(state.settings.schedule, weekday) &&
        !state.settings.schedule[weekday];
      return `<button data-date="${d}" class="day ${d === selected ? "selected" : ""} ${d === today ? "is-today" : ""}"><span>${i + 1}</span>${entry && completed(entry) ? `<i class="workout-dot" title="${tr("운동 완료")}"></i>` : entry ? `<i class="pending-dot" title="${tr("미완료 기록")}"></i>` : planned ? `<i class="planned-dot" title="${tr("예정된 운동")}"></i>` : rest ? `<em class="rest-label">${tr("휴식")}</em>` : ""}${entry?.photo ? "<small>▧</small>" : ""}</button>`;
    },
  ).join(
    "",
  )}</div><div class="legend"><i class="workout-dot"></i> ${tr("완료")} <i class="pending-dot"></i> ${tr("기록")} <i class="planned-dot"></i> ${tr("예정")} <span>${tr("▧ 사진")}</span></div><div class="motivation"><span>${tr("CONSISTENCY IS EVERYTHING")}</span><h3>${tr("작은 기록이 만드는")}<br>${tr("큰 변화.")}</h3><p>${tr("오늘의 한 세트부터 시작해 보세요.")}</p><div class="barbell">━━▰━▰━━</div></div></section><section class="panel session-panel"><div class="panel-title"><div><div class="eyebrow">${tr("DAILY WORKOUT")}</div><h2>${dateLabel(selected)}</h2></div><button class="text-button" data-action="share-day">${tr("공유 ↗")}</button></div><div class="session-stats"><span><b>${s?.exercises.length || 0}</b> ${tr("운동")}</span><span><b>${s ? completed(s) : 0}</b> ${tr("완료 세트")}</span><span><b>${fmt(displayWeight(s ? volume(s) : 0))}</b> ${unit()}</span><button class="text-button" data-action="timer">◷ ${state.settings.restSeconds}${tr("초 휴식")}</button></div>${sessionControls(s)}<div class="exercise-list">${s?.exercises.map((e, i) => exerciseCard(e, i)).join("") || `<div class="empty"><div class="empty-icon">＋</div><h3>${tr("오늘의 운동을 기록하세요")}</h3><p>${tr("운동을 추가하거나 저장한 루틴으로 시작하세요.")}</p></div>`}</div><div class="add-box"><label for="exercise-name">${tr("운동 추가")}</label><div class="row"><input id="exercise-name" list="exercise-options" placeholder="${tr("운동 검색 또는 직접 입력")}" maxlength="100" value="${esc(newExercise)}"><datalist id="exercise-options">${exercises.map((e) => `<option value="${esc(exerciseLabel(e))}">`).join("")}</datalist><button class="primary" data-action="add-exercise">${tr("＋ 추가")}</button></div><div class="row"><select id="routine-select" aria-label="${tr("루틴 선택")}"><option value="">${tr("저장한 루틴 선택")}</option>${state.routines.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}</select><button class="secondary" data-action="apply-routine">${tr("불러오기")}</button></div></div><label class="field-label" for="note">${tr("오늘의 메모")}</label><textarea id="note" maxlength="10000" placeholder="${tr("컨디션, 운동 느낌, 다음 목표를 남겨보세요.")}">${esc(s?.note || "")}</textarea><div class="photo-head"><label class="field-label">${tr("운동 사진")} <small>${tr("하루 1장")}</small></label><label class="text-button upload">${s?.photo ? tr("사진 교체") : tr("＋ 사진 추가")}<input id="photo" type="file" accept="image/*,.heic,.heif" hidden></label></div>${s?.photo ? `<div class="photo-wrap"><img src="${s.photo}" alt="${selected} ${tr("운동 사진")}"><button class="photo-delete" data-action="remove-photo">${tr("사진 삭제")}</button></div>` : `<p class="hint">${tr("사진은 자동으로 크기 조정·압축되어 기기에 저장됩니다.")}</p>`}<div class="session-bottom"><button class="secondary" data-action="save-routine">${tr("현재 운동을 루틴으로 저장")}</button><button class="danger-text" data-action="delete-day">${tr("기록 삭제")}</button></div></section></div>`;
}
function exerciseCard(e, i) {
  return `<article class="exercise-card"><div class="exercise-head"><h3><span>${String(i + 1).padStart(2, "0")}</span>${esc(exerciseLabel(e.name))}</h3><button class="icon" data-action="remove-exercise" data-i="${i}" aria-label="${esc(exerciseLabel(e.name))} ${tr("삭제")}">×</button></div><div class="set-head"><span>SET</span><span>${tr("무게 (")}${unit()})</span><span>${tr("횟수")}</span><span>${tr("완료")}</span><span></span></div>${e.sets.map((s, j) => `<div class="set-row ${s.done ? "done" : ""}"><span>${j + 1}</span><input aria-label="${esc(exerciseLabel(e.name))} ${j + 1}${tr("세트 무게")}" type="number" min="0" max="10000" step="0.5" value="${displayWeight(s.weight)}" data-i="${i}" data-j="${j}" data-field="weight"><input aria-label="${esc(exerciseLabel(e.name))} ${j + 1}${tr("세트 횟수")}" type="number" min="0" max="100000" step="1" value="${s.reps}" data-i="${i}" data-j="${j}" data-field="reps"><button class="check ${s.done ? "checked" : ""}" data-action="toggle-set" data-i="${i}" data-j="${j}" aria-label="${j + 1}${tr("세트 완료")}" aria-pressed="${s.done}">✓</button><button class="remove-set" data-action="remove-set" data-i="${i}" data-j="${j}" aria-label="${j + 1}${tr("세트 삭제")}">×</button></div>`).join("")}<div class="exercise-tools"><button class="text-button" data-action="previous" data-i="${i}">${tr("↶ 이전 기록")}</button><button class="text-button" data-action="recommend" data-i="${i}">${tr("중량 추천")}</button><button class="text-button" data-action="template" data-i="${i}">5 × 5</button><button class="text-button" data-action="move-up" data-i="${i}">${tr("↑ 순서")}</button></div><button class="add-set" data-action="add-set" data-i="${i}">${tr("＋ 세트 추가")}</button></article>`;
}
function routines() {
  if (editing) return routineEditor();
  return `<div class="routine-toolbar"><button class="primary" data-action="new-routine">${tr("＋ 새 루틴")}</button></div>${scheduleView()}<div class="intro"><h2>${tr("매번 고르지 않아도 되니까.")}</h2><p>${tr("캘린더에서 운동을 구성하고 루틴으로 저장하세요. 세트와 무게를 그대로 불러올 수 있어요.")}</p></div><div class="routine-grid">${state.routines.map((r) => `<article class="panel routine-card"><div class="eyebrow">${tr("MY TRAINING ROUTINE")}</div><h2>${esc(r.name)}</h2><p>${r.exercises.map((e) => esc(exerciseLabel(e.name))).join(" · ")}</p><div class="row"><button class="primary" data-action="use-routine" data-id="${esc(r.id)}">${tr("오늘 운동에 추가 ↗")}</button><button class="text-button" data-action="edit-routine" data-id="${esc(r.id)}">${tr("편집")}</button><button class="text-button" data-action="clone-routine" data-id="${esc(r.id)}">${tr("복제")}</button><button class="danger-text" data-action="delete-routine" data-id="${esc(r.id)}">${tr("삭제")}</button></div></article>`).join("") || `<div class="panel empty"><h3>${tr("아직 저장한 루틴이 없습니다")}</h3><p>${tr("운동 캘린더에서 첫 루틴을 만들어 보세요.")}</p><button class="primary" data-tab="calendar">${tr("운동 기록하기")}</button></div>`}</div>`;
}
function stats() {
  const sessions = state.sessions
    .filter((s) => completed(s) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  const recent = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * (7 - i));
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      value: sessions
        .filter((s) => s.date >= dateKey(start) && s.date < dateKey(end))
        .reduce((n, s) => n + volume(s), 0),
    };
  });
  const max = Math.max(1, ...recent.map((s) => s.value));
  return `<div class="summary"><div><span>${tr("총 운동일")}</span><strong>${sessions.length}<small>${tr("일")}</small></strong></div><div><span>${tr("완료한 세트")}</span><strong>${sessions.reduce((n, s) => n + completed(s), 0)}<small>${tr("세트")}</small></strong></div><div><span>${tr("총 볼륨")}</span><strong>${fmt(displayWeight(sessions.reduce((n, s) => n + volume(s), 0)))}<small>${unit()}</small></strong></div></div><section class="panel"><h2>${tr("주간 운동 볼륨")}</h2><p class="hint">${tr("완료한 세트의 무게 × 횟수 합계 · 최근 8주")}</p><div class="chart">${recent.map((s) => `<div class="chart-column"><span>${fmt(displayWeight(s.value))}</span><div style="height:${Math.max(2, (s.value / max) * 160)}px"></div><small>${s.label}</small></div>`).join("")}</div></section>${strengthStats()}<section class="panel history"><h2>${tr("운동 히스토리")}</h2>${sessions.map((s) => `<button data-history="${s.date}"><span>${s.date}<small>${s.exercises.map((e) => esc(exerciseLabel(e.name))).join(" · ")}</small></span><b>${fmt(displayWeight(volume(s)))} ${unit()} <span>↗</span></b></button>`).join("") || `<p class="hint">${tr("세트 완료 버튼을 누르면 분석에 반영됩니다.")}</p>`}</section>`;
}
function transfer() {
  return `<div class="intro"><h2>${tr("기록은 내 손에. 공유도 내 방식으로.")}</h2><p>${tr("기기 안의 기록을 압축 문자열로 내보내세요. 비밀번호를 설정하면 사진과 운동 기록을 함께 암호화합니다.")}</p></div><div class="transfer-grid"><section class="panel"><h2>${tr("내보내기")}</h2><label class="field-label" for="export-kind">${tr("공유 범위")}</label><select id="export-kind"><option value="session">${tr("선택한 날짜 (")}${selected}${tr(") 운동")}</option><option value="backup">${tr("전체 백업 (운동 + 사진 + 루틴)")}</option></select><label class="field-label" for="export-password">${tr("해독 비밀번호")} <small>${tr("선택 사항")}</small></label><input type="password" id="export-password" autocomplete="new-password" placeholder="${tr("비워두면 암호화 없이 공유")}"><p class="hint">${tr("비밀번호는 별도로 전달하세요. 잊어버리면 복구할 수 없습니다.")}</p><button class="primary full" data-action="export">${tr("압축 문자열 만들기 ↗")}</button><label class="field-label" for="export-output">${tr("공유 문자열")}</label><textarea id="export-output" readonly placeholder="${tr("생성한 문자열이 여기에 표시됩니다.")}"></textarea><p id="export-size" class="hint"></p><div class="row"><button class="secondary" data-action="copy">${tr("문자열 복사")}</button><button class="secondary" data-action="download">${tr("파일 다운로드")}</button><button class="secondary" data-action="native-share">${tr("기기 공유")}</button></div></section><section class="panel"><h2>${tr("가져오기")}</h2><label class="field-label" for="import-input">${tr("공유·백업 문자열")}</label><textarea id="import-input" placeholder="${tr("GW1.로 시작하는 문자열을 붙여넣으세요.")}"></textarea><label class="upload secondary file-label">${tr("또는 백업 파일 선택")}<input type="file" id="import-file" accept=".gymlog,.txt,text/plain" hidden></label><label class="field-label" for="import-password">${tr("해독 비밀번호")}</label><input type="password" id="import-password" autocomplete="current-password" placeholder="${tr("암호화된 공유의 비밀번호")}"><button class="primary full" data-action="inspect-import">${tr("내용 확인")}</button><div id="import-preview"></div></section></div><div class="notice"><b>${tr("기기 저장 안내")}</b><p>${tr("서버로 기록이나 사진을 전송하지 않습니다. 브라우저 데이터 삭제, 시크릿 모드 종료 또는 기기 분실 시 기록이 사라질 수 있으니 백업 파일을 보관하세요. 사진은 긴 문자열을 만들 수 있어 파일 공유를 권장합니다. 가져올 때 같은 날짜의 기록은 교체되며, 적용 전에 확인할 수 있습니다.")}</p><button class="text-button" data-action="persist">${tr("기록 보관 권한 요청")}</button></div>`;
}
function routineApply(id) {
  const r = state.routines.find((r) => r.id === id);
  if (r)
    ensure().exercises.push(
      ...structuredClone(r.exercises).map((e) => ({
        ...e,
        sets: e.sets.map((s) => ({ ...s, done: false })),
      })),
    );
}
app.addEventListener("input", (e) => {
  if (e.target.id === "exercise-name") newExercise = e.target.value;
  if (e.target.id === "guide-search") {
    guideQuery = e.target.value;
    renderGuideResults();
  }
  if (["import-input", "import-password"].includes(e.target.id)) {
    imported = null;
    document.querySelector("#import-preview").textContent = "";
  }
});
app.addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.id === "language-select") {
      setLanguage(t.value);
      render();
      return;
    }
    if (t.dataset.field) {
      const value = Number(t.value);
      if (!Number.isFinite(value) || value < 0 || value > Number(t.max)) {
        toast(tr("입력 범위를 확인하세요."));
        render();
        return;
      }
      await mutate(
        () =>
          (session().exercises[+t.dataset.i].sets[+t.dataset.j][
            t.dataset.field
          ] = t.dataset.field === "weight" ? toKg(value) : value),
      );
    }
    if (t.id === "note") await mutate(() => (ensure().note = t.value), false);
    if (["photo", "focus-photo"].includes(t.id) && t.files[0]) {
      toast(tr("사진을 압축하고 있습니다."));
      const photoDate = t.id === "focus-photo" ? focusState.date : selected;
      const photo = await photoData(t.files[0]);
      await mutate(() => (ensure(photoDate).photo = photo));
      toast(
        tr(t.id === "focus-photo" ? "focusPhotoSaved" : "사진을 저장했습니다."),
      );
    }
    if (t.dataset.setting) {
      await mutate(() => {
        state.settings[t.dataset.setting] =
          t.type === "checkbox"
            ? t.checked
            : t.type === "number"
              ? Number(t.value)
              : t.value;
      });
    }
    if (t.dataset.schedule !== undefined)
      await mutate(
        () => (state.settings.schedule[t.dataset.schedule] = t.value),
      );
    if (t.id === "guide-body" || t.id === "guide-equipment") {
      guideBody = document.querySelector("#guide-body").value;
      guideEquipment = document.querySelector("#guide-equipment").value;
      renderGuideResults();
    }
    if (t.dataset.editField) {
      const item = editing.exercises[+t.dataset.i];
      if (t.dataset.editField === "name")
        item.name = canonicalExercise(t.value);
      else
        item.sets[+t.dataset.j][t.dataset.editField] =
          t.dataset.editField === "weight"
            ? toKg(Number(t.value))
            : Number(t.value);
    }
    if (t.id === "edit-name") editing.name = t.value;
    if (t.id === "import-file" && t.files[0]) {
      if (t.files[0].size > 40 * 1024 * 1024)
        throw Error(tr("파일이 너무 큽니다."));
      document.querySelector("#import-input").value = await t.files[0].text();
    }
  } catch (err) {
    toast(err.message);
  }
});
app.addEventListener("click", async (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  const direct = b.dataset.action;
  if (direct === "native-share") {
    try {
      sharePrepared({ text: output(), date: selected });
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (direct === "share-day" && mobileUI()) {
    shareDay();
    return;
  }
  if (direct === "focus-photo-picker") {
    app.querySelector("#focus-photo")?.click();
    return;
  }
  if (direct === "focus-notify") {
    primeAlerts();
    requestFocusNotifications();
    return;
  }
  if (direct === "focus-tap") {
    primeAlerts();
    await advanceFocus();
    return;
  }
  if (["focus-exit", "focus-dismiss"].includes(direct)) {
    if (!focusBusy) leaveFocus();
    return;
  }
  if (direct === "focus-skip-rest" && focusState?.phase === "rest") {
    focusState.phase = "ready";
    saveFocus();
    render();
    return;
  }
  if (["start-session", "focus-resume", "timer", "toggle-set"].includes(direct))
    primeAlerts();
  if (
    ["start-session", "focus-resume"].includes(direct) &&
    mobileUI() &&
    nextPending(session()) &&
    (!session()?.endedAt || direct === "focus-resume") &&
    document.documentElement.requestFullscreen
  ) {
    focusFullscreen = true;
    document.documentElement.requestFullscreen().catch(() => {});
  }
  await queue;
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    render();
    return;
  }
  if (b.dataset.date) {
    selected = b.dataset.date;
    render();
    return;
  }
  if (b.dataset.history) {
    selected = b.dataset.history;
    month = new Date(selected + "T12:00:00");
    month.setDate(1);
    tab = "calendar";
    render();
    return;
  }
  const a = b.dataset.action,
    i = +b.dataset.i,
    j = +b.dataset.j;
  try {
    if (["prev-month", "next-month"].includes(a)) {
      month = new Date(
        month.getFullYear(),
        month.getMonth() + (a === "prev-month" ? -1 : 1),
        1,
      );
      render();
    }
    if (a === "today") {
      selected = today;
      month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      render();
    }
    if (a === "add-exercise") {
      const name = canonicalExercise(
        document.querySelector("#exercise-name").value.trim(),
      );
      if (!name) throw Error(tr("운동 이름을 입력하세요."));
      await mutate(() => {
        ensure().exercises.push({
          name,
          sets: [{ weight: 0, reps: 10, done: false }],
        });
        newExercise = "";
      });
    }
    if (a === "add-set")
      await mutate(() => {
        const sets = session().exercises[i].sets;
        sets.push({ ...(sets.at(-1) || { weight: 0, reps: 10 }), done: false });
      });
    if (a === "toggle-set") {
      await mutate(
        () =>
          (session().exercises[i].sets[j].done =
            !session().exercises[i].sets[j].done),
      );
      if (session()?.exercises[i]?.sets[j]?.done && state.settings.autoRest)
        startTimer();
    }
    if (a === "remove-set")
      await mutate(() => session().exercises[i].sets.splice(j, 1));
    if (a === "remove-exercise" && confirm(tr("이 운동과 세트를 삭제할까요?")))
      await mutate(() => session().exercises.splice(i, 1));
    if (a === "remove-photo" && confirm(tr("오늘의 사진을 삭제할까요?")))
      await mutate(() => (session().photo = null));
    if (
      a === "delete-day" &&
      session() &&
      confirm(`${selected}${tr("의 운동·메모·사진을 모두 삭제할까요?")}`)
    )
      await mutate(
        () =>
          (state.sessions = state.sessions.filter((s) => s.date !== selected)),
      );
    if (a === "save-routine") {
      if (!session()?.exercises.length)
        throw Error(tr("먼저 운동을 추가하세요."));
      const name = prompt(tr("루틴 이름 (예: 상체 A)"));
      if (name?.trim()) {
        if (name.trim().length > 100)
          throw Error(tr("루틴 이름은 100자 이하로 입력하세요."));
        await mutate(() =>
          state.routines.push({
            id: crypto.randomUUID(),
            name: name.trim(),
            exercises: structuredClone(session().exercises).map((e) => ({
              ...e,
              sets: e.sets.map((s) => ({ ...s, done: false })),
            })),
          }),
        );
        toast(tr("루틴을 저장했습니다."));
      }
    }
    if (a === "apply-routine") {
      const id = document.querySelector("#routine-select").value;
      if (!id) throw Error(tr("루틴을 선택하세요."));
      await mutate(() => routineApply(id));
    }
    if (a === "use-routine") {
      selected = today;
      tab = "calendar";
      month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      await mutate(() => routineApply(b.dataset.id));
    }
    if (a === "delete-routine" && confirm(tr("이 루틴을 삭제할까요?")))
      await mutate(() => {
        state.routines = state.routines.filter((r) => r.id !== b.dataset.id);
        for (const day of Object.keys(state.settings.schedule))
          if (state.settings.schedule[day] === b.dataset.id)
            state.settings.schedule[day] = "";
      });
    if (a === "timer") startTimer();
    if (a === "stop-timer") {
      clearInterval(timer);
      remaining = 0;
      render();
    }
    if (a === "share-day") {
      tab = "transfer";
      render();
    }
    if (a === "export") {
      const kind = document.querySelector("#export-kind").value;
      if (kind === "session" && !session())
        throw Error(tr("선택한 날짜의 기록이 없습니다."));
      const password = document.querySelector("#export-password").value;
      b.disabled = true;
      b.textContent = tr("압축 중…");
      try {
        const payload = {
          format: "gymlog",
          version: 1,
          kind,
          createdAt: new Date().toISOString(),
          data:
            kind === "backup"
              ? state
              : { version: 1, sessions: [session()], routines: [] },
        };
        const code = await encode(payload, password);
        document.querySelector("#export-output").value = code;
        document.querySelector("#export-size").textContent = tr(
          "exportSummary",
          {
            count: fmt(code.length),
            encryption: password ? tr("비밀번호 암호화됨") : tr("암호화 없음"),
            photos: payload.data.sessions.filter((s) => s.photo).length,
          },
        );
      } finally {
        b.disabled = false;
        b.textContent = tr("압축 문자열 만들기 ↗");
      }
    }
    if (a === "copy") {
      const text = output();
      try {
        await navigator.clipboard.writeText(text);
        toast(tr("복사했습니다."));
      } catch {
        document.querySelector("#export-output").select();
        toast(tr("복사 권한이 없습니다. 선택된 문자열을 직접 복사하세요."));
      }
    }
    if (a === "download") {
      const url = URL.createObjectURL(
        new Blob([output()], { type: "text/plain" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `gym-log-${today}.gymlog`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (a === "inspect-import") {
      imported = null;
      document.querySelector("#import-preview").textContent = tr("확인 중…");
      const payload = await decode(
        document.querySelector("#import-input").value,
        document.querySelector("#import-password").value,
      );
      if (
        payload.format !== "gymlog" ||
        payload.version !== 1 ||
        !["session", "backup"].includes(payload.kind)
      )
        throw Error(tr("지원하지 않는 백업 형식입니다."));
      validateState(payload.data);
      if (
        payload.kind === "session" &&
        (payload.data.sessions.length !== 1 || payload.data.routines.length)
      )
        throw Error(tr("세션 공유 형식이 올바르지 않습니다."));
      imported = payload;
      const conflicts = payload.data.sessions.filter((s) =>
        state.sessions.some((old) => old.date === s.date),
      ).length;
      document.querySelector("#import-preview").innerHTML =
        `<div class="preview"><b>${payload.kind === "backup" ? tr("전체 백업") : tr("운동 세션")}</b><p>${tr("importCounts", { days: payload.data.sessions.length, photos: payload.data.sessions.filter((s) => s.photo).length, routines: payload.data.routines.length })}</p><p>${tr("importConflicts", { count: conflicts })}</p><button class="primary" data-action="apply-import">${tr("확인하고 가져오기")}</button></div>`;
    }
    if (a === "apply-import") {
      if (!imported) throw Error(tr("먼저 내용을 확인하세요."));
      const pending = imported;
      await mutate(() => {
        state.sessions = mergeSessions(state.sessions, pending.data.sessions);
        const routines = new Map(state.routines.map((r) => [r.id, r]));
        for (const r of pending.data.routines) routines.set(r.id, r);
        state.routines = [...routines.values()];
        if (pending.kind === "backup" && pending.data.settings)
          state.settings = structuredClone(pending.data.settings);
      });
      imported = null;
      toast(tr("기록을 가져왔습니다."));
    }
    await extraAction(a, b, i, j);
    if (a === "persist") {
      const granted = await navigator.storage?.persist?.();
      toast(
        granted
          ? tr("기록 보관 권한이 허용되었습니다. 백업도 보관하세요.")
          : tr(
              "브라우저가 보관 권한을 허용하지 않았습니다. 백업 파일을 보관하세요.",
            ),
      );
    }
  } catch (err) {
    if (a === "inspect-import") {
      const p = document.querySelector("#import-preview");
      if (p) p.textContent = "";
    }
    if (err.name !== "AbortError") toast(err.message);
  }
});
function output() {
  const value = document.querySelector("#export-output").value;
  if (!value) throw Error(tr("먼저 공유 문자열을 생성하세요."));
  return value;
}
function mobileUI() {
  return matchMedia("(max-width: 850px)").matches;
}
const sessionShares = createSessionShareCache();
let focusState = null,
  focusBusy = false,
  focusTicker = null,
  focusFullscreen = false,
  lastFocusTap = -Infinity;
function focusSession() {
  return state.sessions.find((s) => s.date === focusState?.date);
}
function saveFocus() {
  try {
    if (focusState)
      sessionStorage.setItem("gym-focus", JSON.stringify(focusState));
    else sessionStorage.removeItem("gym-focus");
  } catch {}
}
function restoreFocus() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("gym-focus") || "null");
    if (!saved || !["running", "rest", "ready", "done"].includes(saved.phase))
      return;
    const s = state.sessions.find((s) => s.date === saved.date);
    if (!s) return;
    const next = nextPending(s);
    if (saved.phase === "done" && !next) {
      focusState = { date: s.date, phase: "done", cursor: null };
    } else if (next && !s.endedAt) {
      const same = saved.cursor?.i === next.i && saved.cursor?.j === next.j;
      focusState = {
        date: s.date,
        phase: same ? saved.phase : "ready",
        cursor: next,
        deadline: Number.isFinite(saved.deadline) ? saved.deadline : Date.now(),
      };
      if (focusState.phase === "done") focusState.phase = "ready";
    } else return;
    selected = s.date;
    if (focusState.phase !== "done") startFocusTicker();
    keepScreenAwake(focusState.phase !== "done");
  } catch {}
}
function startFocusTicker() {
  clearInterval(focusTicker);
  focusTicker = setInterval(tickFocus, 250);
}
function tickFocus() {
  if (focusState?.phase !== "rest") return;
  const remaining = remainingRest(focusState.deadline);
  const label = document.querySelector("#focus-countdown");
  if (label) label.textContent = String(remaining);
  if (remaining === 0) {
    focusState.phase = "ready";
    saveFocus();
    render();
    alertRest(tr("focusRestComplete"), tr("focusRestBody"));
  }
}
function enterFocus() {
  clearInterval(timer);
  remaining = 0;
  const s = session(),
    cursor = nextPending(s);
  if (!cursor) {
    toast(tr("focusNoPending"));
    return;
  }
  focusState = { date: s.date, phase: "running", cursor };
  lastFocusTap = -Infinity;
  saveFocus();
  startFocusTicker();
  keepScreenAwake(true);
  render();
}
function leaveFocus() {
  focusState = null;
  saveFocus();
  clearInterval(focusTicker);
  keepScreenAwake(false);
  if (focusFullscreen && document.fullscreenElement)
    document.exitFullscreen?.().catch(() => {});
  focusFullscreen = false;
  render();
}
function focusView() {
  if (!focusState) return "";
  const s = focusSession();
  if (!s) return "";
  const progress = focusProgress(s),
    phase = focusState.phase;
  const header = `<div class="focus-header"><span>${tr("focusTitle")}</span><div><button data-action="focus-notify" class="focus-small">${tr("focusNotify")}</button><button data-action="focus-exit" class="focus-small" aria-label="${tr("focusExit")}">×</button></div></div>`;
  if (phase === "done")
    return `<section class="focus-overlay focus-finished" role="dialog" aria-modal="true" aria-label="${tr("focusTitle")}">${header}<div class="focus-finish"><div class="finish-check">✓</div><h1>${tr("focusFinishTitle")}</h1><p>${tr("sessionDuration", { minutes: Math.max(0, Math.round(((s.endedAt || Date.now()) - (s.startedAt || Date.now())) / 60000)), sets: progress.done })}</p><strong>${fmt(displayWeight(volume(s)))} ${unit()}</strong><h2>${tr(s.photo ? "focusPhotoReplace" : "focusFinishPhoto")}</h2>${s.photo ? `<img class="focus-saved-photo" src="${s.photo}" alt="${tr("운동 사진")}">` : ""}<button class="focus-photo-button" data-action="focus-photo-picker">${tr(s.photo ? "사진 교체" : "focusAddPhoto")}</button><input id="focus-photo" type="file" accept="image/*,.heic,.heif" hidden><button class="focus-small" data-action="focus-dismiss">${tr(s.photo ? "focusClose" : "focusLater")}</button><button class="focus-small" data-action="share-day">${tr("공유 ↗")}</button></div></section>`;
  const { i, j } = focusState.cursor,
    e = s.exercises[i],
    set = e.sets[j],
    resting = phase === "rest";
  return `<section class="focus-overlay phase-${phase}" role="dialog" aria-modal="true" aria-label="${tr("focusTitle")}">${header}<div class="focus-progress"><span>${tr("focusExercise", { current: i + 1, total: s.exercises.length })}</span><span>${progress.done} / ${progress.total}</span></div><button class="focus-touch" data-action="focus-tap" ${resting || focusBusy ? "disabled" : ""}><div class="focus-eyebrow">${resting ? tr("focusRest") : phase === "ready" ? tr(j === 0 ? "focusNextExercise" : "focusReady") : tr("DAILY WORKOUT")}</div>${resting ? `<div id="focus-countdown" class="focus-countdown" role="timer">${remainingRest(focusState.deadline)}</div><div class="focus-up-next">${tr(j === 0 ? "focusNextExercise" : "focusNextSet")}</div>` : ""}<h1>${esc(exerciseLabel(e.name))}</h1><div class="focus-values"><strong>${displayWeight(set.weight)}<small>${unit()}</small></strong><span>×</span><strong>${set.reps}<small>${tr("focusReps")}</small></strong></div><p class="focus-set-number">${tr("focusSet", { current: j + 1, total: e.sets.length })}</p><div class="focus-tap-hint" ${resting ? 'aria-live="polite"' : ""}>${resting ? tr("focusRestWaiting") : tr(phase === "running" ? "focusFinishSet" : "focusStartSet")}</div></button><div class="focus-bottom">${resting ? `<button class="focus-small" data-action="focus-skip-rest">${tr("focusSkipRest")}</button>` : `<span>${tr("focusExitHint")}</span>`}</div></section>`;
}
async function advanceFocus() {
  if (
    focusBusy ||
    !focusState ||
    ["rest", "done"].includes(focusState.phase) ||
    Date.now() - lastFocusTap < 350
  )
    return;
  lastFocusTap = Date.now();
  if (focusState.phase === "ready") {
    focusState.phase = "running";
    saveFocus();
    render();
    return;
  }
  focusBusy = true;
  try {
    const date = focusState.date,
      { i, j } = focusState.cursor;
    await mutate(() => {
      const s = ensure(date);
      s.exercises[i].sets[j].done = true;
      if (!nextPending(s)) s.endedAt = Date.now();
    }, false);
    const cursor = nextPending(focusSession());
    if (!cursor) {
      focusState.phase = "done";
      focusState.cursor = null;
      keepScreenAwake(false);
      clearInterval(focusTicker);
    } else {
      focusState.cursor = cursor;
      focusState.phase = state.settings.autoRest ? "rest" : "ready";
      focusState.deadline = Date.now() + state.settings.restSeconds * 1000;
    }
    saveFocus();
  } catch (error) {
    toast(error.message);
  } finally {
    focusBusy = false;
    render();
  }
}
function requestFocusNotifications() {
  if (!("Notification" in window)) {
    toast(tr("focusNotifyUnavailable"));
    return;
  }
  try {
    Notification.requestPermission()
      .then((permission) =>
        toast(
          tr(
            permission === "granted"
              ? "focusNotifyGranted"
              : "focusNotifyDenied",
          ),
        ),
      )
      .catch(() => toast(tr("focusNotifyUnavailable")));
  } catch {
    toast(tr("focusNotifyUnavailable"));
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tickFocus();
    if (focusState && focusState.phase !== "done") keepScreenAwake(true);
  }
});
function downloadShared(data) {
  const url = URL.createObjectURL(
    new Blob([data.text], { type: "text/plain" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `gym-log-${data.date}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function openShareDialog(data, message) {
  document.querySelector("#share-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "share-dialog";
  dialog.className = "share-dialog";
  dialog.innerHTML = `<div class="panel-title"><h2>${tr("shareFallback")}</h2><button data-share="close" class="icon" aria-label="${tr("shareClose")}">×</button></div><p class="hint share-message"></p><button data-share="native" class="primary full" disabled>${tr("shareTap")}</button><div class="row share-fallback-actions"><button data-share="download" class="secondary" disabled>${tr("파일 다운로드")}</button><button data-share="copy" class="secondary" disabled>${tr("문자열 복사")}</button></div><textarea class="share-code" readonly aria-label="${tr("공유 문자열")}"></textarea><button data-share="advanced" class="text-button">${tr("shareAdvanced")}</button>`;
  document.body.append(dialog);
  dialog.showModal();
  let current = data;
  function update(value) {
    if (!dialog.isConnected) return;
    current = value;
    dialog.querySelector(".share-code").value = value.text;
    dialog.querySelector(".share-message").textContent =
      message || tr("shareReady");
    dialog
      .querySelectorAll("button[data-share]")
      .forEach((b) => (b.disabled = false));
  }
  dialog.querySelector(".share-message").textContent =
    message || tr("sharePreparing");
  if (data) update(data);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", (event) => {
    const action = event.target.closest("[data-share]")?.dataset.share;
    if (!action) return;
    if (action === "close") {
      dialog.close();
      return;
    }
    if (action === "advanced") {
      dialog.close();
      if (focusState) leaveFocus();
      tab = "transfer";
      render();
      return;
    }
    if (!current) return;
    if (action === "download") downloadShared(current);
    if (action === "copy") {
      const textarea = dialog.querySelector(".share-code");
      try {
        navigator.clipboard
          .writeText(current.text)
          .then(() => toast(tr("복사했습니다.")))
          .catch(() => {
            textarea.focus();
            textarea.select();
            toast(tr("복사 권한이 없습니다. 선택된 문자열을 직접 복사하세요."));
          });
      } catch {
        textarea.focus();
        textarea.select();
        toast(tr("복사 권한이 없습니다. 선택된 문자열을 직접 복사하세요."));
      }
    }
    if (action === "native") {
      const button = event.target.closest("button");
      button.disabled = true;
      sharePrepared(current, dialog).finally(() => {
        if (button.isConnected) button.disabled = false;
      });
    }
  });
  return {
    update,
    error(error) {
      if (!dialog.isConnected) return;
      dialog.querySelector(".share-message").textContent = error.message;
    },
  };
}
function sharePrepared(data, dialog) {
  try {
    // Called synchronously from the tap: do not await storage, compression or crypto here.
    const sharing = shareData(data.text, data.date, tr("운동 기록"));
    if (!sharing) {
      if (dialog)
        dialog.querySelector(".share-message").textContent =
          tr("shareUnavailable");
      else openShareDialog(data, tr("shareUnavailable"));
      return Promise.resolve();
    }
    return Promise.resolve(sharing)
      .then(() => dialog?.close())
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (dialog)
          dialog.querySelector(".share-message").textContent =
            tr("shareBlocked");
        else openShareDialog(data, tr("shareBlocked"));
      });
  } catch {
    if (dialog)
      dialog.querySelector(".share-message").textContent = tr("shareBlocked");
    else openShareDialog(data, tr("shareBlocked"));
    return Promise.resolve();
  }
}
function shareDay() {
  const s = session();
  if (!s) {
    toast(tr("선택한 날짜의 기록이 없습니다."));
    return;
  }
  const ready = sessionShares.ready(s);
  if (ready) {
    sharePrepared(ready);
    return;
  }
  const dialog = openShareDialog(null);
  sessionShares
    .prepare(s)
    .then((data) => {
      if (data) dialog.update(data);
    })
    .catch((error) => dialog.error(error));
}

try {
  state = await load();
  state.settings = { ...defaultSettings(), ...state.settings };
  restoreFocus();
  render();
  tickFocus();
} catch (err) {
  app.innerHTML = `<main><h1>${tr("저장소를 열 수 없습니다")}</h1><p>${esc(err.message)}</p><p>${tr("브라우저의 저장소 권한과 개인 정보 보호 설정을 확인하세요. 기존 데이터를 보호하기 위해 초기화하지 않았습니다.")}</p></main>`;
}

function startTimer() {
  clearInterval(timer);
  deadline = Date.now() + state.settings.restSeconds * 1000;
  remaining = state.settings.restSeconds;
  render();
  timer = setInterval(() => {
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const label = document.querySelector("#timer-value");
    if (label) label.textContent = `${remaining}${tr("초 휴식")}`;
    if (!remaining) {
      clearInterval(timer);
      render();
      alertRest(tr("focusRestComplete"), tr("focusRestBody"));
      toast(tr("휴식 끝! 다음 세트를 시작하세요."));
    }
  }, 500);
}
function sessionControls(s) {
  const day = new Date(selected + "T12:00:00").getDay(),
    planned = state.routines.find((r) => r.id === state.settings.schedule[day]);
  return `<div class="session-controls"><div class="row"><button class="${s?.startedAt && !s?.endedAt ? "secondary" : "primary"}" data-action="${s?.startedAt && !s?.endedAt ? "end-session" : "start-session"}">${s?.startedAt && !s?.endedAt ? tr("■ 운동 종료") : tr("▶ 운동 시작")}</button>${mobileUI() && s?.startedAt && !s?.endedAt ? `<button class="secondary" data-action="focus-resume">${tr("focusResume")}</button>` : ""}<span class="hint">${s?.startedAt ? (s.endedAt ? tr("sessionDuration", { minutes: Math.round((s.endedAt - s.startedAt) / 60000), sets: completed(s) }) : tr("운동 진행 중 · 시작 ") + new Date(s.startedAt).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })) : tr("시작과 종료 시간을 기록하세요.")}</span></div>${planned ? `<p class="hint">${tr("예정된 루틴:")} ${esc(planned.name)} <button class="text-button" data-action="planned-routine" data-id="${esc(planned.id)}">${tr("운동에 추가 ↗")}</button></p>` : ""}</div>`;
}
function settings() {
  return `<section class="panel settings-panel"><h2>${tr("내 운동 환경")}</h2><p class="hint">${tr("회원가입 없이 이 브라우저에 설정을 저장합니다. 전체 백업에 설정이 포함됩니다.")}</p><label class="field-label" for="unit">${tr("중량 단위")}</label><select id="unit" data-setting="unit">${["kg", "lbs"].map((u) => `<option ${unit() === u ? "selected" : ""}>${u}</option>`).join("")}</select><label class="field-label" for="goal">${tr("운동 목표")}</label><select id="goal" data-setting="goal">${["근비대", tr("근력 향상"), tr("체지방 감량"), tr("건강 유지")].map((g) => `<option value="${g}" ${state.settings.goal === g ? "selected" : ""}>${tr(g)}</option>`).join("")}</select><label class="field-label" for="weekly-days">${tr("주간 목표 운동일")}</label><input id="weekly-days" data-setting="weeklyDays" type="number" min="1" max="7" value="${state.settings.weeklyDays}"><label class="field-label" for="rest-seconds">${tr("기본 휴식 시간 (초)")}</label><input id="rest-seconds" data-setting="restSeconds" type="number" min="10" max="600" value="${state.settings.restSeconds}"><label class="checkbox-label"><input type="checkbox" data-setting="autoRest" ${state.settings.autoRest ? "checked" : ""}> ${tr("세트 완료 시 휴식 타이머 자동 시작")}</label><p class="hint">${tr("무게는 내부적으로 kg 단위로 보관하며 화면에서만 변환합니다.")}</p></section>`;
}
function guide() {
  return `<div class="intro"><h2>${tr("알고, 제대로 움직이기.")}</h2><p>${tr("이름과 한글 초성으로 검색하고 부위·기구별로 찾아보세요. 가이드는 일반 참고용이며 통증이 있으면 운동을 멈추세요.")}</p></div><section class="panel"><div class="guide-filters"><input id="guide-search" placeholder="${tr("운동 검색 · ㅂㅊㅍㄹㅅ")}" value="${esc(guideQuery)}"><select id="guide-body" aria-label="${tr("부위 필터")}"><option value="">${tr("모든 부위")}</option>${["가슴", "등", "어깨", "하체", "팔", "코어", "유산소"].map((v) => `<option value="${v}" ${guideBody === v ? "selected" : ""}>${tr(v)}</option>`).join("")}</select><select id="guide-equipment" aria-label="${tr("기구 필터")}"><option value="">${tr("모든 기구")}</option>${["바벨", "덤벨", "머신", "케틀벨", "맨몸"].map((v) => `<option value="${v}" ${guideEquipment === v ? "selected" : ""}>${tr(v)}</option>`).join("")}</select></div><div id="guide-results">${guideResults()}</div></section>`;
}
function guideResults() {
  return `<div class="guide-grid">${
    searchExercises(guideQuery, guideBody, guideEquipment)
      .map(
        (e) =>
          `<article class="guide-card"><div class="exercise-illustration" role="img" aria-label="${tr(e.equipment)} ${tr("운동 아이콘")}"><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M20 35H80M25 18V52M33 23V47M67 23V47M75 18V52" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg></div><div class="eyebrow">${tr(e.body)} · ${tr(e.equipment)}</div><h3>${esc(exerciseLabel(e.name))}</h3><p>${esc(tr(e.guide))}</p><button class="secondary" data-action="guide-add" data-name="${esc(e.name)}">${tr("선택 날짜 운동에 추가 ＋")}</button></article>`,
      )
      .join("") ||
    `<p class="hint">${tr("검색 결과가 없습니다. 캘린더에서 종목을 직접 입력할 수 있습니다.")}</p>`
  }</div>`;
}
function renderGuideResults() {
  document.querySelector("#guide-results").innerHTML = guideResults();
}
function scheduleView() {
  return `<section class="panel schedule-panel"><h2>${tr("요일별 운동 계획")}</h2><p class="hint">${tr("요일에 루틴을 배치하세요. 선택한 날짜의 기록 화면에서 예정 루틴을 불러옵니다.")}</p><div class="schedule-grid">${weekdays()
    .map(
      (d, i) =>
        `<label>${d}<select data-schedule="${i}" aria-label="${d}${tr("요일 루틴")}"><option value="">${tr("휴식")}</option>${state.routines.map((r) => `<option value="${esc(r.id)}" ${state.settings.schedule[i] === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`,
    )
    .join("")}</div></section>`;
}
function routineEditor() {
  return `<section class="panel"><div class="panel-title"><h2>${tr("루틴 편집")}</h2><button class="text-button" data-action="cancel-edit">${tr("취소")}</button></div><label class="field-label" for="edit-name">${tr("루틴 이름")}</label><input id="edit-name" value="${esc(editing.name)}" maxlength="100">${editing.exercises.map((e, i) => `<article class="exercise-card"><div class="exercise-head"><input aria-label="${tr("루틴 종목")} ${i + 1}" data-edit-field="name" data-i="${i}" maxlength="100" value="${esc(exerciseLabel(e.name))}"><button class="icon" data-action="edit-up" data-i="${i}" aria-label="${tr("종목 위로 이동")}">↑</button><button class="icon" data-action="edit-remove" data-i="${i}" aria-label="${tr("루틴 종목 삭제")}">×</button></div>${e.sets.map((s, j) => `<div class="row edit-set"><span>${j + 1}</span><input type="number" min="0" max="10000" aria-label="${tr("루틴")} ${i + 1}${tr("종목")} ${j + 1}${tr("세트 무게")}" value="${displayWeight(s.weight)}" data-edit-field="weight" data-i="${i}" data-j="${j}"><span>${unit()}</span><input type="number" min="0" max="100000" aria-label="${tr("루틴")} ${i + 1}${tr("종목")} ${j + 1}${tr("세트 횟수")}" value="${s.reps}" data-edit-field="reps" data-i="${i}" data-j="${j}"><span>${tr("회")}</span><button class="icon" data-action="edit-set-remove" data-i="${i}" data-j="${j}" aria-label="${tr("루틴 세트 삭제")}">×</button></div>`).join("")}<button class="add-set" data-action="edit-set-add" data-i="${i}">${tr("＋ 세트 추가")}</button></article>`).join("")}<div class="row"><input id="edit-exercise-name" placeholder="${tr("추가할 운동 이름")}" list="edit-exercises" maxlength="100"><datalist id="edit-exercises">${library.map((e) => `<option value="${esc(exerciseLabel(e.name))}">`).join("")}</datalist><button class="secondary" data-action="edit-add">${tr("＋ 운동 추가")}</button></div><button class="primary full" data-action="commit-edit">${tr("루틴 저장")}</button><p class="hint">${tr("루틴을 수정해도 기존 날짜의 운동 기록은 유지됩니다.")}</p></section>`;
}
function strengthStats() {
  const performances = new Map();
  for (const s of [...state.sessions].sort((a, b) =>
    a.date.localeCompare(b.date),
  ))
    for (const e of s.exercises)
      for (const set of e.sets.filter((t) => t.done)) {
        const rm = estimate1RM(set.weight, set.reps);
        if (!rm) continue;
        const list = performances.get(e.name) || [];
        list.push({ date: s.date, rm, weight: set.weight });
        performances.set(e.name, list);
      }
  const bodyVolumes = new Map();
  for (const s of state.sessions)
    for (const e of s.exercises) {
      const body = library.find((item) => item.name === e.name)?.body || "기타";
      bodyVolumes.set(
        body,
        (bodyVolumes.get(body) || 0) + volume({ exercises: [e] }),
      );
    }
  const big3 = ["스쿼트", "벤치 프레스", "데드리프트"].map((n) =>
    Math.max(0, ...(performances.get(n) || []).map((p) => p.rm)),
  );
  return `<div class="analysis-grid"><section class="panel"><h2>${tr("1RM 계산기")}</h2><p class="hint">${tr("Epley 공식 · 1~12회 권장 · 추정치이며 실제 최대 중량과 다릅니다.")}</p><div class="row"><input id="rm-weight" type="number" min="0" max="10000" placeholder="${tr("무게 (")}${unit()})" aria-label="${tr("1RM 무게")}"><input id="rm-reps" type="number" min="1" max="12" placeholder="${tr("횟수")}" aria-label="${tr("1RM 횟수")}"><button class="primary" data-action="calculate-rm">${tr("계산")}</button></div><p id="rm-result" class="rm-result">${tr("예상 최대 중량을 확인해 보세요.")}</p><h3>${tr("3대 운동 추정 1RM")}</h3><p class="hint">${["스쿼트", "벤치 프레스", "데드리프트"].map((n, i) => `${exerciseLabel(n)} ${displayWeight(Math.round(big3[i]))} ${unit()}`).join(" · ")}</p><b>${fmt(displayWeight(Math.round(big3.reduce((n, v) => n + v, 0))))} ${unit()} ${tr("합계")}</b></section><section class="panel"><h2>${tr("부위별 누적 볼륨")}</h2>${[...bodyVolumes].map(([body, v]) => `<div class="body-volume"><span>${tr(body)}</span><b>${fmt(displayWeight(v))} ${unit()}</b></div>`).join("") || `<p class="hint">${tr("완료 세트가 쌓이면 부위별 볼륨이 표시됩니다.")}</p>`}</section></div><section class="panel strength-history"><h2>${tr("종목별 성장 기록")}</h2><p class="hint">${tr("완료 세트 중 1~12회 기록 기준. 날짜별 가장 높은 추정 1RM을 표시합니다.")}</p>${
    [...performances]
      .map(([name, list]) => {
        const byDate = new Map();
        for (const p of list)
          byDate.set(p.date, Math.max(byDate.get(p.date) || 0, p.rm));
        const values = [...byDate].slice(-10),
          max = Math.max(...values.map((v) => v[1]));
        return `<div class="strength-item"><h3>${esc(name)} <small>PR ${displayWeight(Math.round(Math.max(...list.map((p) => p.rm))))} ${unit()}</small></h3><div class="chart mini-chart">${values.map(([date, rm]) => `<div class="chart-column"><span>${displayWeight(Math.round(rm))}</span><div style="height:${Math.max(2, (rm / max) * 100)}px"></div><small>${date.slice(5)}</small></div>`).join("")}</div></div>`;
      })
      .join("") ||
    `<p class="hint">${tr("운동 세트를 완료하면 성장 기록이 표시됩니다.")}</p>`
  }</section>`;
}
async function extraAction(a, b, i, j) {
  if (a === "focus-resume") enterFocus();
  if (a === "start-session") {
    if (mobileUI() && !nextPending(session())) {
      toast(
        tr(
          session()?.exercises.some((e) => e.sets.length)
            ? "focusNoPending"
            : "focusNoSets",
        ),
      );
      return;
    }
    if (
      session()?.startedAt &&
      session()?.endedAt &&
      !confirm(tr("기존 운동 시간을 새 시작 시간으로 바꿀까요?"))
    )
      return;
    await mutate(() => {
      ensure().startedAt = Date.now();
      ensure().endedAt = null;
    });
    if (mobileUI()) enterFocus();
  }
  if (a === "end-session") {
    await mutate(() => (ensure().endedAt = Date.now()));
    toast(tr("운동을 완료했습니다. 수고하셨어요!"));
  }
  if (a === "planned-routine") await mutate(() => routineApply(b.dataset.id));
  if (a === "guide-add") {
    await mutate(() =>
      ensure().exercises.push({
        name: b.dataset.name,
        sets: [{ weight: 0, reps: 10, done: false }],
      }),
    );
    toast(tr("선택 날짜에 운동을 추가했습니다."));
  }
  if (a === "move-up" && i > 0)
    await mutate(() => {
      const es = session().exercises;
      [es[i - 1], es[i]] = [es[i], es[i - 1]];
    });
  if (a === "previous" || a === "recommend") {
    const current = session().exercises[i];
    const previous = [...state.sessions]
      .filter((s) => s.date < selected)
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((s) => s.exercises)
      .find((e) => e.name === current.name && e.sets.some((s) => s.done));
    if (!previous) throw Error(tr("이 종목의 이전 완료 기록이 없습니다."));
    const increase =
      a === "recommend" &&
      previous.sets.length > 0 &&
      previous.sets.every((s) => s.done);
    if (
      a === "recommend" &&
      !confirm(
        `${tr("직전 세트를")} ${increase ? tr("2.5kg 증량하여") : tr("같은 중량으로")} ${tr("제안합니다. 적용할까요?")}`,
      )
    )
      return;
    await mutate(
      () =>
        (current.sets = previous.sets.map((s) => ({
          ...s,
          weight: s.weight + (increase ? 2.5 : 0),
          done: false,
        }))),
    );
    toast(
      a === "previous"
        ? tr("이전 기록을 불러왔습니다.")
        : tr("규칙 기반 중량 제안을 적용했습니다."),
    );
  }
  if (
    a === "template" &&
    confirm(tr("현재 세트를 5 × 5 템플릿으로 교체할까요?"))
  )
    await mutate(() => {
      const e = session().exercises[i],
        weight = e.sets[0]?.weight || 0;
      e.sets = Array.from({ length: 5 }, () => ({
        weight,
        reps: 5,
        done: false,
      }));
    });
  if (a === "new-routine") {
    editing = { id: crypto.randomUUID(), name: tr("새 루틴"), exercises: [] };
    render();
  }
  if (a === "edit-routine") {
    editing = structuredClone(
      state.routines.find((r) => r.id === b.dataset.id),
    );
    render();
  }
  if (a === "clone-routine")
    await mutate(() => {
      const r = structuredClone(
        state.routines.find((r) => r.id === b.dataset.id),
      );
      r.id = crypto.randomUUID();
      r.name = (r.name + tr(" 복사")).slice(0, 100);
      state.routines.push(r);
    });
  if (a === "cancel-edit") {
    editing = null;
    render();
  }
  if (a === "edit-add") {
    const name = canonicalExercise(
      document.querySelector("#edit-exercise-name").value.trim(),
    );
    if (!name) throw Error(tr("운동 이름을 입력하세요."));
    editing.exercises.push({
      name,
      sets: [{ weight: 0, reps: 10, done: false }],
    });
    render();
  }
  if (a === "edit-remove") {
    editing.exercises.splice(i, 1);
    render();
  }
  if (a === "edit-up" && i > 0) {
    [editing.exercises[i - 1], editing.exercises[i]] = [
      editing.exercises[i],
      editing.exercises[i - 1],
    ];
    render();
  }
  if (a === "edit-set-add") {
    const sets = editing.exercises[i].sets;
    sets.push({ ...(sets.at(-1) || { weight: 0, reps: 10 }), done: false });
    render();
  }
  if (a === "edit-set-remove") {
    editing.exercises[i].sets.splice(j, 1);
    render();
  }
  if (a === "commit-edit") {
    if (!editing.exercises.length) throw Error(tr("루틴에 운동을 추가하세요."));
    validateState({ version: 1, sessions: [], routines: [editing] });
    const draft = structuredClone(editing);
    await mutate(() => {
      const at = state.routines.findIndex((r) => r.id === draft.id);
      if (at < 0) state.routines.push(draft);
      else state.routines[at] = draft;
    });
    editing = null;
    render();
    toast(tr("루틴을 저장했습니다."));
  }
  if (a === "calculate-rm") {
    const weight = Number(document.querySelector("#rm-weight").value),
      reps = Number(document.querySelector("#rm-reps").value);
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 10000 ||
      !Number.isInteger(reps) ||
      reps < 1 ||
      reps > 12
    )
      throw Error(tr("무게와 1~12회 횟수를 입력하세요."));
    document.querySelector("#rm-result").textContent =
      `${tr("추정 1RM:")} ${fmt(Math.round(estimate1RM(weight, reps) * 10) / 10)} ${unit()}`;
  }
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const register = () =>
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() =>
        toast(
          tr(
            "오프라인 캐시를 준비하지 못했습니다. 온라인에서 계속 사용할 수 있습니다.",
          ),
        ),
      );
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
