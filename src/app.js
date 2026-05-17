const ACTION_TYPES = ["SS", "ZD", "JX", "XZ", "JR", "DT", "PS", "YL", "empty"];
const ACTION_LABELS = {
  SS: "SS 伸缩",
  ZD: "ZD 震动",
  JX: "JX 夹吸",
  XZ: "XZ 旋转",
  JR: "JR 加热",
  DT: "DT 点头",
  PS: "PS 喷水",
  YL: "YL 音量",
  empty: "empty 空指令"
};

const els = {
  videoInput: document.querySelector("#videoInput"),
  scriptInput: document.querySelector("#scriptInput"),
  video: document.querySelector("#video"),
  dropHint: document.querySelector("#dropHint"),
  videoStatus: document.querySelector("#videoStatus"),
  videoDebug: document.querySelector("#videoDebug"),
  playBtn: document.querySelector("#playBtn"),
  addPointBtn: document.querySelector("#addPointBtn"),
  newScriptBtn: document.querySelector("#newScriptBtn"),
  undoBtn: document.querySelector("#undoBtn"),
  redoBtn: document.querySelector("#redoBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  dirtyStatus: document.querySelector("#dirtyStatus"),
  syncFromActionsBtn: document.querySelector("#syncFromActionsBtn"),
  syncFromMultiBtn: document.querySelector("#syncFromMultiBtn"),
  recordTarget: document.querySelector("#recordTarget"),
  recordInterval: document.querySelector("#recordInterval"),
  recordToggleBtn: document.querySelector("#recordToggleBtn"),
  recordPad: document.querySelector("#recordPad"),
  recordPadCursor: document.querySelector("#recordPadCursor"),
  stampButtons: document.querySelectorAll("[data-stamp]"),
  currentTime: document.querySelector("#currentTime"),
  durationTime: document.querySelector("#durationTime"),
  scriptSummary: document.querySelector("#scriptSummary"),
  timeline: document.querySelector("#timeline"),
  modeButtons: document.querySelectorAll(".mode-switch button"),
  emptySelection: document.querySelector("#emptySelection"),
  pointEditor: document.querySelector("#pointEditor"),
  atInput: document.querySelector("#atInput"),
  posInput: document.querySelector("#posInput"),
  commandsList: document.querySelector("#commandsList"),
  addCommandBtn: document.querySelector("#addCommandBtn"),
  savePointBtn: document.querySelector("#savePointBtn"),
  deletePointBtn: document.querySelector("#deletePointBtn"),
  validationList: document.querySelector("#validationList"),
  jsonPreview: document.querySelector("#jsonPreview")
};

const ctx = els.timeline.getContext("2d");

const state = {
  fileName: "untitled.funscript",
  mode: "both",
  selectedAt: null,
  script: createEmptyScript(),
  durationMs: 600000,
  history: [],
  future: [],
  dirty: false,
  recorder: {
    enabled: false,
    pointerDown: false,
    historyStarted: false,
    lastAt: -Infinity,
    lastValue: null
  },
  videoObjectUrl: null
};

function createEmptyScript() {
  return {
    version: "1.0",
    inverted: false,
    range: 100,
    actions: [],
    metadata: {
      title: "Untitled",
      creator: "Multi Funscript Editor",
      tags: ["multiAction"]
    },
    multiAction: {
      version: "2.0",
      timeline: []
    }
  };
}

function normalizeScript(input) {
  const script = structuredClone(input || {});
  script.version = script.version || "1.0";
  script.inverted = Boolean(script.inverted);
  script.range = Number.isFinite(Number(script.range)) ? Number(script.range) : 100;
  script.actions = Array.isArray(script.actions) ? script.actions : [];
  script.actions = script.actions
    .map((point) => ({
      at: clampInt(point.at, 0, Number.MAX_SAFE_INTEGER),
      pos: clampInt(point.pos, 0, 100)
    }))
    .sort((a, b) => a.at - b.at);
  script.metadata = script.metadata && typeof script.metadata === "object" ? script.metadata : {};
  script.multiAction = script.multiAction && typeof script.multiAction === "object"
    ? script.multiAction
    : { version: "2.0", timeline: [] };
  script.multiAction.version = script.multiAction.version || "2.0";
  script.multiAction.timeline = Array.isArray(script.multiAction.timeline)
    ? script.multiAction.timeline
    : [];
  script.multiAction.timeline = script.multiAction.timeline
    .map((point) => ({
      at: clampInt(point.at, 0, Number.MAX_SAFE_INTEGER),
      commands: normalizeCommands(point.commands)
    }))
    .sort((a, b) => a.at - b.at);
  return script;
}

function normalizeCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return [{ action: "empty", qty: "0" }];
  }
  return commands.map((cmd) => {
    const action = ACTION_TYPES.includes(cmd.action) ? cmd.action : "empty";
    const qty = clampInt(cmd.qty, 0, 10);
    return { action, qty: String(qty) };
  });
}

function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function formatTime(ms) {
  const totalMs = Math.max(0, Math.floor(ms || 0));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function currentVideoMs() {
  return Math.floor((els.video.currentTime || 0) * 1000);
}

function setVideoStatus(message, type = "info") {
  if (!message) {
    els.videoStatus.textContent = "";
    els.videoStatus.classList.add("hidden");
    els.videoStatus.classList.remove("error");
    return;
  }
  els.videoStatus.textContent = message;
  els.videoStatus.classList.remove("hidden");
  els.videoStatus.classList.toggle("error", type === "error");
}

function hasDecodedVideoFrame() {
  return els.video.videoWidth > 0 && els.video.videoHeight > 0;
}

function checkVideoFrameAvailability() {
  if (!els.video.currentSrc) return;
  if (els.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (hasDecodedVideoFrame()) return;
  setVideoStatus("视频已加载但没有解码出画面帧。请换用 H.264/AAC 的 MP4，或用支持该编码的浏览器打开。", "error");
}

function updateVideoDebug(extra = "") {
  const video = els.video;
  const readyLabels = {
    0: "HAVE_NOTHING",
    1: "HAVE_METADATA",
    2: "HAVE_CURRENT_DATA",
    3: "HAVE_FUTURE_DATA",
    4: "HAVE_ENOUGH_DATA"
  };
  const networkLabels = {
    0: "NETWORK_EMPTY",
    1: "NETWORK_IDLE",
    2: "NETWORK_LOADING",
    3: "NETWORK_NO_SOURCE"
  };
  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  const duration = Number.isFinite(video.duration) ? formatTime(video.duration * 1000) : "--:--.---";
  const time = formatTime((video.currentTime || 0) * 1000);
  const parts = [
    `ready=${readyLabels[video.readyState] || video.readyState}`,
    `network=${networkLabels[video.networkState] || video.networkState}`,
    `size=${width}x${height}`,
    `time=${time}/${duration}`
  ];
  if (video.currentSrc && width === 0 && height === 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    parts.push("videoFrames=0");
  }
  if (extra) parts.push(extra);
  els.videoDebug.textContent = parts.join(" · ");
}

function getScriptDuration() {
  const actionMax = state.script.actions.at(-1)?.at || 0;
  const multiMax = state.script.multiAction.timeline.at(-1)?.at || 0;
  const videoMax = Number.isFinite(els.video.duration) ? Math.floor(els.video.duration * 1000) : 0;
  return Math.max(actionMax, multiMax, videoMax, 1000);
}

function findAction(at) {
  return state.script.actions.find((point) => point.at === at);
}

function findMultiPoint(at) {
  return state.script.multiAction.timeline.find((point) => point.at === at);
}

function collectTimes() {
  return Array.from(new Set([
    ...state.script.actions.map((point) => point.at),
    ...state.script.multiAction.timeline.map((point) => point.at)
  ])).sort((a, b) => a - b);
}

function cloneScript(script) {
  return JSON.parse(JSON.stringify(script));
}

function snapshot() {
  return {
    fileName: state.fileName,
    script: cloneScript(state.script),
    selectedAt: state.selectedAt,
    dirty: state.dirty
  };
}

function restoreSnapshot(item) {
  state.fileName = item.fileName || state.fileName;
  state.script = cloneScript(item.script);
  state.selectedAt = item.selectedAt;
  state.dirty = item.dirty;
}

function resetHistory() {
  state.history = [];
  state.future = [];
  state.dirty = false;
  resetRecorderSession();
}

function mutate(mutator) {
  state.history.push(snapshot());
  if (state.history.length > 100) state.history.shift();
  state.future = [];
  mutator();
  state.dirty = true;
  renderAll();
}

function beginRecorderSession() {
  if (state.recorder.historyStarted) return;
  state.history.push(snapshot());
  if (state.history.length > 100) state.history.shift();
  state.future = [];
  state.recorder.historyStarted = true;
}

function resetRecorderSession() {
  state.recorder.pointerDown = false;
  state.recorder.historyStarted = false;
  state.recorder.lastAt = -Infinity;
  state.recorder.lastValue = null;
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.future.push(snapshot());
  restoreSnapshot(previous);
  renderAll();
}

function redo() {
  const next = state.future.pop();
  if (!next) return;
  state.history.push(snapshot());
  restoreSnapshot(next);
  renderAll();
}

function ensurePoint(at) {
  const time = clampInt(at, 0, Number.MAX_SAFE_INTEGER);
  let action = findAction(time);
  if (!action) {
    action = { at: time, pos: 0 };
    state.script.actions.push(action);
  }
  let multi = findMultiPoint(time);
  if (!multi) {
    multi = { at: time, commands: [{ action: "SS", qty: String(Math.round(action.pos / 10)) }] };
    state.script.multiAction.timeline.push(multi);
  }
  sortScript();
  state.selectedAt = time;
}

function upsertActionPoint(at, pos) {
  const time = clampInt(at, 0, Number.MAX_SAFE_INTEGER);
  const value = clampInt(pos, 0, 100);
  const existing = findAction(time);
  if (existing) existing.pos = value;
  else state.script.actions.push({ at: time, pos: value });
  sortScript();
  state.selectedAt = time;
}

function upsertMultiCommand(at, action, qty) {
  const time = clampInt(at, 0, Number.MAX_SAFE_INTEGER);
  const value = String(clampInt(qty, 0, 10));
  let point = findMultiPoint(time);
  if (!point) {
    point = { at: time, commands: [] };
    state.script.multiAction.timeline.push(point);
  }

  if (action === "empty") {
    point.commands = [{ action: "empty", qty: "0" }];
  } else {
    point.commands = point.commands.filter((cmd) => cmd.action !== "empty");
    const existing = point.commands.find((cmd) => cmd.action === action);
    if (existing) existing.qty = value;
    else point.commands.push({ action, qty: value });
  }

  if (!point.commands.length) {
    point.commands.push({ action: "empty", qty: "0" });
  }

  sortScript();
  state.selectedAt = time;
}

function writeRecordValue(value, options = {}) {
  const at = currentVideoMs();
  const target = els.recordTarget.value;
  const interval = clampInt(els.recordInterval.value, 40, 1000);
  const normalized = clampInt(value, 0, 100);
  const quantized = target === "actions" ? normalized : Math.round(normalized / 10);
  const force = Boolean(options.force);

  if (!force) {
    if (at - state.recorder.lastAt < interval) return;
    if (state.recorder.lastValue != null && Math.abs(state.recorder.lastValue - quantized) < 1) return;
  }

  beginRecorderSession();
  if (target === "actions") {
    upsertActionPoint(at, normalized);
    upsertMultiCommand(at, "SS", Math.round(normalized / 10));
  } else {
    upsertMultiCommand(at, target, quantized);
    if (target === "SS") {
      upsertActionPoint(at, quantized * 10);
    }
  }

  state.recorder.lastAt = at;
  state.recorder.lastValue = quantized;
  state.dirty = true;
  renderAll();
}

function valueFromRecordPadEvent(event) {
  const rect = els.recordPad.getBoundingClientRect();
  const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
  return Math.round(100 - (y / rect.height) * 100);
}

function updateRecordPadCursor(value) {
  const normalized = clampInt(value, 0, 100);
  els.recordPadCursor.style.top = `${100 - normalized}%`;
  els.recordPad.setAttribute("aria-valuenow", String(normalized));
}

function setRecorderEnabled(enabled) {
  state.recorder.enabled = enabled;
  resetRecorderSession();
  els.recordToggleBtn.textContent = enabled ? "录制开启" : "录制关闭";
  els.recordToggleBtn.classList.toggle("recording", enabled);
}

async function togglePlayback() {
  if (!els.video.currentSrc) {
    setVideoStatus("请先打开视频文件", "error");
    return;
  }
  if (els.video.paused) {
    try {
      await els.video.play();
      setVideoStatus("");
    } catch (error) {
      setVideoStatus(`视频无法播放：${error.message}`, "error");
    }
  } else {
    els.video.pause();
  }
}

function sortScript() {
  state.script.actions.sort((a, b) => a.at - b.at);
  state.script.multiAction.timeline.sort((a, b) => a.at - b.at);
}

function syncMultiFromActions() {
  mutate(() => {
    state.script.multiAction.timeline = state.script.actions.map((point) => ({
      at: point.at,
      commands: [{ action: "SS", qty: String(Math.round(point.pos / 10)) }]
    }));
    if (!state.script.multiAction.version) state.script.multiAction.version = "2.0";
  });
}

function syncActionsFromMulti() {
  mutate(() => {
    state.script.actions = state.script.multiAction.timeline
      .map((point) => {
        const ss = point.commands.find((cmd) => cmd.action === "SS");
        if (!ss) return null;
        return { at: point.at, pos: clampInt(ss.qty, 0, 10) * 10 };
      })
      .filter(Boolean);
    sortScript();
  });
}

function validateScript() {
  const messages = [];
  const actions = state.script.actions;
  const timeline = state.script.multiAction.timeline;
  pushOrderMessages(messages, "actions", actions);
  pushOrderMessages(messages, "multiAction.timeline", timeline);

  for (const point of actions) {
    if (point.pos < 0 || point.pos > 100) {
      messages.push({ type: "error", text: `actions at ${point.at} 的 pos 超出 0-100` });
    }
  }

  for (const point of timeline) {
    for (const cmd of point.commands) {
      const qty = Number(cmd.qty);
      if (!ACTION_TYPES.includes(cmd.action)) {
        messages.push({ type: "error", text: `multiAction at ${point.at} 存在未知动作 ${cmd.action}` });
      }
      if (!Number.isInteger(qty) || qty < 0 || qty > 10) {
        messages.push({ type: "error", text: `multiAction at ${point.at} 的 ${cmd.action} qty 需为 0-10` });
      }
      if (typeof cmd.qty !== "string") {
        messages.push({ type: "warn", text: `multiAction at ${point.at} 的 ${cmd.action} qty 建议保存为字符串` });
      }
    }
  }

  if (actions.length && timeline.length && actions.at(-1).at !== timeline.at(-1).at) {
    messages.push({ type: "warn", text: "actions 与 multiAction.timeline 的结束时间不一致" });
  }

  if (messages.length === 0) {
    messages.push({ type: "ok", text: "脚本结构有效" });
  }
  return messages;
}

function pushOrderMessages(messages, name, points) {
  const seen = new Set();
  let previous = -1;
  for (const point of points) {
    if (point.at < previous) {
      messages.push({ type: "error", text: `${name} 未按 at 升序排列` });
      break;
    }
    if (seen.has(point.at)) {
      messages.push({ type: "warn", text: `${name} 存在重复时间点 ${point.at}` });
    }
    seen.add(point.at);
    previous = point.at;
  }
}

function drawTimeline() {
  const canvas = els.timeline;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const pad = { left: 54, top: 22, right: 22, bottom: 34 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const duration = state.durationMs;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfe";
  ctx.fillRect(0, 0, width, height);

  drawGrid(width, height, pad, plotWidth, plotHeight, duration);

  if (state.mode !== "multi") {
    drawActionsLine(pad, plotWidth, plotHeight, duration);
  }

  if (state.mode !== "actions") {
    drawMultiTracks(pad, plotWidth, plotHeight, duration);
  }

  drawSelectedPoints(pad, plotWidth, plotHeight, duration);
  drawPlayhead(pad, plotWidth, height, duration);
}

function drawGrid(width, height, pad, plotWidth, plotHeight, duration) {
  ctx.strokeStyle = "#e1e7ee";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#667382";
  ctx.font = "12px ui-sans-serif, system-ui";

  const steps = 10;
  for (let i = 0; i <= steps; i += 1) {
    const x = pad.left + (plotWidth * i) / steps;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.fillText(formatTime((duration * i) / steps), x - 20, height - 12);
  }

  ctx.fillText("actions", 8, pad.top + 42);
  ctx.fillText("multi", 8, pad.top + plotHeight * 0.54);
}

function drawActionsLine(pad, plotWidth, plotHeight, duration) {
  const top = pad.top;
  const height = plotHeight * (state.mode === "both" ? 0.42 : 0.9);
  const points = state.script.actions;
  if (!points.length) return;

  ctx.strokeStyle = "#0f8b8d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = pad.left + (point.at / duration) * plotWidth;
    const y = top + height - (point.pos / 100) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  for (const point of points) {
    const x = pad.left + (point.at / duration) * plotWidth;
    const y = top + height - (point.pos / 100) * height;
    ctx.fillStyle = point.at === state.selectedAt ? "#d95d39" : "#0f8b8d";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMultiTracks(pad, plotWidth, plotHeight, duration) {
  const trackTypes = ACTION_TYPES.filter((action) => action !== "empty");
  const top = state.mode === "both" ? pad.top + plotHeight * 0.48 : pad.top;
  const height = state.mode === "both" ? plotHeight * 0.48 : plotHeight * 0.9;
  const rowHeight = height / trackTypes.length;

  ctx.font = "11px ui-sans-serif, system-ui";
  for (let i = 0; i < trackTypes.length; i += 1) {
    const action = trackTypes[i];
    const y = top + rowHeight * i;
    ctx.fillStyle = "#6a7581";
    ctx.fillText(action, 12, y + rowHeight * 0.65);
    ctx.strokeStyle = "#e1e7ee";
    ctx.beginPath();
    ctx.moveTo(pad.left, y + rowHeight);
    ctx.lineTo(pad.left + plotWidth, y + rowHeight);
    ctx.stroke();
  }

  for (const point of state.script.multiAction.timeline) {
    const x = pad.left + (point.at / duration) * plotWidth;
    for (const cmd of point.commands) {
      if (cmd.action === "empty") {
        ctx.fillStyle = point.at === state.selectedAt ? "#d95d39" : "#808a95";
        ctx.fillRect(x - 4, top - 4, 8, 8);
        continue;
      }
      const index = trackTypes.indexOf(cmd.action);
      if (index < 0) continue;
      const qty = clampInt(cmd.qty, 0, 10);
      const rowTop = top + rowHeight * index;
      const barHeight = Math.max(3, (qty / 10) * (rowHeight - 8));
      ctx.fillStyle = point.at === state.selectedAt ? "#d95d39" : "#356fbd";
      ctx.fillRect(x - 4, rowTop + rowHeight - barHeight - 3, 8, barHeight);
    }
  }
}

function drawSelectedPoints(pad, plotWidth, plotHeight, duration) {
  if (state.selectedAt == null) return;
  const x = pad.left + (state.selectedAt / duration) * plotWidth;
  ctx.strokeStyle = "#d95d39";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, pad.top);
  ctx.lineTo(x, pad.top + plotHeight);
  ctx.stroke();
}

function drawPlayhead(pad, plotWidth, height, duration) {
  const x = pad.left + (currentVideoMs() / duration) * plotWidth;
  ctx.strokeStyle = "#17202a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height - pad.bottom);
  ctx.stroke();
}

function renderEditor() {
  if (state.selectedAt == null) {
    els.emptySelection.classList.remove("hidden");
    els.pointEditor.classList.add("hidden");
    return;
  }
  const action = findAction(state.selectedAt) || { at: state.selectedAt, pos: 0 };
  const multi = findMultiPoint(state.selectedAt) || { at: state.selectedAt, commands: [{ action: "empty", qty: "0" }] };
  els.emptySelection.classList.add("hidden");
  els.pointEditor.classList.remove("hidden");
  els.atInput.value = String(state.selectedAt);
  els.posInput.value = String(action.pos);
  els.commandsList.innerHTML = "";
  multi.commands.forEach((cmd, index) => {
    els.commandsList.appendChild(createCommandRow(cmd, index));
  });
}

function createCommandRow(cmd, index) {
  const row = document.createElement("div");
  row.className = "command-row";
  row.dataset.index = String(index);

  const select = document.createElement("select");
  for (const action of ACTION_TYPES) {
    const option = document.createElement("option");
    option.value = action;
    option.textContent = ACTION_LABELS[action];
    option.selected = action === cmd.action;
    select.appendChild(option);
  }

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "10";
  input.step = "1";
  input.value = String(clampInt(cmd.qty, 0, 10));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "删除动作";
  remove.addEventListener("click", () => {
    row.remove();
  });

  row.append(select, input, remove);
  return row;
}

function readEditorCommands() {
  const rows = Array.from(els.commandsList.querySelectorAll(".command-row"));
  if (!rows.length) return [{ action: "empty", qty: "0" }];
  return rows.map((row) => {
    const [select, input] = row.querySelectorAll("select, input");
    return {
      action: select.value,
      qty: String(clampInt(input.value, 0, 10))
    };
  });
}

function saveSelectedPoint() {
  if (state.selectedAt == null) return;
  mutate(() => {
    const oldAt = state.selectedAt;
    const nextAt = clampInt(els.atInput.value, 0, Number.MAX_SAFE_INTEGER);
    const pos = clampInt(els.posInput.value, 0, 100);
    const commands = normalizeCommands(readEditorCommands());

    state.script.actions = state.script.actions.filter((point) => point.at !== oldAt && point.at !== nextAt);
    state.script.actions.push({ at: nextAt, pos });

    state.script.multiAction.timeline = state.script.multiAction.timeline
      .filter((point) => point.at !== oldAt && point.at !== nextAt);
    state.script.multiAction.timeline.push({ at: nextAt, commands });

    state.selectedAt = nextAt;
    sortScript();
  });
}

function deleteSelectedPoint() {
  if (state.selectedAt == null) return;
  mutate(() => {
    const at = state.selectedAt;
    state.script.actions = state.script.actions.filter((point) => point.at !== at);
    state.script.multiAction.timeline = state.script.multiAction.timeline.filter((point) => point.at !== at);
    state.selectedAt = null;
  });
}

function isEditingText(event) {
  const tagName = event.target?.tagName;
  return tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA" || event.target?.isContentEditable;
}

function handleKeyboard(event) {
  const key = event.key.toLowerCase();
  const hasModifier = event.metaKey || event.ctrlKey;

  if (hasModifier && key === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }

  if (hasModifier && key === "y") {
    event.preventDefault();
    redo();
    return;
  }

  if (isEditingText(event)) return;

  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    const value = event.key === "0" ? 100 : Number(event.key) * 10;
    updateRecordPadCursor(value);
    writeRecordValue(value, { force: true });
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    if (state.selectedAt != null) {
      event.preventDefault();
      deleteSelectedPoint();
    }
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    togglePlayback();
  }
}

function renderValidation() {
  els.validationList.innerHTML = "";
  for (const message of validateScript()) {
    const item = document.createElement("div");
    item.className = `validation-item ${message.type === "ok" ? "" : message.type}`;
    item.textContent = message.text;
    els.validationList.appendChild(item);
  }
}

function renderSummary() {
  const actionCount = state.script.actions.length;
  const multiCount = state.script.multiAction.timeline.length;
  const used = new Set();
  for (const point of state.script.multiAction.timeline) {
    for (const cmd of point.commands) used.add(cmd.action);
  }
  els.scriptSummary.textContent = `${state.fileName} · actions ${actionCount} · multiAction ${multiCount} · ${formatTime(state.durationMs)} · ${Array.from(used).join("/") || "无动作"}`;
}

function renderPreview() {
  if (state.selectedAt == null) {
    els.jsonPreview.textContent = JSON.stringify({
      actions: state.script.actions.length,
      multiAction: state.script.multiAction.timeline.length
    }, null, 2);
    return;
  }
  els.jsonPreview.textContent = JSON.stringify({
    action: findAction(state.selectedAt) || null,
    multiAction: findMultiPoint(state.selectedAt) || null
  }, null, 2);
}

function renderAll() {
  state.durationMs = getScriptDuration();
  els.currentTime.textContent = formatTime(currentVideoMs());
  els.durationTime.textContent = formatTime(state.durationMs);
  updateVideoDebug();
  els.undoBtn.disabled = state.history.length === 0;
  els.redoBtn.disabled = state.future.length === 0;
  els.dirtyStatus.textContent = state.dirty ? "未保存" : "已保存";
  els.dirtyStatus.classList.toggle("dirty", state.dirty);
  renderSummary();
  renderEditor();
  renderValidation();
  renderPreview();
  drawTimeline();
}

async function loadScriptFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  state.fileName = file.name;
  state.script = normalizeScript(parsed);
  state.selectedAt = collectTimes()[0] ?? null;
  resetHistory();
  renderAll();
}

function loadVideoFile(file) {
  if (state.videoObjectUrl) {
    URL.revokeObjectURL(state.videoObjectUrl);
  }
  const url = URL.createObjectURL(file);
  state.videoObjectUrl = url;
  els.video.pause();
  els.video.src = url;
  els.video.currentTime = 0;
  els.dropHint.classList.add("hidden");
  setVideoStatus(`正在加载视频：${file.name}`);
  updateVideoDebug(`file=${file.name}`);
  els.video.load();
  els.video.addEventListener("loadedmetadata", () => {
    setVideoStatus(`已加载：${file.name}`);
    updateVideoDebug(`file=${file.name}`);
    renderAll();
  }, { once: true });
  els.video.addEventListener("loadeddata", () => {
    if (hasDecodedVideoFrame()) setVideoStatus("");
    else checkVideoFrameAvailability();
    updateVideoDebug(`file=${file.name}`);
    renderAll();
  }, { once: true });
  els.video.addEventListener("canplay", () => {
    checkVideoFrameAvailability();
    updateVideoDebug(`file=${file.name}`);
  }, { once: true });
}

function exportScript() {
  sortScript();
  const output = JSON.stringify(state.script, null, 2);
  const blob = new Blob([output], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.fileName.endsWith(".funscript") ? state.fileName : `${state.fileName}.funscript`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  state.dirty = false;
  renderAll();
}

function selectNearestPoint(offsetX) {
  const rect = els.timeline.getBoundingClientRect();
  const padLeft = 54;
  const padRight = 22;
  const plotWidth = rect.width - padLeft - padRight;
  const targetAt = ((offsetX - padLeft) / plotWidth) * state.durationMs;
  const times = collectTimes();
  if (!times.length) return;
  let nearest = times[0];
  let nearestDistance = Math.abs(nearest - targetAt);
  for (const time of times) {
    const distance = Math.abs(time - targetAt);
    if (distance < nearestDistance) {
      nearest = time;
      nearestDistance = distance;
    }
  }
  state.selectedAt = nearest;
  if (nearestDistance > state.durationMs * 0.015) {
    mutate(() => {
      ensurePoint(clampInt(targetAt, 0, Number.MAX_SAFE_INTEGER));
    });
    return;
  }
  renderAll();
}

els.videoInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) loadVideoFile(file);
});

els.scriptInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await loadScriptFile(file);
  } catch (error) {
    alert(`脚本解析失败：${error.message}`);
  }
});

els.newScriptBtn.addEventListener("click", () => {
  mutate(() => {
    state.fileName = "untitled.funscript";
    state.script = createEmptyScript();
    state.selectedAt = null;
  });
});

els.undoBtn.addEventListener("click", undo);
els.redoBtn.addEventListener("click", redo);
els.exportBtn.addEventListener("click", exportScript);
els.playBtn.addEventListener("click", togglePlayback);
els.addPointBtn.addEventListener("click", () => {
  mutate(() => {
    ensurePoint(currentVideoMs());
  });
});
els.syncFromActionsBtn.addEventListener("click", syncMultiFromActions);
els.syncFromMultiBtn.addEventListener("click", syncActionsFromMulti);
els.addCommandBtn.addEventListener("click", () => {
  els.commandsList.appendChild(createCommandRow({ action: "SS", qty: "5" }, els.commandsList.children.length));
});
els.savePointBtn.addEventListener("click", saveSelectedPoint);
els.deletePointBtn.addEventListener("click", deleteSelectedPoint);
els.recordToggleBtn.addEventListener("click", () => {
  setRecorderEnabled(!state.recorder.enabled);
});
els.recordPad.addEventListener("pointerdown", (event) => {
  state.recorder.pointerDown = true;
  els.recordPad.setPointerCapture(event.pointerId);
  const value = valueFromRecordPadEvent(event);
  updateRecordPadCursor(value);
  writeRecordValue(value, { force: true });
});
els.recordPad.addEventListener("pointermove", (event) => {
  const value = valueFromRecordPadEvent(event);
  updateRecordPadCursor(value);
  if (!state.recorder.enabled && !state.recorder.pointerDown) return;
  writeRecordValue(value);
});
els.recordPad.addEventListener("pointerup", (event) => {
  state.recorder.pointerDown = false;
  resetRecorderSession();
  els.recordPad.releasePointerCapture(event.pointerId);
});
els.recordPad.addEventListener("pointercancel", () => {
  resetRecorderSession();
});
els.stampButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = clampInt(button.dataset.stamp, 0, 100);
    updateRecordPadCursor(value);
    mutate(() => {
      const target = els.recordTarget.value;
      if (target === "actions") {
        upsertActionPoint(currentVideoMs(), value);
        upsertMultiCommand(currentVideoMs(), "SS", Math.round(value / 10));
      } else {
        upsertMultiCommand(currentVideoMs(), target, Math.round(value / 10));
        if (target === "SS") {
          upsertActionPoint(currentVideoMs(), Math.round(value / 10) * 10);
        }
      }
    });
  });
});

els.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    els.modeButtons.forEach((item) => item.classList.toggle("active", item === button));
    drawTimeline();
  });
});

els.timeline.addEventListener("click", (event) => {
  const rect = els.timeline.getBoundingClientRect();
  selectNearestPoint(event.clientX - rect.left);
});

els.video.addEventListener("timeupdate", renderAll);
els.video.addEventListener("durationchange", renderAll);
els.video.addEventListener("loadedmetadata", () => {
  updateVideoDebug();
});
els.video.addEventListener("loadeddata", () => {
  checkVideoFrameAvailability();
  updateVideoDebug();
});
els.video.addEventListener("canplay", () => {
  checkVideoFrameAvailability();
  updateVideoDebug();
});
els.video.addEventListener("playing", () => {
  if (hasDecodedVideoFrame()) setVideoStatus("");
  else checkVideoFrameAvailability();
  updateVideoDebug();
});
els.video.addEventListener("error", () => {
  const mediaError = els.video.error;
  const code = mediaError?.code;
  const messageByCode = {
    1: "视频加载被中止",
    2: "网络或本地读取失败",
    3: "视频解码失败，可能是编码格式不受浏览器支持",
    4: "视频格式不受浏览器支持"
  };
  setVideoStatus(messageByCode[code] || "视频无法加载", "error");
  updateVideoDebug(`error=${code || "unknown"}`);
});
window.addEventListener("keydown", handleKeyboard);
window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("resize", drawTimeline);

renderAll();
