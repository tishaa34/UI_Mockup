import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import * as db from "../data/db";
import {
  enrollments, summarizeEnrollments, byCourse, monthlyTrend, sessions, summarizeSessions, blockzieFor,
  institutesOfDepartment, institutesOfInstructor, instituteIdOfStudent, classIdOfStudent, classById, userById,
  lastLoginOf, fmtNum, fmtDate, fmtDuration, monthKey, monthLabel, MONTHS, pct,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, MiniStat, GroupLabel
} from "../components/ui";
import { COLORS } from "../components/utils";
import { PresencePanel } from "./PresencePanel";

/*
 * SB-42 / SB-43: Department Insights.
 * Filters: Course, Location, Month-Year. Export: Download PDF only (no CSV on this dashboard).
 */
export default function DepartmentDashboard({ departmentId, onDepartmentChange, onOpenCourse, onOpenInstitute, onOpenPresence }) {
  const [courseId, setCourseId] = useState("all");
  const [location, setLocation] = useState("all");
  const [month, setMonth] = useState("all");

  const department = userById.get(departmentId);
  const allInstitutes = useMemo(() => institutesOfDepartment(departmentId), [departmentId]);

  const view = useMemo(() => {
    const institutes = allInstitutes.filter((i) => location === "all" || `${i.city}|${i.state}` === location);
    const instIds = new Set(institutes.map((i) => i.id));
    const rows = enrollments.filter(
      (e) =>
        instIds.has(e.instituteId) &&
        (courseId === "all" || e.courseId === courseId) &&
        (month === "all" || monthKey(e.assignedDate) === month)
    );
    const sessionRows = sessions.filter((s) => instIds.has(s.instituteId) && (month === "all" || monthKey(s.start) === month));
    const studentIds = db.assignedStudent.filter((a) => instIds.has(a.instituteId)).map((a) => a.studentId);
    const instructorIds = [...new Set(db.assignedInstructor.filter((a) => instIds.has(a.instituteId)).map((a) => a.instructorId))];
    const blockzie = blockzieFor(courseId === "all" ? studentIds : [...new Set(rows.map((r) => r.userId))]);
    const inMonth = (d) => month === "all" || monthKey(d) === month;
    return {
      institutes,
      rows,
      summary: summarizeEnrollments(rows),
      field: summarizeSessions(sessionRows),
      studentIds,
      instructorIds,
      blockzie: {
        ...blockzie,
        devices: blockzie.devices.filter((d) => inMonth(d.connectedAt)),
        projects: blockzie.projects.filter((p) => inMonth(p.createdAt)),
      },
      courses: byCourse(rows),
      trend: monthlyTrend(rows),
      sessionRows,
    };
  }, [allInstitutes, courseId, location, month]);

  const { institutes, rows, summary, field, studentIds, instructorIds, blockzie, courses, trend, sessionRows } = view;
  const deviceSeconds = blockzie.devices.reduce((s, d) => s + (d.durationSeconds || 0), 0);

  const departmentCourses = db.courses.filter((c) => c.courseScope === "GLOBAL" || c.departmentId === departmentId);
  const locations = [...new Map(allInstitutes.map((i) => [`${i.city}|${i.state}`, `${i.city}, ${i.state}`]))];

  const instituteRows = institutes.map((inst) => {
    const r = rows.filter((e) => e.instituteId === inst.id);
    const s = summarizeEnrollments(r);
    const f = summarizeSessions(sessionRows.filter((x) => x.instituteId === inst.id));
    return {
      id: inst.id,
      name: inst.fullName,
      location: `${inst.city}, ${inst.state}`,
      instructors: db.assignedInstructor.filter((a) => a.instituteId === inst.id).length,
      students: db.assignedStudent.filter((a) => a.instituteId === inst.id).length,
      enrollments: s.enrollments,
      completion: `${s.completionRate}%`,
      quiz: `${s.avgQuiz}%`,
      sessions: `${f.held} / ${f.scheduled}`,
      attendance: `${f.attendanceRate}%`,
      status: inst.status,
    };
  });

  const instructorRows = instructorIds.map((id) => {
    const ins = userById.get(id);
    const mine = sessionRows.filter((s) => s.instructorId === id);
    const f = summarizeSessions(mine);
    const myInstitutes = institutesOfInstructor(id).filter((i) => institutes.some((x) => x.id === i.id));
    const backlog = db.courseTestSubmission.filter(
      (t) => t.status === "Pending" && myInstitutes.some((i) => i.id === instituteIdOfStudent.get(t.userId))
    ).length;
    return {
      id,
      name: ins.fullName,
      institutes: myInstitutes.map((i) => i.fullName).join(", "),
      held: `${f.held} / ${f.scheduled}`,
      onTime: `${f.onTimeRate}%`,
      worklogs: `${f.worklogRate}%`,
      backlog,
      lastLogin: fmtDate(lastLoginOf(id)),
      status: ins.status,
    };
  });

  const studentRows = [...new Set(rows.map((r) => r.userId))]
    .map((id) => {
      const s = userById.get(id);
      const mine = rows.filter((r) => r.userId === id);
      const sum = summarizeEnrollments(mine);
      return {
        id,
        name: s.fullName,
        institute: userById.get(instituteIdOfStudent.get(id)).fullName,
        className: classById.get(classIdOfStudent.get(id))?.className,
        courses: mine.length,
        lessons: mine.reduce((t, r) => t + r.lessonsDone, 0),
        completed: sum.completed,
        quiz: sum.avgQuiz,
        lastLogin: lastLoginOf(id),
      };
    })
    .sort((a, b) => b.lessons - a.lessons);

  return (
    <DashboardFrame
      title={`Department Insights: ${department.fullName}`}
      subtitle="Courses, institutes, instructors and students of this department, with trainer visits and Blockzie device use."
      breadcrumb={`Departments / ${department.fullName}`}
      filters={
        <>
          <FilterSelect
            label="Department"
            value={departmentId}
            onChange={(v) => {
              onDepartmentChange(v);
              setCourseId("all");
              setLocation("all");
            }}
            options={db.departments.map((d) => ({ value: d.id, label: d.fullName }))}
          />
          <FilterSelect
            label="Course"
            value={courseId}
            onChange={setCourseId}
            options={[{ value: "all", label: "All courses" }, ...departmentCourses.map((c) => ({ value: c.id, label: c.title }))]}
          />
          <FilterSelect
            label="Location"
            value={location}
            onChange={setLocation}
            options={[{ value: "all", label: "All locations" }, ...locations.map(([value, label]) => ({ value, label }))]}
          />
          <FilterSelect
            label="Month-Year"
            value={month}
            onChange={setMonth}
            options={[{ value: "all", label: "All months" }, ...MONTHS.map((m) => ({ value: m, label: monthLabel(m) }))]}
          />
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Institutes" value={institutes.length} subtext={`${institutes.filter((i) => i.status).length} active`} source="AssignedDepartment · Users.status" />
        <MetricCard title="Instructors" value={instructorIds.length} subtext="Assigned to these schools" source="AssignedInstructor" />
        <MetricCard title="Students" value={fmtNum(studentIds.length)} subtext={`${fmtNum(summary.students)} enrolled in a course`} source="AssignedStudent · AssignedCourses" />
        <MetricCard title="Enrollments" value={fmtNum(summary.enrollments)} subtext={courseId === "all" ? `${courses.length} courses` : "Selected course"} source="AssignedCourses" />
        <MetricCard title="Completion" value={`${summary.completionRate}%`} subtext={`${summary.completed} certificates`} accent="text-emerald-700" source="Certificate" />
        <MetricCard title="Avg quiz score" value={`${summary.avgQuiz}%`} subtext={`Rating ${summary.avgRating}`} accent="text-violet-700" source={["QuizScore", "Feedback.rating"]} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title="Course performance" subtitle="Enrollments and completion % by course. Click a bar to open the course." source={["AssignedCourses", "Certificate"]}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courses}>
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip />
                <Legend />
                <Bar isAnimationActive={false} yAxisId="left" name="Enrollments" dataKey="enrollments" fill={COLORS[0]} radius={[8, 8, 0, 0]} cursor="pointer" onClick={(d) => onOpenCourse(d?.id ?? d?.payload?.id)} />
                <Bar isAnimationActive={false} yAxisId="right" name="Completion %" dataKey="completionRate" fill={COLORS[1]} radius={[8, 8, 0, 0]} cursor="pointer" onClick={(d) => onOpenCourse(d?.id ?? d?.payload?.id)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Enrollments and certificates by month" subtitle="When students were enrolled and when they finished." source={["AssignedCourses.assignedDate", "Certificate.completedDate"]}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line isAnimationActive={false} type="monotone" dataKey="enrollments" name="Enrollments" stroke={COLORS[0]} strokeWidth={2} />
                <Line isAnimationActive={false} type="monotone" dataKey="certificates" name="Certificates" stroke={COLORS[2]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title="Learning status" subtitle="Where enrolled students are right now." source={["CompleteCurriculum", "Certificate"]}>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Not started" value={summary.notStarted} />
            <MiniStat label="In progress" value={summary.inProgress} accent="text-amber-700" />
            <MiniStat label="Completed" value={summary.completed} accent="text-emerald-700" />
            <MiniStat label="Tests waiting for grading" value={summary.pendingTests} accent="text-rose-700" />
          </div>
        </Section>
        <Section title="Trainers and Blockzie" subtitle="Trainer visits to these schools and device use by their students." source={["Schedule", "CheckInOutLog", "AttendanceLogs", "Blockzie: bluetooth_sessions", "Blockzie: BlockzieProject"]}>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Sessions held" value={`${field.held} / ${field.scheduled}`} />
            <MiniStat label="Student attendance" value={`${field.attendanceRate}%`} accent="text-violet-700" />
            <MiniStat label="Device connections" value={`${blockzie.devices.length} · ${fmtDuration(deviceSeconds)}`} accent="text-sky-700" />
            <MiniStat label="Blockzie projects" value={blockzie.projects.length} accent="text-sky-700" />
          </div>
        </Section>
      </div>

      <PresencePanel scopeType="department" scopeId={departmentId} onOpen={() => onOpenPresence(`department:${departmentId}`)} />

      <GroupLabel>Drill-down</GroupLabel>
      <Section title="Institutes" subtitle="Click an institute to open its dashboard." source={["AssignedDepartment", "AssignedInstructor", "AssignedStudent", "AssignedCourses", "Schedule", "AttendanceLogs"]}>
        <DataTable
          columns={[
            { key: "name", label: "Institute", render: (v, r) => <button className="text-indigo-700 font-medium hover:underline text-left" onClick={() => onOpenInstitute(r.id)}>{v}</button> },
            { key: "location", label: "City, State" },
            { key: "instructors", label: "Instructors" },
            { key: "students", label: "Students" },
            { key: "enrollments", label: "Enrollments" },
            { key: "completion", label: "Completion" },
            { key: "quiz", label: "Avg quiz" },
            { key: "sessions", label: "Sessions held" },
            { key: "attendance", label: "Attendance" },
            { key: "status", label: "Status", render: (v) => <StatusPill tone={v ? "success" : "danger"}>{v ? "Active" : "Inactive"}</StatusPill> },
          ]}
          rows={instituteRows}
        />
      </Section>

      <Section title="Instructors" subtitle="School visits, punctuality, work logs and grading backlog." source={["AssignedInstructor", "Schedule", "CheckInOutLog", "Worklogs", "CourseTestSubmission", "LoginLogs"]}>
        <DataTable
          columns={[
            { key: "name", label: "Instructor" },
            { key: "institutes", label: "Institutes" },
            { key: "held", label: "Sessions held" },
            { key: "onTime", label: "On-time check-in" },
            { key: "worklogs", label: "Work logs" },
            { key: "backlog", label: "Tests to grade" },
            { key: "lastLogin", label: "Last login" },
            { key: "status", label: "Status", render: (v) => <StatusPill tone={v ? "success" : "danger"}>{v ? "Active" : "Inactive"}</StatusPill> },
          ]}
          rows={instructorRows}
        />
      </Section>

      <Section title="Students" subtitle="Enrolled students, most progress first." source={["AssignedStudent", "AssignedClass", "AssignedCourses", "CompleteCurriculum", "QuizScore", "Certificate", "LoginLogs"]}>
        <DataTable
          columns={[
            { key: "name", label: "Student" },
            { key: "institute", label: "Institute" },
            { key: "className", label: "Class" },
            { key: "courses", label: "Courses" },
            { key: "lessons", label: "Lessons done" },
            { key: "completed", label: "Certificates" },
            { key: "quiz", label: "Avg quiz", render: (v) => `${v}%` },
            { key: "lastLogin", label: "Last login", render: (v) => fmtDate(v) },
          ]}
          rows={studentRows}
          limit={12}
        />
        <div className="text-xs text-slate-500 mt-2">{pct(studentRows.length, studentIds.length)}% of this department's students are enrolled in a course.</div>
      </Section>
    </DashboardFrame>
  );
}
