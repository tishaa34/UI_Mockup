/*
 * KCG programme sample data.
 *
 * Mirrors the tables on the KCG branch of stembotix-lms-back-end:
 *   Cluster, ClusterCoordinator, AssignedDepartment.clusterId, DepartmentFeature (TRAINING_BOOKING),
 *   ProgramSettings, ProgramLevel, BatchStudent, LevelWindow, LevelFinish, LevelResult,
 *   TrainingBooking, AttendanceLogs, Team, TeamMember, Project, ProjectSubmission, ProjectTrl,
 *   KitDelivery, CollegeIssue, Certificate.kcgLevel
 *
 * The per-college numbers use the same rules as src/kcg-dashboard/kcg-dashboard.rules.ts
 * (kitSummary, collegeFlags, attendancePercent) and src/kcg-level/kcg-marks.ts.
 */
import { TODAY } from "./db";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(4_202_611);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
let n = 0;
const uid = (p) => `${p}-${(++n).toString(16).padStart(5, "0")}`;

const DAY = 24 * 60 * 60 * 1000;
const ymd = (ms) => new Date(ms + 330 * 60 * 1000).toISOString().slice(0, 10); // India date
export const TODAY_STR = ymd(TODAY.getTime());
const at = (s) => Date.parse(`${s}T00:00:00+05:30`);
const addDays = (s, d) => ymd(at(s) + d * DAY);

/* ---------- ProgramSettings + ProgramLevel (agreed starting values) ---------- */

export const programSettings = {
  projectWeight: 50,
  quizWeight: 25,
  testWeight: 25,
  attendancePercent: 70,
  maxAttempts: 3,
  maxTeamSize: 4,
  batchTarget: 40,
  batchMax: 50,
  reviewWaitDays: 7,
};

export const programLevels = [
  { level: 1, passMark: 50, trlMin: 0, trlMax: 0, trainingDays: 6, certificates: false },
  { level: 2, passMark: 50, trlMin: 1, trlMax: 3, trainingDays: 6, certificates: false },
  { level: 3, passMark: 50, trlMin: 4, trlMax: 4, trainingDays: 6, certificates: false },
  { level: 4, passMark: 50, trlMin: 5, trlMax: 7, trainingDays: 12, certificates: true },
];
export const LEVELS = [1, 2, 3, 4];

/* ---------- Clusters and colleges ---------- */

const FIRST = ["Aarav", "Mahi", "Rohan", "Diya", "Vihaan", "Anaya", "Kabir", "Ishita", "Arjun", "Saanvi", "Dev", "Myra", "Krish", "Pooja", "Om", "Nisha", "Harsh", "Jiya", "Parth", "Hetvi", "Dhruv", "Krupa", "Meet", "Shreya", "Neel", "Rudra", "Khushi", "Jay", "Prisha", "Yash"];
const LAST = ["Shah", "Patel", "Desai", "Mehta", "Joshi", "Pandya", "Trivedi", "Bhatt", "Parmar", "Chauhan", "Rathod", "Solanki", "Vyas", "Modi", "Gohil", "Makwana", "Prajapati", "Thakkar"];
const person = () => `${pick(FIRST)} ${pick(LAST)}`;

export const kcgDepartment = { id: uid("dep"), fullName: "KCG", scopeType: "DEPARTMENT", features: ["CLUSTERS", "TRAINING_BOOKING"] };

const CLUSTER_SEED = [
  { name: "Ahmedabad Cluster", city: "Ahmedabad" },
  { name: "Gandhinagar Cluster", city: "Gandhinagar" },
  { name: "Vadodara Cluster", city: "Vadodara" },
  { name: "Surat Cluster", city: "Surat" },
  { name: "Rajkot Cluster", city: "Rajkot" },
];
export const clusters = CLUSTER_SEED.map((c) => ({
  id: uid("cl"),
  name: c.name,
  city: c.city,
  departmentId: kcgDepartment.id,
  instructor: { id: uid("inr"), fullName: person() }, // Cluster.instructorId: the cluster's trainer
  coordinators: [{ id: uid("usr"), fullName: person() }], // ClusterCoordinator rows
}));

const COLLEGE_A = ["Sardar", "Vidya", "Shree", "Navjeevan", "Gyanodaya", "Pragati", "Saraswati", "Sanskar", "Udaan", "Prerna"];
const COLLEGE_B = ["Institute of Technology", "Engineering College", "Polytechnic", "College of Science", "Institute of Engineering"];

const PROJECT_TITLES = [
  "Smart irrigation controller", "Solar panel tracker", "Air quality monitor", "Waste segregation bin",
  "Water level alarm", "Smart street light", "Fall detector for elders", "Crop disease detector",
  "Energy meter dashboard", "Automatic hand sanitiser", "Parking slot finder", "Cold storage monitor",
  "Flood early warning", "Gesture-controlled robot", "Attendance with RFID", "Greenhouse climate control",
];
const ISSUE_TITLES = [
  { title: "Lab not available on booked day", owner: "COLLEGE" },
  { title: "Projector not working in lab", owner: "COLLEGE" },
  { title: "Students missing from batch list", owner: "COLLEGE" },
  { title: "Kit sensors missing in box", owner: "STEMBOTIX" },
  { title: "Replacement motor driver needed", owner: "STEMBOTIX" },
  { title: "Marks for Level 2 not entered", owner: "TRAINER" },
  { title: "Project reviews pending", owner: "TRAINER" },
  { title: "Training day to be rescheduled", owner: "TRAINER" },
];
const KIT_TYPES = ["KCG Innovation Kit", "IoT Sensor Pack", "Robotics Starter Kit"];

/* ---------- Rules copied from the KCG branch ---------- */

const KIT_ORDER = ["PENDING", "DISPATCHED", "DELIVERED", "CONFIRMED"];
export const kitSummary = (statuses) => (statuses.length === 0 ? "NONE" : KIT_ORDER.find((s) => statuses.includes(s)));

export const FLAG_LABEL = {
  kit: "Kit not delivered",
  attendance: "No attendance taken",
  project: "Project not set up",
  review: "Review waiting too long",
  marks: "Level ended, marks missing",
  issue: "Overdue issue",
};
export function collegeFlags(row) {
  const flags = [];
  if (["NONE", "PENDING", "DISPATCHED"].includes(row.kitSummary)) flags.push("kit");
  if (row.daysWithoutAttendance > 0) flags.push("attendance");
  if (row.teamsWithoutProject > 0) flags.push("project");
  if (row.reviewsWaitingTooLong > 0) flags.push("review");
  if (row.endedLevelsMissingMarks.length > 0) flags.push("marks");
  if (row.overdueIssues > 0) flags.push("issue");
  return flags;
}
export function attendancePercent(levels) {
  const expected = levels.reduce((s, l) => s + l.heldDays * l.students, 0);
  if (expected === 0) return null;
  const checkIns = levels.reduce((s, l) => s + l.checkIns, 0);
  return Math.round((Math.min(checkIns, expected) / expected) * 1000) / 10;
}
export const combineMarks = (project, quiz, test) =>
  Math.round(
    ((programSettings.projectWeight * project + programSettings.quizWeight * quiz + programSettings.testWeight * test) /
      (programSettings.projectWeight + programSettings.quizWeight + programSettings.testWeight)) *
      10
  ) / 10;

/* ---------- One college at a time ---------- */

export const colleges = [];
export const kitDeliveries = [];
export const collegeIssues = [];
export const projects = []; // Project rows (one per team) with latest ProjectTrl value
export const submissions = []; // ProjectSubmission rows (review + mark)
const studentsByCollege = new Map();

const usedNames = new Set();
for (let i = 0; i < 30; i += 1) {
  const cluster = clusters[i % clusters.length];
  let fullName;
  do fullName = `${pick(COLLEGE_A)} ${pick(COLLEGE_B)}, ${cluster.city}`;
  while (usedNames.has(fullName));
  usedNames.add(fullName);
  const college = { id: uid("col"), fullName, city: cluster.city, clusterId: cluster.id };

  // LevelWindow: four runs of dates. A quarter of colleges started about a month later.
  const late = chance(0.25) ? 30 : 0;
  const o = int(0, 14) + late;
  const windows = [
    { level: 1, startDate: addDays("2026-08-03", o), endDate: addDays("2026-08-24", o) },
    { level: 2, startDate: addDays("2026-09-01", o), endDate: addDays("2026-09-26", o) },
    { level: 3, startDate: addDays("2026-10-05", o), endDate: addDays("2026-10-31", o) },
    { level: 4, startDate: addDays("2026-11-09", o), endDate: addDays("2027-01-09", o) },
  ];
  const ended = windows.filter((w) => w.endDate < TODAY_STR).map((w) => w.level);
  const open = windows.find((w) => w.startDate <= TODAY_STR && w.endDate >= TODAY_STR)?.level ?? null;
  // LevelFinish: most ended levels are finished; a few wait for marks.
  const finished = ended.filter((lvl) => lvl < 3 || chance(0.7));

  // BatchStudent (ENROLLED) and how many moved up each level (LevelResult.movedUp).
  const enrolled = int(26, 49);
  const studentsPerLevel = [enrolled];
  for (let lvl = 2; lvl <= 4; lvl += 1) {
    studentsPerLevel.push(finished.includes(lvl - 1) ? Math.round(studentsPerLevel[lvl - 2] * (0.78 + rand() * 0.17)) : 0);
  }

  // TrainingBooking: full days per level. "held" = booked days before today.
  const bookings = windows.map((w) => {
    const spec = programLevels[w.level - 1];
    const startsSoon = w.startDate <= addDays(TODAY_STR, 21);
    const booked = w.level < 4 || (startsSoon && chance(0.85)) ? spec.trainingDays : 0;
    const span = Math.max(1, (at(w.endDate) - at(w.startDate)) / DAY);
    const elapsed = Math.max(0, Math.min(1, (at(TODAY_STR) - at(w.startDate)) / (span * DAY)));
    const held = Math.min(booked, Math.round(booked * elapsed));
    return { level: w.level, booked, held, noAttendance: held > 0 && chance(0.08) ? 1 : 0 };
  });
  const attendanceByLevel = LEVELS.map(() => 0.68 + rand() * 0.28);
  // A held day with no attendance taken still expects every student, so it pulls attendance down.
  const attendance = attendancePercent(
    bookings.map((b, idx) => ({
      heldDays: b.held,
      students: studentsPerLevel[idx],
      checkIns: Math.round((b.held - b.noAttendance) * studentsPerLevel[idx] * attendanceByLevel[idx]),
    }))
  );

  // Teams (max 4 students) and their projects.
  const teamCount = Math.ceil(enrolled / programSettings.maxTeamSize);
  const teamsWithoutProject = chance(0.2) ? int(1, 3) : 0;
  const currentLevel = open ?? ended.filter((l) => !finished.includes(l)).sort().pop() ?? null;
  const reachedLevel = currentLevel ?? Math.max(1, ...finished);
  const collegeTeams = [];
  for (let t = 0; t < teamCount; t += 1) {
    const team = { id: uid("tm"), name: `Team ${t + 1}`, instituteId: college.id };
    collegeTeams.push(team);
    if (t >= teamCount - teamsWithoutProject) continue;
    const spec = programLevels[reachedLevel - 1];
    const trl = reachedLevel === 1 ? 0 : int(spec.trlMin, spec.trlMax);
    const status = reachedLevel >= 4 && chance(0.3) ? "DONE" : "IN_PROGRESS";
    projects.push({ id: uid("prj"), teamId: team.id, instituteId: college.id, title: pick(PROJECT_TITLES), status, trl });
    for (let lvl = 1; lvl <= reachedLevel; lvl += 1) {
      const submittedAt = at(windows[lvl - 1].startDate) + int(5, 20) * DAY;
      if (submittedAt > TODAY.getTime()) continue;
      const pending = lvl === reachedLevel && chance(0.25);
      const stale = pending && TODAY.getTime() - submittedAt > programSettings.reviewWaitDays * DAY;
      submissions.push({
        id: uid("sub"),
        instituteId: college.id,
        teamId: team.id,
        level: lvl,
        attemptNo: 1,
        submittedAt,
        review: pending ? "PENDING" : chance(0.15) ? "NEEDS_CORRECTIONS" : "APPROVED",
        mark: pending ? null : int(48, 96),
        stale,
      });
    }
  }
  const mySubs = submissions.filter((s) => s.instituteId === college.id);
  const teamsMarkedAt = (lvl) => new Set(mySubs.filter((s) => s.level === lvl && s.mark !== null).map((s) => s.teamId)).size;
  const teamsWithMembers = teamCount;
  const endedLevelsMissingMarks = ended.filter((lvl) => !finished.includes(lvl) && teamsMarkedAt(lvl) < teamsWithMembers);

  // KitDelivery rows.
  const kitRoll = rand();
  const kitStatuses =
    kitRoll < 0.05 ? [] : kitRoll < 0.13 ? ["PENDING"] : kitRoll < 0.25 ? ["DISPATCHED"] : kitRoll < 0.45 ? ["DELIVERED"] : ["CONFIRMED"];
  kitStatuses.forEach((status) => {
    const dispatch = status === "PENDING" ? null : addDays("2026-07-20", int(0, 40) + late);
    const delivered = ["DELIVERED", "CONFIRMED"].includes(status) ? addDays(dispatch, int(2, 7)) : null;
    kitDeliveries.push({
      id: uid("kit"),
      instituteId: college.id,
      kitType: KIT_TYPES[0],
      quantity: teamCount,
      dispatchDate: dispatch,
      deliveryDate: delivered,
      status,
      confirmedBy: status === "CONFIRMED" ? person() : null,
      issueNotes: status === "DELIVERED" && chance(0.3) ? "2 boxes had a missing sensor; replacement sent." : null,
    });
  });
  if (kitStatuses.length && chance(0.35)) {
    kitDeliveries.push({
      id: uid("kit"),
      instituteId: college.id,
      kitType: pick(KIT_TYPES.slice(1)),
      quantity: Math.ceil(teamCount / 2),
      ...(() => {
        const dispatchDate = addDays("2026-10-01", int(0, 30));
        const status = pick(["DISPATCHED", "DELIVERED", "CONFIRMED"]);
        return { dispatchDate, deliveryDate: status === "DISPATCHED" ? null : addDays(dispatchDate, int(2, 7)), status };
      })(),
      confirmedBy: null,
      issueNotes: null,
    });
  }

  // CollegeIssue rows.
  const issueCount = int(0, 3);
  for (let k = 0; k < issueCount; k += 1) {
    const base = pick(ISSUE_TITLES);
    const createdAt = addDays("2026-09-20", int(0, 60));
    const isOpen = chance(0.5);
    collegeIssues.push({
      id: uid("iss"),
      instituteId: college.id,
      title: base.title,
      owner: base.owner,
      ownerName: base.owner === "TRAINER" ? cluster.instructor.fullName : base.owner === "COLLEGE" ? "College coordinator" : "STEMbotix ops",
      targetDate: addDays(createdAt, int(10, 40)),
      status: isOpen ? "OPEN" : "CLOSED",
      createdAt,
    });
  }
  const myIssues = collegeIssues.filter((x) => x.instituteId === college.id);
  const openIssues = myIssues.filter((x) => x.status === "OPEN");

  const row = {
    instituteId: college.id,
    collegeName: college.fullName,
    city: college.city,
    clusterId: cluster.id,
    clusterName: cluster.name,
    trainerId: cluster.instructor.id,
    trainerName: cluster.instructor.fullName,
    students: enrolled,
    studentsPerLevel,
    kitSummary: kitSummary(kitStatuses),
    trainingDaysBooked: bookings.reduce((s, b) => s + b.booked, 0),
    trainingDaysDone: bookings.reduce((s, b) => s + b.held, 0),
    daysWithoutAttendance: bookings.reduce((s, b) => s + b.noAttendance, 0),
    bookings,
    attendance,
    teams: teamCount,
    teamsWithoutProject,
    submissions: mySubs.length,
    submissionsReviewed: mySubs.filter((s) => s.review !== "PENDING").length,
    reviewsWaitingTooLong: mySubs.filter((s) => s.stale).length,
    currentLevel,
    teamsMarked: currentLevel ? teamsMarkedAt(currentLevel) : null,
    finishedLevels: [...finished].sort(),
    endedLevelsMissingMarks,
    openIssues: openIssues.length,
    overdueIssues: openIssues.filter((x) => x.targetDate < TODAY_STR).length,
    windows,
    teamList: collegeTeams,
    late: late > 0,
  };
  row.flags = collegeFlags(row);
  colleges.push(row);
}

/* ---------- One college's students (the drill-down) ---------- */

/** Student, team, the level they are in now, attendance, level mark and status. */
export function collegeStudents(row) {
  if (studentsByCollege.has(row.instituteId)) return studentsByCollege.get(row.instituteId);
  const r = mulberry32(row.students * 7919 + row.collegeName.length * 104729);
  const pickR = (arr) => arr[Math.floor(r() * arr.length)];
  const list = [];
  let remaining = [...row.studentsPerLevel];
  for (let i = 0; i < row.students; i += 1) {
    // Highest level this student reached.
    let level = 1;
    for (let lvl = 4; lvl >= 2; lvl -= 1) {
      if (remaining[lvl - 1] > 0) {
        level = lvl;
        remaining[lvl - 1] -= 1;
        break;
      }
    }
    const isCurrent = !row.finishedLevels.includes(level);
    const attendance = Math.round((60 + r() * 40) * 10) / 10;
    const project = 45 + r() * 50;
    const quiz = 40 + r() * 58;
    const test = 40 + r() * 58;
    const mark = combineMarks(project, quiz, test);
    // LevelResult once the level is finished, else the level's dates decide.
    let status;
    if (isCurrent) {
      status = "IN_PROGRESS";
    } else {
      const passed = mark >= programLevels[level - 1].passMark && attendance >= programSettings.attendancePercent;
      status = !passed ? "FAILED" : level === 4 ? "PASSED" : "NOT_MOVED_UP";
    }
    list.push({
      studentId: `${row.instituteId}-s${i}`,
      fullName: `${pickR(FIRST)} ${pickR(LAST)}`,
      teamName: row.teamList[Math.floor(i / programSettings.maxTeamSize)]?.name ?? "—",
      level,
      attendance,
      levelMark: status === "IN_PROGRESS" && r() < 0.4 ? null : mark,
      status,
    });
  }
  list.sort((a, b) => a.fullName.localeCompare(b.fullName));
  studentsByCollege.set(row.instituteId, list);
  return list;
}

export const KIT_LABEL = {
  NONE: "No kit recorded",
  PENDING: "Pending",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CONFIRMED: "Confirmed",
};
export const STATUS_LABEL = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PASSED: "Passed",
  FAILED: "Failed",
  NOT_MOVED_UP: "Not moved up",
};
