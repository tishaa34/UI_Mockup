/*
 * Sample data for the mockup.
 *
 * Every array below mirrors a real table, and every field name is a real
 * column. Values are invented, but they are generated with a fixed seed so
 * the numbers stay the same on every load.
 *
 *  LMS database (stembotix-lms-back-end, prisma/schema.prisma):
 *    Users, AssignedDepartment, AssignedInstructor, AssignedStudent, Classes,
 *    AssignedClass, Course (+ CourseLevel, CourseLanguage, CourseCategory),
 *    AssignedCourses, CompleteCurriculum, QuizScore, Certificate, Feedback,
 *    CourseTestSubmission, LoginLogs, Schedule, CheckInOutLog, Worklogs,
 *    AttendanceLogs, Query, Order, OrderItem, Shipment, Lead, ChatMessage,
 *    DownloadBlockzie
 *
 *  Blockzie database (read-only, via BLOCKZIE_DATABASE_URL on the
 *  feat/blockzie-dashboard branch; users linked by keycloak_id):
 *    bluetooth_sessions, BlockzieProject, sessions, ProjectTemplate
 */

export const TODAY = new Date("2026-11-21T12:00:00+05:30");

/* ---------- deterministic random ---------- */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261121);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
let idCounter = 0;
const uid = (prefix) => `${prefix}-${(++idCounter).toString(16).padStart(6, "0")}`;
const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2026-06-01T09:00:00+05:30").getTime();
// Random moment between `from` and `to`, moved to between 08:00 and 21:00 India time.
const IST_OFFSET = 330 * 60 * 1000;
const randomDate = (from = START, to = TODAY.getTime()) => {
  const t = from + rand() * (to - from);
  const istMidnight = Math.floor((t + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
  const clamped = istMidnight + (8 + rand() * 13) * 60 * 60 * 1000;
  return new Date(Math.min(Math.max(clamped, from), to));
};
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);
const ymd = (d) => d.toISOString().slice(0, 10);

const FIRST = [
  "Aarav", "Mahi", "Rohan", "Diya", "Vihaan", "Anaya", "Kabir", "Ishita", "Arjun", "Saanvi", "Dev", "Myra", "Reyansh",
  "Kiara", "Aditya", "Riya", "Yash", "Tanvi", "Krish", "Pooja", "Om", "Nisha", "Harsh", "Jiya", "Parth", "Hetvi",
  "Dhruv", "Krupa", "Meet", "Shreya", "Neel", "Aanya", "Rudra", "Khushi", "Jay", "Prisha",
];
const LAST = [
  "Shah", "Patel", "Desai", "Mehta", "Joshi", "Kulkarni", "Patil", "Pandya", "Trivedi", "Bhatt", "Parmar", "Chauhan",
  "Rathod", "Solanki", "Deshmukh", "Jadhav", "Pawar", "Vyas", "Modi", "Gohil",
];
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;
const emailOf = (name, domain = "example.com") => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}${int(1, 99)}@${domain}`;
const phone = () => `+91 9${int(100000000, 999999999)}`;

/* ---------- Organisation: Users + assignment tables ---------- */

const departmentSeed = [
  { fullName: "Yuva Unstoppable", city: "Ahmedabad", state: "Gujarat" },
  { fullName: "Shiksha Setu Foundation", city: "Pune", state: "Maharashtra" },
];
const instituteSeed = [
  { fullName: "STEM Public School", city: "Ahmedabad", state: "Gujarat", dept: 0 },
  { fullName: "Future Academy", city: "Surat", state: "Gujarat", dept: 0 },
  { fullName: "Innovation School", city: "Vadodara", state: "Gujarat", dept: 0 },
  { fullName: "Gyan Jyoti Vidyalaya", city: "Gandhinagar", state: "Gujarat", dept: 0 },
  { fullName: "Navrachna Primary School", city: "Rajkot", state: "Gujarat", dept: 0 },
  { fullName: "Bright Future School", city: "Mumbai", state: "Maharashtra", dept: 1 },
  { fullName: "Scholars International", city: "Pune", state: "Maharashtra", dept: 1 },
  { fullName: "Sahyadri Vidya Mandir", city: "Nashik", state: "Maharashtra", dept: 1 },
];

export const departments = departmentSeed.map((d) => ({
  id: uid("dep"),
  fullName: d.fullName,
  email: emailOf(d.fullName, "partner.org"),
  scopeType: "DEPARTMENT",
  city: d.city,
  state: d.state,
  country: "India",
  status: true,
  createdAt: new Date("2026-05-10T10:00:00+05:30"),
}));

export const institutes = instituteSeed.map((s) => ({
  id: uid("ins"),
  fullName: s.fullName,
  email: emailOf(s.fullName, "school.in"),
  phone: phone(),
  scopeType: "INSTITUTE",
  city: s.city,
  state: s.state,
  country: "India",
  status: s.fullName !== "Sahyadri Vidya Mandir",
  createdAt: randomDate(new Date("2026-05-15").getTime(), new Date("2026-06-20").getTime()),
}));

export const assignedDepartment = instituteSeed.map((s, i) => ({
  id: uid("ad"),
  departmentId: departments[s.dept].id,
  instituteId: institutes[i].id,
  deletedAt: null,
}));

export const instructors = Array.from({ length: 14 }, () => {
  const fullName = personName();
  return {
    id: uid("inr"),
    fullName,
    email: emailOf(fullName, "stembotix.com"),
    phone: phone(),
    scopeType: "INSTRUCTOR",
    status: chance(0.93),
    createdAt: randomDate(new Date("2026-05-20").getTime(), new Date("2026-06-15").getTime()),
  };
});

// Two instructors per institute; a few instructors cover two institutes.
export const assignedInstructor = [];
institutes.forEach((inst, i) => {
  const first = instructors[i % instructors.length];
  const second = instructors[(i + 8) % instructors.length];
  [first, second].forEach((ins) =>
    assignedInstructor.push({ id: uid("ai"), instructorId: ins.id, instituteId: inst.id, deletedAt: null })
  );
});
const unusedInstructors = instructors.filter((ins) => !assignedInstructor.some((a) => a.instructorId === ins.id));
unusedInstructors.forEach((ins, i) =>
  assignedInstructor.push({ id: uid("ai"), instructorId: ins.id, instituteId: institutes[i % institutes.length].id, deletedAt: null })
);

export const classes = [];
institutes.forEach((inst) => {
  ["Grade 6-A", "Grade 7-A", "Grade 8-B"].forEach((className) =>
    classes.push({ id: uid("cls"), className, instituteId: inst.id, noOfStudent: 0 })
  );
});

export const students = [];
export const assignedStudent = [];
export const assignedClass = [];
institutes.forEach((inst) => {
  const count = int(22, 34);
  const instClasses = classes.filter((c) => c.instituteId === inst.id);
  for (let i = 0; i < count; i += 1) {
    const fullName = personName();
    const createdAt = randomDate(inst.createdAt.getTime(), new Date("2026-09-30").getTime());
    const student = {
      id: uid("stu"),
      fullName,
      email: emailOf(fullName),
      phone: phone(),
      scopeType: "STUDENT",
      status: chance(0.95),
      totalLogin: 0,
      // Students with a keycloak_id can be matched to their Blockzie account.
      keycloak_id: chance(0.82) ? uid("kc") : null,
      aiAccess: chance(0.35),
      createdAt,
    };
    students.push(student);
    assignedStudent.push({ id: uid("as"), instituteId: inst.id, studentId: student.id, deletedAt: null });
    const cls = pick(instClasses);
    cls.noOfStudent += 1;
    assignedClass.push({ id: uid("ac"), studentId: student.id, classId: cls.id, deletedAt: null });
  }
});

/* ---------- Courses ---------- */

const courseSeed = [
  { title: "AI Basics", courseCode: "AI-101", category: "Artificial Intelligence", level: "Beginner", language: "English", chapters: 4, lessons: 16, pass: 60, dept: null },
  { title: "Robotics Foundations", courseCode: "ROB-101", category: "Robotics", level: "Beginner", language: "English", chapters: 5, lessons: 20, pass: 60, dept: null },
  { title: "Blockzie Coding", courseCode: "BLZ-101", category: "Coding", level: "Beginner", language: "Gujarati", chapters: 4, lessons: 14, pass: null, dept: 0 },
  { title: "IoT with Sensors", courseCode: "IOT-201", category: "Electronics", level: "Intermediate", language: "English", chapters: 5, lessons: 18, pass: 70, dept: null },
  { title: "Drone Basics", courseCode: "DRN-101", category: "Drones", level: "Beginner", language: "Hindi", chapters: 4, lessons: 12, pass: 60, dept: 1 },
];

export const courses = courseSeed.map((c) => ({
  id: uid("crs"),
  title: c.title,
  courseCode: c.courseCode,
  status: "Published",
  courseScope: c.dept === null ? "GLOBAL" : "DEPARTMENT_SPECIFIC",
  departmentId: c.dept === null ? null : departments[c.dept].id,
  passPercentage: c.pass,
  courseLevel: { levelName: c.level },
  courseLanguage: { language: c.language },
  categoryCourse: { name: c.category },
  // Counts of CourseCurriculum (chapters) and CourseContent (lessons) rows for the course.
  chapterCount: c.chapters,
  lessonCount: c.lessons,
}));

const deptOfInstitute = (instituteId) => assignedDepartment.find((a) => a.instituteId === instituteId)?.departmentId;

// Institute-level course assignments (AssignedCourses rows with userId = null).
export const assignedCourses = [];
institutes.forEach((inst) => {
  const deptId = deptOfInstitute(inst.id);
  const eligible = courses.filter((c) => c.courseScope === "GLOBAL" || c.departmentId === deptId);
  const chosen = eligible.filter(() => chance(0.8));
  (chosen.length ? chosen : eligible.slice(0, 2)).forEach((course) =>
    assignedCourses.push({
      id: uid("acr"),
      userId: null,
      courseId: course.id,
      instituteId: inst.id,
      classId: null,
      assignedById: deptId,
      type: "institute",
      assignedDate: randomDate(inst.createdAt.getTime(), new Date("2026-07-15").getTime()),
      deletedAt: null,
    })
  );
});

/* ---------- Learner records ---------- */

export const completeCurriculum = []; // one row per completed lesson
export const quizScore = [];
export const certificate = [];
export const feedback = [];
export const courseTestSubmission = [];

const instituteOfStudent = (studentId) => assignedStudent.find((a) => a.studentId === studentId).instituteId;
const classOfStudent = (studentId) => assignedClass.find((a) => a.studentId === studentId).classId;
const instructorsOf = (instituteId) => assignedInstructor.filter((a) => a.instituteId === instituteId).map((a) => a.instructorId);

students.forEach((stu) => {
  const instituteId = instituteOfStudent(stu.id);
  const instituteCourses = assignedCourses.filter((a) => a.instituteId === instituteId && a.userId === null);
  const taken = instituteCourses.filter(() => chance(0.7));
  taken.forEach((ic) => {
    const course = courses.find((c) => c.id === ic.courseId);
    const assignedDate = randomDate(Math.max(ic.assignedDate.getTime(), stu.createdAt.getTime()), TODAY.getTime() - 3 * DAY);
    const teacher = pick(instructorsOf(instituteId));
    assignedCourses.push({
      id: uid("acr"),
      userId: stu.id,
      courseId: course.id,
      instituteId,
      classId: classOfStudent(stu.id),
      assignedById: teacher,
      type: "student",
      assignedDate,
      deletedAt: null,
    });

    // Lessons completed: some never start, many are part-way, some finish.
    const roll = rand();
    const done = roll < 0.12 ? 0 : roll < 0.62 ? int(1, course.lessonCount - 1) : course.lessonCount;
    let at = assignedDate.getTime();
    for (let l = 0; l < done; l += 1) {
      at += int(1, 6) * DAY * (rand() * 0.6 + 0.2);
      const when = new Date(Math.min(at, TODAY.getTime() - DAY));
      completeCurriculum.push({
        id: uid("cc"),
        userId: stu.id,
        courseId: course.id,
        curriculumId: `${course.id}-lesson-${l + 1}`,
        contentSequence: l + 1, // CourseContent.contentSequence of the completed lesson (joined)
        date: ymd(when), // stored as text in CompleteCurriculum
        time: when.toTimeString().slice(0, 5),
      });
    }

    // One quiz per chapter; attempted once the chapter's lessons are reached.
    const chaptersReached = Math.floor((done / course.lessonCount) * course.chapterCount);
    let quizTotal = 0;
    for (let q = 0; q < chaptersReached; q += 1) {
      const score = Math.max(3, Math.min(10, Math.round(5 + rand() * 5 + (done === course.lessonCount ? 1 : 0))));
      quizTotal += score;
      quizScore.push({
        id: uid("qs"),
        userId: stu.id,
        quizId: `${course.id}-quiz-${q + 1}`,
        courseId: course.id,
        score,
        totalQue: 10,
        isCompleted: true,
        createdAt: assignedDate,
      });
    }
    const quizPct = chaptersReached ? (quizTotal / (chaptersReached * 10)) * 100 : 0;

    if (done === course.lessonCount && (course.passPercentage === null || quizPct >= course.passPercentage)) {
      certificate.push({
        id: uid("cert"),
        certificateId: `STB-${course.courseCode}-${int(1000, 9999)}`,
        userId: stu.id,
        courseId: course.id,
        courseName: course.title,
        studentName: stu.fullName,
        completedDate: new Date(Math.min(at + DAY, TODAY.getTime() - DAY)),
      });
    }
    if (done > 2 && chance(0.4)) {
      feedback.push({ id: uid("fb"), userId: stu.id, courseId: course.id, rating: pick([3, 4, 4, 4, 5, 5]), createdAt: assignedDate });
    }
    if (done > course.lessonCount / 2 && chance(0.7)) {
      const submittedAt = randomDate(assignedDate.getTime(), TODAY.getTime() - DAY);
      const graded = chance(0.72);
      courseTestSubmission.push({
        id: uid("cts"),
        testId: `${course.id}-test-1`,
        courseId: course.id,
        userId: stu.id,
        status: graded ? pick(["Accepted", "Accepted", "Accepted", "Rejected"]) : "Pending",
        score: graded ? int(5, 10) : null,
        isLatest: true,
        isLate: chance(0.15),
        submittedAt,
        gradedById: graded ? teacher : null,
        gradedAt: graded ? addMinutes(submittedAt, int(600, 6000)) : null,
      });
    }
  });
});

/* ---------- Logins ---------- */

export const loginLogs = [];
[...students, ...instructors, ...institutes, ...departments].forEach((u) => {
  const count = u.scopeType === "STUDENT" ? int(2, 45) : int(15, 60);
  for (let i = 0; i < count; i += 1) {
    loginLogs.push({ id: uid("ll"), userId: u.id, loginTime: randomDate(u.createdAt.getTime(), TODAY.getTime()) });
  }
  u.totalLogin = count;
});

/* ---------- Trainers at schools ---------- */

export const schedule = [];
export const checkInOutLog = [];
export const worklogs = [];
export const attendanceLogs = [];

const WORK_TITLES = [
  "Line-follower robot build", "Sensor wiring practice", "Blockzie loops activity", "Drone safety briefing",
  "AI image sorting demo", "Motor driver troubleshooting", "Project showcase prep", "Kit inventory check",
];

assignedInstructor.forEach((link) => {
  const instituteId = link.instituteId;
  const instClasses = classes.filter((c) => c.instituteId === instituteId);
  // Weekly session from June to the end of November.
  for (let t = new Date("2026-06-03T10:00:00+05:30").getTime(); t < new Date("2026-11-30").getTime(); t += 7 * DAY + int(-1, 1) * DAY) {
    const start = new Date(t);
    const cls = pick(instClasses);
    const sched = {
      id: uid("sch"),
      instructorId: link.instructorId,
      instituteId,
      title: `${cls.className} lab session`,
      startDate: ymd(start),
      endDate: ymd(start),
      startTime: "10:00",
      endTime: "11:30",
    };
    schedule.push(sched);
    if (start > TODAY) continue;

    if (chance(0.9)) {
      const lateMinutes = chance(0.78) ? int(-8, 8) : int(11, 45);
      const checkInTime = addMinutes(start, lateMinutes);
      checkInOutLog.push({
        id: uid("cio"),
        instructorId: link.instructorId,
        scheduleId: sched.id,
        checkIn: true,
        checkInTime,
        checkInLatitude: "23.0225",
        checkInLongitude: "72.5714",
        checkOut: true,
        checkOutTime: addMinutes(checkInTime, int(80, 100)),
      });
      if (chance(0.82)) {
        worklogs.push({
          id: uid("wl"),
          instructorId: link.instructorId,
          scheduleId: sched.id,
          title: pick(WORK_TITLES),
          description: "Session notes uploaded by trainer.",
          filesCount: int(0, 4), // WorklogsHasFiles rows
          createdAt: addMinutes(checkInTime, 95),
        });
      }
      assignedClass
        .filter((a) => a.classId === cls.id)
        .forEach((a) => {
          if (chance(0.84)) {
            attendanceLogs.push({
              id: uid("att"),
              studentId: a.studentId,
              instructorId: link.instructorId,
              scheduleId: sched.id,
              checkIn: true,
              checkInTime: addMinutes(checkInTime, int(0, 10)),
            });
          }
        });
    }
  }
});

/* ---------- Support, sales, AI ---------- */

export const query = Array.from({ length: 64 }, (_, i) => {
  const createdAt = randomDate();
  const user = pick(students);
  return {
    id: uid("q"),
    ticketCode: `TCK-${1001 + i}`,
    type: pick(["Course", "Technical", "Product", "Account"]),
    category: pick(["Video not loading", "Certificate", "Quiz result", "Kit not connecting", "Login issue", "Other"]),
    status: pick(["Resolved", "Resolved", "Resolved", "Pending", "In_Progress", "Hold", "Delayed"]),
    userId: user.id,
    courseId: chance(0.5) ? pick(courses).id : null,
    createdAt,
  };
});

export const orders = Array.from({ length: 90 }, () => {
  const createdAt = randomDate();
  const status = pick(["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS", "PENDING", "FAILED", "CANCELLED"]);
  const type = chance(0.6) ? "PRODUCT" : "COURSE";
  return {
    id: uid("ord"),
    orderCode: `ORD-${int(10000, 99999)}`,
    amount: type === "PRODUCT" ? int(1499, 8999) : int(499, 2999),
    currency: "INR",
    status,
    paymentDone: status === "SUCCESS",
    createdAt,
    orderItems: [{ type, quantity: int(1, 3) }],
    shipmentStatus: type === "PRODUCT" && status === "SUCCESS" ? pick(["DELIVERED", "DELIVERED", "SHIPPED", "PENDING"]) : null,
  };
});

export const leads = Array.from({ length: 160 }, () => ({
  id: uid("ld"),
  type: pick(["COURSE", "PRODUCT", "LABS", "LABS", "BLOCKZIE", "CONTACT_US"]),
  city: pick(["Ahmedabad", "Surat", "Pune", "Mumbai", "Rajkot", "Nashik"]),
  createdAt: randomDate(),
}));

export const chatMessage = [];
students
  .filter((s) => s.aiAccess)
  .forEach((s) => {
    const n = int(0, 30);
    for (let i = 0; i < n; i += 1) chatMessage.push({ id: uid("cm"), userId: s.id, role: "user", createdAt: randomDate(s.createdAt.getTime()) });
  });

export const downloadBlockzie = [
  { id: uid("dl"), title: "Blockzie for Windows", version: "3.4.1", downloadCount: 1842 },
  { id: uid("dl"), title: "Blockzie for macOS", version: "3.4.1", downloadCount: 516 },
  { id: uid("dl"), title: "Blockzie for Linux", version: "3.4.0", downloadCount: 208 },
];

/* ---------- Blockzie database (read-only) ---------- */

// Blockzie Users rows for LMS students that have a keycloak_id link.
export const blockzieUsers = students
  .filter((s) => s.keycloak_id)
  .map((s) => ({ id: uid("bzu"), fullName: s.fullName, email: s.email, keycloak_id: s.keycloak_id }));

const DEVICES = [
  { deviceName: "ESP32_BLE_4F2A", transport: "ble" },
  { deviceName: "ESP32_BLE_91C0", transport: "ble" },
  { deviceName: "ESP32_WiFi_LAB1", transport: "wifi" },
  { deviceName: "ESP32_WiFi_LAB2", transport: "wifi" },
  { deviceName: "Arduino Uno (COM3)", transport: "serial" },
  { deviceName: "Arduino Nano (COM5)", transport: "serial" },
  { deviceName: "micro:bit v2", transport: "bluetooth-ble" },
];

export const bluetoothSessions = [];
export const blockzieProject = [];
export const blockzieLoginSessions = []; // public.sessions

const PROJECT_TITLES = [
  "Traffic light", "Line follower", "Obstacle avoider", "Smart dustbin", "Plant watering alarm", "Rain detector",
  "Dance robot", "Quiz game", "Weather station", "Night lamp", "Racing game", "Story animation",
];

blockzieUsers.forEach((bu) => {
  const sessionsCount = int(0, 14);
  for (let i = 0; i < sessionsCount; i += 1) {
    const device = pick(DEVICES);
    const connectedAt = randomDate(new Date("2026-06-10").getTime());
    const stillActive = TODAY.getTime() - connectedAt.getTime() < 2 * 60 * 60 * 1000 && chance(0.5);
    const durationSeconds = int(120, 3600);
    bluetoothSessions.push({
      id: uid("bts"),
      userId: bu.id,
      deviceName: device.deviceName,
      deviceId: device.deviceName.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      transport: device.transport,
      clientPlatform: pick(["web", "web", "windows app", "windows app", "macos app", "linux app"]),
      connectedAt,
      disconnectedAt: stillActive ? null : new Date(connectedAt.getTime() + durationSeconds * 1000),
      durationSeconds: stillActive ? null : durationSeconds,
      status: stillActive ? "connected" : "disconnected",
    });
  }
  const projectCount = int(0, 6);
  for (let i = 0; i < projectCount; i += 1) {
    const createdAt = randomDate(new Date("2026-06-10").getTime());
    blockzieProject.push({
      id: uid("bzp"),
      userId: bu.id,
      title: pick(PROJECT_TITLES),
      projectType: pick(["project", "project", "demo", "test"]),
      visibility: chance(0.3) ? "public" : "private",
      createdAt,
      lastModified: randomDate(createdAt.getTime()),
      isDeleted: false,
    });
  }
  const logins = int(1, 20);
  for (let i = 0; i < logins; i += 1) {
    const loginAt = randomDate(new Date("2026-06-10").getTime());
    blockzieLoginSessions.push({
      id: uid("bzs"),
      userId: bu.id,
      device: pick(["Chrome on Windows", "Blockzie Windows app", "Chrome on Android", "Safari on macOS"]),
      loginAt,
      lastActiveAt: addMinutes(loginAt, int(5, 120)),
    });
  }
});

export const projectTemplate = [
  { name: "Blink an LED", type: "project", category: "Basics", keySkills: "Loops, output pins" },
  { name: "Traffic light", type: "project", category: "Basics", keySkills: "Sequencing, delays" },
  { name: "Line follower", type: "project", category: "Robotics", keySkills: "Sensors, conditions" },
  { name: "Obstacle avoider", type: "project", category: "Robotics", keySkills: "Ultrasonic sensor, motors" },
  { name: "Smart dustbin", type: "project", category: "IoT", keySkills: "Servo, distance sensing" },
  { name: "Weather station", type: "project", category: "IoT", keySkills: "DHT11, Wi-Fi" },
  { name: "Robot dance demo", type: "demo", category: "Robotics", keySkills: "Motor control" },
  { name: "Music player demo", type: "demo", category: "Basics", keySkills: "Buzzer, tones" },
  { name: "Loops checkpoint", type: "test", category: "Assessment", keySkills: "Loops" },
  { name: "Sensors checkpoint", type: "test", category: "Assessment", keySkills: "Sensor reading" },
].map((t) => ({ id: uid("tpl"), ...t, createdAt: randomDate(new Date("2026-06-01").getTime(), new Date("2026-09-01").getTime()) }));
