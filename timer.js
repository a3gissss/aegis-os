import { makeId, dateKey } from "./utils.js";

// A focus/break study timer. Every finished focus block is logged
// as a session, so you can see how much you studied today.
const TIMER_KEY = "aegis.timer";
const SESSIONS_KEY = "aegis.sessions";

const MODES = {
  focus: { label: "Focus", minutes: 25 },
  break: { label: "Break", minutes: 5 },
};

const display = document.getElementById("timer-display");
const fill = document.getElementById("timer-fill");
const subjectInput = document.getElementById("study-subject");
const startBtn = document.getElementById("timer-start");
const resetBtn = document.getElementById("timer-reset");
const modeButtons = document.querySelectorAll(".mode");
const summary = document.getElementById("session-summary");
const sessionList = document.getElementById("session-list");

// Timer state: { mode, running, endsAt, remaining, subject }
// While running we store endsAt (the clock time it finishes), not a
// countdown number. setInterval isn't exact, and browsers slow it down
// in background tabs, so we always work out the time left from the clock.
let timer = loadTimer();

// Each session: { id, subject, minutes, date: "2026-11-04", endedAt }
let sessions = loadSessions();

let ticker = null;
let audio = null;

function fullLength(mode) {
  return MODES[mode].minutes * 60 * 1000;
}

function freshTimer(mode) {
  return { mode, running: false, endsAt: null, remaining: fullLength(mode), subject: "" };
}

function loadTimer() {
  try {
    const saved = JSON.parse(localStorage.getItem(TIMER_KEY));
    // SECURITY: Object.hasOwn, not MODES[saved.mode]. A tampered value like
    // "constructor" would pass MODES[...] because every object inherits it.
    if (saved && Object.hasOwn(MODES, saved.mode) && typeof saved.remaining === "number") {
      return saved;
    }
  } catch {
    // fall through to a fresh timer
  }
  return freshTimer("focus");
}

function saveTimer() {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
}

function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSIONS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function timeLeft() {
  return timer.running ? Math.max(0, timer.endsAt - Date.now()) : timer.remaining;
}

// 83000 ms -> "01:23"
function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// A short beep using the Web Audio API (no sound file needed)
function beep() {
  try {
    if (!audio) return; // browsers only allow sound after you've clicked something
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.8);
  } catch {
    // sound is a nice-to-have; never let it break the timer
  }
}

function start() {
  audio = audio || new AudioContext(); // created on a click, so sound is allowed
  timer.running = true;
  timer.endsAt = Date.now() + timer.remaining;
  timer.subject = subjectInput.value.trim();
  saveTimer();
  startTicking();
  renderTimer();
}

function pause() {
  timer.remaining = timeLeft();
  timer.running = false;
  timer.endsAt = null;
  saveTimer();
  stopTicking();
  renderTimer();
}

function reset() {
  stopTicking();
  timer = freshTimer(timer.mode);
  saveTimer();
  renderTimer();
}

function setMode(mode) {
  stopTicking();
  timer = freshTimer(mode);
  saveTimer();
  renderTimer();
}

// Called when the countdown reaches zero
function finish() {
  stopTicking();
  beep();

  if (timer.mode === "focus") {
    sessions.push({
      id: makeId(),
      subject: timer.subject,
      minutes: MODES.focus.minutes,
      date: dateKey(new Date(timer.endsAt)),
      endedAt: timer.endsAt,
    });
    saveSessions();
    renderSessions();
  }

  // Focus is followed by a break, and a break by focus
  setMode(timer.mode === "focus" ? "break" : "focus");
}

function startTicking() {
  stopTicking();
  ticker = setInterval(() => {
    if (timeLeft() === 0) finish();
    else renderTimer();
  }, 250);
}

function stopTicking() {
  clearInterval(ticker);
  ticker = null;
}

function renderTimer() {
  const left = timeLeft();
  const full = fullLength(timer.mode);

  display.textContent = formatTime(left);
  fill.style.width = `${((full - left) / full) * 100}%`;

  for (const btn of modeButtons) {
    btn.classList.toggle("active", btn.dataset.mode === timer.mode);
  }

  if (timer.running) startBtn.textContent = "Pause";
  else if (left < full) startBtn.textContent = "Resume";
  else startBtn.textContent = "Start";

  // Lock the subject while a session runs, since it's already been recorded
  subjectInput.disabled = timer.running;

  // Show the countdown in the browser tab title, so you see it from other tabs
  document.title = timer.running
    ? `${formatTime(left)} · ${MODES[timer.mode].label} — Aegis OS`
    : "Aegis OS";
}

function renderSessions() {
  sessionList.replaceChildren();
  const today = sessions.filter((s) => s.date === dateKey(new Date()));
  const minutes = today.reduce((sum, s) => sum + s.minutes, 0);

  summary.textContent = today.length === 0
    ? "No study sessions yet today. Start a focus block above."
    : `${today.length} session${today.length === 1 ? "" : "s"} · ${minutes} min studied`;

  // Newest first
  for (const session of [...today].reverse()) {
    const li = document.createElement("li");
    li.className = "session";

    // SECURITY: textContent, never innerHTML (XSS)
    const subject = document.createElement("span");
    subject.textContent = session.subject || "Focus session";

    const meta = document.createElement("small");
    const time = new Date(session.endedAt).toLocaleTimeString(
      undefined, { hour: "2-digit", minute: "2-digit" }
    );
    meta.textContent = `${session.minutes} min · ${time}`;

    li.append(subject, meta);
    sessionList.append(li);
  }
}

startBtn.addEventListener("click", () => (timer.running ? pause() : start()));
resetBtn.addEventListener("click", reset);
for (const btn of modeButtons) {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
}

// On page load: pick up where we left off. If the timer ran out while
// the page was closed, count that session now.
subjectInput.value = timer.subject;
if (timer.running && timeLeft() === 0) finish();
else if (timer.running) startTicking();
renderTimer();
renderSessions();
