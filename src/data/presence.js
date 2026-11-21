/*
 * PLANNED FEATURE (Feature Track F-038 to F-044): online presence and active/idle tracking.
 *
 * None of this exists in the database yet. It mirrors the tables designed for the feature:
 *   ActivitySegment   (userId, state ACTIVE | IDLE | HIDDEN, startAt, endAt)  -> raw state changes
 *   UserDailyActivity (userId, day, activeSec, idleSec, hiddenSec, firstSeenAt, lastSeenAt)
 *   PresenceSnapshot  (at, orgType, orgId, scope, onlineCount, activeCount)  -> every 5 minutes
 *   OrgDailyPresence  (day, orgType, orgId, scope, totalUsers, uniqueActive, peakConcurrent, peakAt)
 *
 * Rules used here (agreed in planning):
 *   - A day runs midnight to midnight, India time (Asia/Kolkata).
 *   - ACTIVE = visible tab with an interaction in the last 5 minutes, or a video playing.
 *   - IDLE   = visible tab, no interaction for 5+ minutes (counted from the last interaction).
 *   - HIDDEN = another tab or app in front.
 *   - OFFLINE = no heartbeat.
 */
import * as db from "./db";

export const IDLE_THRESHOLD_MIN = 5;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const IST_OFFSET = 330 * MIN;
export const NOW = db.TODAY.getTime();

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(5_000_021);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

export const dayKeyOf = (ms) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10);
export const dayStart = (key) => Date.parse(`${key}T00:00:00+05:30`);
export const TODAY_KEY = dayKeyOf(NOW);

/** Last 14 IST days, newest first. */
export const PRESENCE_DAYS = Array.from({ length: 14 }, (_, i) => dayKeyOf(NOW - i * DAY));
export const dayLabel = (key) => {
  if (key === TODAY_KEY) return "Today";
  if (key === PRESENCE_DAYS[1]) return "Yesterday";
  return new Date(dayStart(key)).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short" });
};

/* ---------- ActivitySegment rows (sample) ---------- */

/** userId -> [{ day, startAt, endAt, state }] */
export const segmentsByUser = new Map();

function addSegments(userId, isInstructor) {
  const rows = [];
  PRESENCE_DAYS.forEach((key) => {
    const weekday = new Date(dayStart(key) + 12 * 60 * MIN).getUTCDay(); // 0 = Sunday
    const pOnline = isInstructor ? (weekday === 0 ? 0.15 : 0.85) : weekday === 0 ? 0.12 : weekday === 6 ? 0.45 : 0.6;
    if (rand() > pOnline) return;
    const sessions = isInstructor ? int(1, 3) : int(1, 2);
    for (let s = 0; s < sessions; s += 1) {
      // Students: school lab hours or evening homework. Instructors: working hours.
      const startHour = isInstructor
        ? 8.5 + rand() * 8
        : rand() < 0.6
          ? 9 + rand() * 4
          : 16 + rand() * 5;
      let t = dayStart(key) + Math.round(startHour * 60) * MIN;
      const end = t + int(15, isInstructor ? 150 : 100) * MIN;
      let prev = null;
      while (t < end) {
        let state = rand() < 0.62 ? "ACTIVE" : rand() < 0.55 ? "IDLE" : "HIDDEN";
        if (state === prev) state = "ACTIVE";
        if (prev === null) state = "ACTIVE"; // a session starts with an interaction
        const length =
          state === "ACTIVE" ? int(4, 25) : state === "IDLE" ? int(IDLE_THRESHOLD_MIN, 15) : int(2, 18);
        const segEnd = Math.min(t + length * MIN, end);
        if (t >= NOW) break;
        rows.push({ day: key, startAt: t, endAt: Math.min(segEnd, NOW), state, open: segEnd > NOW });
        t = segEnd;
        prev = state;
      }
    }
  });
  segmentsByUser.set(userId, rows);
}
db.students.forEach((s) => addSegments(s.id, false));
db.instructors.forEach((i) => addSegments(i.id, true));

/* ---------- people in a scope ---------- */

export function peopleInScope(scope, role) {
  let instituteIds;
  if (scope.type === "platform") instituteIds = new Set(db.institutes.map((i) => i.id));
  else if (scope.type === "department")
    instituteIds = new Set(db.assignedDepartment.filter((a) => a.departmentId === scope.id).map((a) => a.instituteId));
  else instituteIds = new Set([scope.id]);

  const students =
    role === "INSTRUCTOR"
      ? []
      : db.assignedStudent.filter((a) => instituteIds.has(a.instituteId)).map((a) => ({ userId: a.studentId, role: "STUDENT", instituteId: a.instituteId }));
  const seen = new Set();
  const instructors =
    role === "STUDENT"
      ? []
      : db.assignedInstructor
          .filter((a) => instituteIds.has(a.instituteId))
          .filter((a) => (seen.has(a.instructorId) ? false : seen.add(a.instructorId)))
          .map((a) => ({ userId: a.instructorId, role: "INSTRUCTOR", instituteId: a.instituteId }));
  return [...students, ...instructors];
}

/* ---------- one day for a group of people ---------- */

const SLOT = 5 * MIN; // PresenceSnapshot interval
const SLOTS = 24 * 12;

/**
 * Everything the presence screens need for one day:
 * totals, online now, unique active, exact peak, 5-minute series and per-person rows.
 */
export function summarizeDay(people, dayKey) {
  const start = dayStart(dayKey);
  const isToday = dayKey === TODAY_KEY;
  const online = new Array(SLOTS).fill(0);
  const active = new Array(SLOTS).fill(0);
  const perPerson = [];
  let onlineNow = 0;
  let activeNow = 0;

  people.forEach((p) => {
    const segs = (segmentsByUser.get(p.userId) || []).filter((s) => s.day === dayKey);
    const row = { ...p, activeSec: 0, idleSec: 0, hiddenSec: 0, firstSeenAt: null, lastSeenAt: null, stateNow: "OFFLINE" };
    segs.forEach((s) => {
      const sec = (s.endAt - s.startAt) / 1000;
      if (s.state === "ACTIVE") row.activeSec += sec;
      else if (s.state === "IDLE") row.idleSec += sec;
      else row.hiddenSec += sec;
      row.firstSeenAt = row.firstSeenAt === null ? s.startAt : Math.min(row.firstSeenAt, s.startAt);
      row.lastSeenAt = row.lastSeenAt === null ? s.endAt : Math.max(row.lastSeenAt, s.endAt);
      const from = Math.max(0, Math.ceil((s.startAt - start) / SLOT));
      const to = Math.min(SLOTS - 1, Math.floor((s.endAt - 1 - start) / SLOT));
      for (let i = from; i <= to; i += 1) {
        online[i] += 1;
        if (s.state === "ACTIVE") active[i] += 1;
      }
      if (isToday && s.open) row.stateNow = s.state;
    });
    if (row.stateNow !== "OFFLINE") {
      onlineNow += 1;
      if (row.stateNow === "ACTIVE") activeNow += 1;
    }
    perPerson.push(row);
  });

  const lastSlot = isToday ? Math.floor((NOW - start) / SLOT) : SLOTS - 1;
  let peak = 0;
  let peakAt = null;
  for (let i = 0; i <= lastSlot; i += 1) {
    if (online[i] > peak) {
      peak = online[i];
      peakAt = start + i * SLOT;
    }
  }
  const series = [];
  for (let i = 6 * 12; i < 22 * 12; i += 1) {
    const at = start + i * SLOT;
    series.push({
      at,
      time: new Date(at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
      online: i <= lastSlot ? online[i] : null,
      active: i <= lastSlot ? active[i] : null,
    });
  }
  const seenToday = perPerson.filter((r) => r.firstSeenAt !== null);
  const sum = (k) => perPerson.reduce((t, r) => t + r[k], 0);
  return {
    isToday,
    total: people.length,
    totalStudents: people.filter((p) => p.role === "STUDENT").length,
    totalInstructors: people.filter((p) => p.role === "INSTRUCTOR").length,
    onlineNow,
    activeNow,
    idleNow: perPerson.filter((r) => r.stateNow === "IDLE").length,
    hiddenNow: perPerson.filter((r) => r.stateNow === "HIDDEN").length,
    uniqueActive: seenToday.length,
    uniqueStudents: seenToday.filter((r) => r.role === "STUDENT").length,
    uniqueInstructors: seenToday.filter((r) => r.role === "INSTRUCTOR").length,
    peak,
    peakAt,
    activeSec: sum("activeSec"),
    idleSec: sum("idleSec"),
    hiddenSec: sum("hiddenSec"),
    series,
    perPerson,
  };
}

/** Per-day active / idle / hidden seconds for one person (UserDailyActivity rows). */
export function dailyActivityOf(userId, days = 7) {
  return PRESENCE_DAYS.slice(0, days)
    .reverse()
    .map((key) => {
      const segs = (segmentsByUser.get(userId) || []).filter((s) => s.day === key);
      const total = (state) => segs.filter((s) => s.state === state).reduce((t, s) => t + (s.endAt - s.startAt) / 1000, 0);
      return { day: key, label: dayLabel(key), activeSec: total("ACTIVE"), idleSec: total("IDLE"), hiddenSec: total("HIDDEN") };
    });
}
