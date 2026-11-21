import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import * as db from "../data/db";
import {
  enrollments, summarizeEnrollments, byCourse, sessions, summarizeSessions, blockzieFor, studentsOfInstitute,
  instructorsOfInstitute, classIdOfStudent, classById, userById, lastLoginOf, departmentIdOfInstitute,
  studentAttendance, blockzieIdOf, sessionSeconds, fmtNum, fmtDate, fmtTime, fmtDuration, monthKey, monthLabel, MONTHS,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, CsvButton
} from "../components/ui";
import { COLORS } from "../components/utils";
import { PresencePanel } from "./PresencePanel";

/* SB-45: Institute Insights. */
export default function InstituteDashboard({ instituteId, onInstituteChange, onOpenStudent, onOpenPresence }) {
  const institute = userById.get(instituteId);
  const department = userById.get(departmentIdOfInstitute.get(instituteId));

  const view = useMemo(() => {
    const students = studentsOfInstitute(instituteId);
    const rows = enrollments.filter((e) => e.instituteId === instituteId);
    const sessionRows = sessions.filter((s) => s.instituteId === instituteId);
    const instClasses = db.classes.filter((c) => c.instituteId === instituteId);
    return {
      students,
      rows,
      summary: summarizeEnrollments(rows),
      field: summarizeSessions(sessionRows),
      sessionRows,
      instClasses,
      courses: byCourse(rows),
      blockzie: blockzieFor(students.map((s) => s.id)),
      instructors: instructorsOfInstitute(instituteId),
    };
  }, [instituteId]);

  const { students, rows, summary, field, sessionRows, instClasses, courses, blockzie, instructors } = view;

  const classRows = instClasses.map((c) => {
    const ids = db.assignedClass.filter((a) => a.classId === c.id).map((a) => a.studentId);
    const s = summarizeEnrollments(rows.filter((r) => ids.includes(r.userId)));
    const f = summarizeSessions(sessionRows.filter((x) => x.title.startsWith(c.className)));
    return {
      id: c.id,
      className: c.className,
      students: ids.length,
      enrollments: s.enrollments,
      completion: `${s.completionRate}%`,
      quiz: `${s.avgQuiz}%`,
      sessions: f.held,
      attendance: `${f.attendanceRate}%`,
    };
  });

  const courseRows = courses.map((c) => ({
    id: c.id,
    course: c.name,
    enrolled: c.enrollments,
    notStarted: c.notStarted,
    inProgress: c.inProgress,
    completed: c.completed,
    quiz: `${c.avgQuiz}%`,
    rating: c.avgRating,
  }));

  const visitRows = [...sessionRows]
    .sort((a, b) => b.start - a.start)
    .map((s) => ({
      id: s.id,
      date: fmtDate(s.start),
      instructor: userById.get(s.instructorId).fullName,
      session: s.title,
      checkIn: s.checkIn ? fmtTime(s.checkIn.checkInTime) : "—",
      status: !s.held ? "Not held" : s.onTime ? "On time" : `${s.minutesLate} min late`,
      attendance: s.held ? `${s.present} / ${s.classSize}` : "—",
      worklog: s.worklog ? s.worklog.title : "—",
    }));

  const studentRows = students
    .map((stu) => {
      const mine = rows.filter((r) => r.userId === stu.id);
      const s = summarizeEnrollments(mine);
      const bzId = blockzieIdOf(stu.id);
      const devices = bzId ? db.bluetoothSessions.filter((d) => d.userId === bzId) : [];
      return {
        id: stu.id,
        name: stu.fullName,
        className: classById.get(classIdOfStudent.get(stu.id))?.className,
        courses: mine.length,
        lessons: mine.reduce((t, r) => t + r.lessonsDone, 0),
        certificates: s.completed,
        quiz: `${s.avgQuiz}%`,
        attendance: `${studentAttendance(stu.id).rate}%`,
        projects: bzId ? db.blockzieProject.filter((p) => p.userId === bzId).length : "Not linked",
        deviceTime: bzId ? fmtDuration(devices.reduce((t, d) => t + sessionSeconds(d), 0)) : "—",
        lastLogin: fmtDate(lastLoginOf(stu.id)),
      };
    })
    .sort((a, b) => b.lessons - a.lessons);

  const monthly = MONTHS.map((m) => ({
    period: monthLabel(m),
    held: sessionRows.filter((s) => s.held && monthKey(s.start) === m).length,
    devices: blockzie.devices.filter((d) => monthKey(d.connectedAt) === m).length,
  }));

  return (
    <DashboardFrame
      title={`Institute Insights: ${institute.fullName}`}
      subtitle={`${institute.city}, ${institute.state} · ${department?.fullName ?? "No department"}. Classes, courses, trainer visits, students and Blockzie use.`}
      breadcrumb={`Departments / ${department?.fullName ?? "—"} / ${institute.fullName}`}
      filters={
        <FilterSelect
          label="Institute"
          value={instituteId}
          onChange={onInstituteChange}
          options={db.institutes.map((i) => ({ value: i.id, label: `${i.fullName} (${i.city})` }))}
        />
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Students" value={students.length} subtext={`${instClasses.length} classes`} source={["AssignedStudent", "Classes"]} />
        <MetricCard title="Instructors" value={instructors.length} subtext={instructors.map((i) => i.fullName.split(" ")[0]).join(", ")} source="AssignedInstructor" />
        <MetricCard title="Courses" value={courses.length} subtext={`${fmtNum(summary.enrollments)} enrollments`} source="AssignedCourses" />
        <MetricCard title="Completion" value={`${summary.completionRate}%`} subtext={`${summary.completed} certificates`} accent="text-emerald-700" source="Certificate" />
        <MetricCard title="Attendance" value={`${field.attendanceRate}%`} subtext={`${field.held} sessions held`} accent="text-violet-700" source={["Schedule", "AttendanceLogs"]} />
        <MetricCard title="Device connections" value={blockzie.devices.length} subtext={`${fmtDuration(blockzie.deviceSeconds)} · ${blockzie.projects.length} projects`} accent="text-sky-700" source={["Blockzie: bluetooth_sessions", "Blockzie: BlockzieProject"]} />
      </div>

      <PresencePanel scopeType="institute" scopeId={instituteId} onOpen={() => onOpenPresence(`institute:${instituteId}`)} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title="Classes" subtitle="Students, learning and attendance per class." source={["Classes", "AssignedClass", "AssignedCourses", "AttendanceLogs"]} action={<CsvButton filename="institute-classes.csv" rows={classRows} />}>
          <DataTable
            columns={[
              { key: "className", label: "Class" },
              { key: "students", label: "Students" },
              { key: "enrollments", label: "Enrollments" },
              { key: "completion", label: "Completion" },
              { key: "quiz", label: "Avg quiz" },
              { key: "sessions", label: "Sessions" },
              { key: "attendance", label: "Attendance" },
            ]}
            rows={classRows}
          />
        </Section>
        <Section title="Trainer sessions and device use by month" source={["CheckInOutLog", "Blockzie: bluetooth_sessions"]}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar isAnimationActive={false} dataKey="held" name="Sessions held" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="devices" name="Device connections" fill={COLORS[5]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title="Courses at this institute" subtitle="Enrolled students by learning status." source={["AssignedCourses", "CompleteCurriculum", "Certificate", "QuizScore", "Feedback"]} action={<CsvButton filename="institute-courses.csv" rows={courseRows} />}>
        <DataTable
          columns={[
            { key: "course", label: "Course" },
            { key: "enrolled", label: "Enrolled" },
            { key: "notStarted", label: "Not started" },
            { key: "inProgress", label: "In progress" },
            { key: "completed", label: "Completed" },
            { key: "quiz", label: "Avg quiz" },
            { key: "rating", label: "Rating" },
          ]}
          rows={courseRows}
        />
      </Section>

      <Section title="Trainer visits" subtitle="Scheduled sessions with check-in, attendance and work log." source={["Schedule", "CheckInOutLog", "AttendanceLogs", "Worklogs"]} action={<CsvButton filename="institute-trainer-visits.csv" rows={visitRows} />}>
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "instructor", label: "Instructor" },
            { key: "session", label: "Session" },
            { key: "checkIn", label: "Check-in" },
            {
              key: "status",
              label: "Punctuality",
              render: (v) => <StatusPill tone={v === "On time" ? "success" : v === "Not held" ? "danger" : "warning"}>{v}</StatusPill>,
            },
            { key: "attendance", label: "Present" },
            { key: "worklog", label: "Work log" },
          ]}
          rows={visitRows}
          limit={8}
        />
      </Section>

      <Section title="Students" subtitle="Click a student to open their dashboard." source={["AssignedStudent", "AssignedClass", "AssignedCourses", "CompleteCurriculum", "Certificate", "AttendanceLogs", "LoginLogs", "Blockzie: BlockzieProject", "Blockzie: bluetooth_sessions"]} action={<CsvButton filename="institute-students.csv" rows={studentRows} />}>
        <DataTable
          columns={[
            { key: "name", label: "Student", render: (v, r) => <button className="text-indigo-700 font-medium hover:underline text-left" onClick={() => onOpenStudent(r.id)}>{v}</button> },
            { key: "className", label: "Class" },
            { key: "courses", label: "Courses" },
            { key: "lessons", label: "Lessons done" },
            { key: "certificates", label: "Certificates" },
            { key: "quiz", label: "Avg quiz" },
            { key: "attendance", label: "Attendance" },
            { key: "projects", label: "Blockzie projects", render: (v) => (v === "Not linked" ? <StatusPill>Not linked</StatusPill> : v) },
            { key: "deviceTime", label: "Device time" },
            { key: "lastLogin", label: "Last login" },
          ]}
          rows={studentRows}
          limit={12}
        />
      </Section>
    </DashboardFrame>
  );
}
