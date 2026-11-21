import * as db from "./db";

/* ---------- formatting ---------- */

export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
export const fmtPct = (part, whole) => `${pct(part, whole)}%`;
export const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN");
export const fmtINR = (n) => `₹${fmtNum(Math.round(n))}`;
const IST = { timeZone: "Asia/Kolkata" };
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { ...IST, day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { ...IST, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
export const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-IN", { ...IST, hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtDuration = (seconds) => {
  const totalMinutes = Math.round((seconds || 0) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};
// Month in India time, e.g. "2026-11".
export const monthKey = (d) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 7);
export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
export const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

/* ---------- lookups ---------- */

const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
export const userById = byId([...db.students, ...db.instructors, ...db.institutes, ...db.departments]);
export const courseById = byId(db.courses);
export const classById = byId(db.classes);
export const blockzieUserById = byId(db.blockzieUsers);
export const scheduleById = byId(db.schedule);

export const instituteIdOfStudent = new Map(db.assignedStudent.map((a) => [a.studentId, a.instituteId]));
export const classIdOfStudent = new Map(db.assignedClass.map((a) => [a.studentId, a.classId]));
export const departmentIdOfInstitute = new Map(db.assignedDepartment.map((a) => [a.instituteId, a.departmentId]));

export const institutesOfDepartment = (departmentId) =>
  db.assignedDepartment.filter((a) => a.departmentId === departmentId).map((a) => userById.get(a.instituteId));
export const institutesOfInstructor = (instructorId) =>
  db.assignedInstructor.filter((a) => a.instructorId === instructorId).map((a) => userById.get(a.instituteId));
export const instructorsOfInstitute = (instituteId) =>
  db.assignedInstructor.filter((a) => a.instituteId === instituteId).map((a) => userById.get(a.instructorId));
export const studentsOfInstitute = (instituteId) =>
  db.assignedStudent.filter((a) => a.instituteId === instituteId).map((a) => userById.get(a.studentId));

const lastLogin = new Map();
const loginsByUser = new Map();
db.loginLogs.forEach((l) => {
  if (!lastLogin.has(l.userId) || lastLogin.get(l.userId) < l.loginTime) lastLogin.set(l.userId, l.loginTime);
  if (!loginsByUser.has(l.userId)) loginsByUser.set(l.userId, []);
  loginsByUser.get(l.userId).push(l);
});
export const lastLoginOf = (userId) => lastLogin.get(userId);
export const loginsOf = (userId) => loginsByUser.get(userId) || [];

/* ---------- enrollments (AssignedCourses rows with a userId) ---------- */

const lessonsDone = new Map();
const lastLessonAt = new Map();
db.completeCurriculum.forEach((c) => {
  const key = `${c.userId}|${c.courseId}`;
  lessonsDone.set(key, (lessonsDone.get(key) || 0) + 1);
  if (!lastLessonAt.has(key) || lastLessonAt.get(key) < c.date) lastLessonAt.set(key, c.date);
});
const quizAgg = new Map();
db.quizScore.forEach((q) => {
  const key = `${q.userId}|${q.courseId}`;
  const cur = quizAgg.get(key) || { score: 0, total: 0 };
  cur.score += q.score;
  cur.total += q.totalQue;
  quizAgg.set(key, cur);
});
const certByKey = new Map(db.certificate.map((c) => [`${c.userId}|${c.courseId}`, c]));
const ratingByKey = new Map(db.feedback.map((f) => [`${f.userId}|${f.courseId}`, f.rating]));
const pendingTestByKey = new Map();
db.courseTestSubmission.forEach((t) => {
  if (t.status === "Pending") pendingTestByKey.set(`${t.userId}|${t.courseId}`, t);
});

export const enrollments = db.assignedCourses
  .filter((a) => a.userId)
  .map((a) => {
    const key = `${a.userId}|${a.courseId}`;
    const course = courseById.get(a.courseId);
    const done = lessonsDone.get(key) || 0;
    const quiz = quizAgg.get(key);
    const cert = certByKey.get(key);
    const status = cert ? "Completed" : done > 0 ? "In Progress" : "Not Started";
    return {
      ...a,
      course,
      student: userById.get(a.userId),
      lessonsDone: done,
      lessonCount: course.lessonCount,
      lastLessonDate: lastLessonAt.get(key) || null,
      quizScore: quiz?.score || 0,
      quizTotal: quiz?.total || 0,
      certificate: cert || null,
      rating: ratingByKey.get(key) || null,
      pendingTest: pendingTestByKey.has(key),
      status,
      departmentId: departmentIdOfInstitute.get(a.instituteId),
    };
  });

export function summarizeEnrollments(rows) {
  const students = new Set(rows.map((r) => r.userId));
  const completed = rows.filter((r) => r.status === "Completed").length;
  const inProgress = rows.filter((r) => r.status === "In Progress").length;
  const notStarted = rows.filter((r) => r.status === "Not Started").length;
  const quizScore = rows.reduce((s, r) => s + r.quizScore, 0);
  const quizTotal = rows.reduce((s, r) => s + r.quizTotal, 0);
  const ratings = rows.filter((r) => r.rating);
  return {
    enrollments: rows.length,
    students: students.size,
    completed,
    inProgress,
    notStarted,
    completionRate: pct(completed, rows.length),
    avgQuiz: pct(quizScore, quizTotal),
    avgRating: ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : "—",
    ratingsCount: ratings.length,
    pendingTests: rows.filter((r) => r.pendingTest).length,
    lessonsDone: rows.reduce((s, r) => s + r.lessonsDone, 0),
  };
}

export function byCourse(rows) {
  return db.courses
    .map((course) => {
      const s = summarizeEnrollments(rows.filter((r) => r.courseId === course.id));
      return { id: course.id, name: course.title, ...s };
    })
    .filter((c) => c.enrollments > 0);
}

export function monthlyTrend(rows, extra = {}) {
  return MONTHS.map((m) => {
    const point = {
      period: monthLabel(m),
      enrollments: rows.filter((r) => monthKey(r.assignedDate) === m).length,
      certificates: rows.filter((r) => r.certificate && monthKey(r.certificate.completedDate) === m).length,
    };
    Object.entries(extra).forEach(([k, fn]) => {
      point[k] = fn(m);
    });
    return point;
  });
}

/* ---------- trainers at schools ---------- */

const checkInBySchedule = new Map(db.checkInOutLog.map((c) => [c.scheduleId, c]));
const worklogBySchedule = new Map(db.worklogs.map((w) => [w.scheduleId, w]));
const attendanceBySchedule = new Map();
db.attendanceLogs.forEach((a) => attendanceBySchedule.set(a.scheduleId, (attendanceBySchedule.get(a.scheduleId) || 0) + 1));

/** Schedule rows joined with their check-in, work log and attendance count. */
export const sessions = db.schedule
  .filter((s) => new Date(`${s.startDate}T${s.startTime}:00+05:30`) <= db.TODAY)
  .map((s) => {
    const start = new Date(`${s.startDate}T${s.startTime}:00+05:30`);
    const checkIn = checkInBySchedule.get(s.id) || null;
    const minutesLate = checkIn ? Math.round((new Date(checkIn.checkInTime) - start) / 60000) : null;
    const className = s.title.replace(" lab session", "");
    const cls = db.classes.find((c) => c.instituteId === s.instituteId && c.className === className);
    return {
      ...s,
      start,
      checkIn,
      held: !!checkIn,
      onTime: checkIn ? minutesLate <= 10 : false,
      minutesLate,
      worklog: worklogBySchedule.get(s.id) || null,
      present: attendanceBySchedule.get(s.id) || 0,
      classSize: cls?.noOfStudent || 0,
    };
  });

export function summarizeSessions(rows) {
  const held = rows.filter((r) => r.held);
  const present = held.reduce((s, r) => s + r.present, 0);
  const expected = held.reduce((s, r) => s + r.classSize, 0);
  return {
    scheduled: rows.length,
    held: held.length,
    heldRate: pct(held.length, rows.length),
    onTimeRate: pct(held.filter((r) => r.onTime).length, held.length),
    worklogs: held.filter((r) => r.worklog).length,
    worklogRate: pct(held.filter((r) => r.worklog).length, held.length),
    attendanceRate: pct(present, expected),
  };
}

export const studentAttendance = (studentId) => {
  const cls = classIdOfStudent.get(studentId);
  const instituteId = instituteIdOfStudent.get(studentId);
  const className = classById.get(cls)?.className;
  const held = sessions.filter((s) => s.held && s.instituteId === instituteId && s.title.startsWith(className));
  const present = db.attendanceLogs.filter((a) => a.studentId === studentId).length;
  return { held: held.length, present, rate: pct(present, held.length) };
};

/* ---------- Blockzie (linked through keycloak_id) ---------- */

const blockzieIdByStudent = new Map();
db.blockzieUsers.forEach((bu) => {
  const lms = db.students.find((s) => s.keycloak_id === bu.keycloak_id);
  if (lms) blockzieIdByStudent.set(lms.id, bu.id);
});
export const blockzieIdOf = (studentId) => blockzieIdByStudent.get(studentId) || null;
const lmsIdByBlockzie = new Map([...blockzieIdByStudent].map(([lms, bz]) => [bz, lms]));
export const lmsStudentOfBlockzie = (blockzieUserId) => userById.get(lmsIdByBlockzie.get(blockzieUserId));

export const transportLabel = (t) => {
  const v = (t || "").toLowerCase();
  if (["ble", "bluetooth", "bluetooth-ble"].includes(v)) return "BLE";
  if (["wifi", "wi-fi"].includes(v)) return "Wi-Fi";
  if (v === "serial") return "Serial";
  return "Other";
};
export const platformLabel = (p) => {
  const v = (p || "").toLowerCase();
  if (v === "web") return "Web";
  if (v.startsWith("windows")) return "Windows";
  if (v.startsWith("macos")) return "macOS";
  if (v.startsWith("linux")) return "Linux";
  return "Unknown";
};
export const sessionSeconds = (s) =>
  s.durationSeconds ?? Math.max(0, ((s.disconnectedAt ? new Date(s.disconnectedAt) : db.TODAY) - new Date(s.connectedAt)) / 1000);

/** Blockzie rows for a set of LMS student ids. */
export function blockzieFor(studentIds) {
  const ids = new Set(studentIds.map((id) => blockzieIdOf(id)).filter(Boolean));
  const devices = db.bluetoothSessions.filter((s) => ids.has(s.userId));
  const projects = db.blockzieProject.filter((p) => ids.has(p.userId) && !p.isDeleted);
  const logins = db.blockzieLoginSessions.filter((s) => ids.has(s.userId));
  return {
    linked: ids.size,
    devices,
    projects,
    logins,
    deviceSeconds: devices.reduce((s, d) => s + sessionSeconds(d), 0),
    creators: new Set(projects.map((p) => p.userId)).size,
    activeNow: devices.filter((d) => d.status !== "disconnected" && !d.disconnectedAt).length,
  };
}

export function countBy(rows, fn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = fn(r);
    map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export const scopeLabel = (s) => ({ STUDENT: "Student", INSTRUCTOR: "Instructor", INSTITUTE: "Institute", DEPARTMENT: "Department" })[s] || s;
