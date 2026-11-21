import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import * as db from "../data/db";
import {
  enrollments, summarizeEnrollments, userById, instituteIdOfStudent, classIdOfStudent, classById, lastLoginOf, loginsOf,
  studentAttendance, blockzieIdOf, isTraineeAccount, sessionSeconds, transportLabel, platformLabel, pct, fmtDate, fmtDateTime,
  fmtDuration, monthKey, monthLabel, MONTHS,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, CsvButton, EmptyState
} from "../components/ui";
import { COLORS } from "../components/utils";
import { MyActivityCard } from "./PresencePanel";

export default function StudentDashboard({ studentId, onStudentChange }) {
  const student = userById.get(studentId);
  const institute = userById.get(instituteIdOfStudent.get(studentId));
  const className = classById.get(classIdOfStudent.get(studentId))?.className;

  const view = useMemo(() => {
    const rows = enrollments.filter((e) => e.userId === studentId);
    const bzId = blockzieIdOf(studentId);
    const devices = bzId ? db.bluetoothSessions.filter((d) => d.userId === bzId) : [];
    const projects = bzId ? db.blockzieProject.filter((p) => p.userId === bzId && !p.isDeleted) : [];
    const blockzieLogins = bzId ? db.blockzieLoginSessions.filter((s) => s.userId === bzId) : [];
    const badges = db.certificate.filter((c) => c.userId === studentId);
    return {
      rows,
      summary: summarizeEnrollments(rows),
      bzId,
      devices,
      projects,
      blockzieLogins,
      certificates: badges,
      attendance: studentAttendance(studentId),
      aiMessages: db.chatMessage.filter((m) => m.userId === studentId).length,
    };
  }, [studentId]);

  const { rows, summary, bzId, devices, projects, blockzieLogins, certificates, attendance, aiMessages } = view;
  const studentsHere = db.assignedStudent.filter((a) => a.instituteId === institute.id).map((a) => userById.get(a.studentId));

  const split = [
    { name: "Completed", value: summary.completed },
    { name: "In progress", value: summary.inProgress },
    { name: "Not started", value: summary.notStarted },
  ].filter((s) => s.value > 0);

  const monthly = MONTHS.map((m) => ({
    period: monthLabel(m),
    lmsLogins: loginsOf(studentId).filter((l) => monthKey(l.loginTime) === m).length,
    blockzieLogins: blockzieLogins.filter((l) => monthKey(l.loginAt) === m).length,
    deviceConnections: devices.filter((d) => monthKey(d.connectedAt) === m).length,
  }));

  const courseRows = rows.map((r) => ({
    id: r.id,
    course: r.course.title,
    status: r.status,
    lessons: `${r.lessonsDone} / ${r.lessonCount}`,
    progress: `${pct(r.lessonsDone, r.lessonCount)}%`,
    quiz: r.quizTotal ? `${pct(r.quizScore, r.quizTotal)}%` : "—",
    test: r.pendingTest ? "Waiting for grading" : "—",
    certificate: r.certificate ? `${r.certificate.certificateId} (${fmtDate(r.certificate.completedDate)})` : "Not yet",
    assigned: fmtDate(r.assignedDate),
  }));

  const projectRows = [...projects]
    .sort((a, b) => b.lastModified - a.lastModified)
    .map((p) => ({ id: p.id, title: p.title, projectType: p.projectType, visibility: p.visibility, created: fmtDate(p.createdAt), modified: fmtDate(p.lastModified) }));

  const deviceRows = [...devices]
    .sort((a, b) => b.connectedAt - a.connectedAt)
    .map((d) => ({
      id: d.id,
      device: d.deviceName,
      type: transportLabel(d.transport),
      platform: platformLabel(d.clientPlatform),
      connected: fmtDateTime(d.connectedAt),
      duration: fmtDuration(sessionSeconds(d)),
      status: d.disconnectedAt ? "Completed" : "Active",
    }));

  return (
    <DashboardFrame
      title={isTraineeAccount(student) ? `Trainer in training: ${student.fullName}` : `Student: ${student.fullName}`}
      subtitle={`${institute.fullName} · ${className}. Courses, progress, attendance, Blockzie projects and device use.`}
      breadcrumb={`Institutes / ${institute.fullName} / ${student.fullName}`}
      filters={
        <FilterSelect
          label={`Student at ${institute.fullName}`}
          value={studentId}
          onChange={onStudentChange}
          options={studentsHere.map((s) => ({ value: s.id, label: isTraineeAccount(s) ? `${s.fullName} (${s.email})` : s.fullName }))}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section className="lg:col-span-2" title="Profile" source={["Users", "AssignedStudent", "AssignedClass", "LoginLogs", "Users.keycloak_id"]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
            <div><span className="font-medium text-slate-800">Email:</span> {student.email}</div>
            <div><span className="font-medium text-slate-800">Phone:</span> {student.phone}</div>
            <div><span className="font-medium text-slate-800">Institute:</span> {institute.fullName}</div>
            <div><span className="font-medium text-slate-800">Class:</span> {className}</div>
            <div><span className="font-medium text-slate-800">Joined:</span> {fmtDate(student.createdAt)}</div>
            <div><span className="font-medium text-slate-800">Last login:</span> {fmtDateTime(lastLoginOf(studentId))}</div>
            <div><span className="font-medium text-slate-800">Total logins:</span> {student.totalLogin}</div>
            <div><span className="font-medium text-slate-800">Status:</span> <StatusPill tone={student.status ? "success" : "danger"}>{student.status ? "Active" : "Inactive"}</StatusPill></div>
            <div><span className="font-medium text-slate-800">Blockzie account:</span> {bzId ? <StatusPill tone="sky">Linked</StatusPill> : <StatusPill>Not linked</StatusPill>}</div>
            <div><span className="font-medium text-slate-800">AI assistant:</span> {student.aiAccess ? `${aiMessages} messages` : "No access"}</div>
          </div>
        </Section>
        <Section title="Course status" source={["AssignedCourses", "CompleteCurriculum", "Certificate"]}>
          {split.length ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={false} data={split} dataKey="value" nameKey="name" outerRadius={80} stroke="#fff" strokeWidth={split.length > 1 ? 2 : 0}>
                    {split.map((s, i) => (
                      <Cell key={s.name} fill={[COLORS[2], COLORS[0], COLORS[3]][i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState>No courses assigned yet.</EmptyState>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Courses" value={rows.length} subtext={`${summary.inProgress} in progress`} source="AssignedCourses" />
        <MetricCard title="Lessons done" value={summary.lessonsDone} subtext="All courses" source="CompleteCurriculum" />
        <MetricCard title="Avg quiz score" value={`${summary.avgQuiz}%`} accent="text-violet-700" source="QuizScore" />
        <MetricCard title="Certificates" value={certificates.length} accent="text-emerald-700" source="Certificate" />
        <MetricCard title="Attendance" value={`${attendance.rate}%`} subtext={`${attendance.present} of ${attendance.held} sessions`} accent="text-amber-700" source="AttendanceLogs" />
        <MetricCard title="Device time" value={bzId ? fmtDuration(devices.reduce((s, d) => s + sessionSeconds(d), 0)) : "—"} subtext={bzId ? `${devices.length} connections · ${projects.length} projects` : "Blockzie not linked"} accent="text-sky-700" source={["Blockzie: bluetooth_sessions", "Blockzie: BlockzieProject"]} />
      </div>

      <Section title="Courses" subtitle="Progress, quiz score, tests and certificate per course." source={["AssignedCourses", "CompleteCurriculum", "QuizScore", "CourseTestSubmission", "Certificate"]} action={<CsvButton filename="student-courses.csv" rows={courseRows} />}>
        <DataTable
          columns={[
            { key: "course", label: "Course" },
            { key: "status", label: "Status", render: (v) => <StatusPill tone={v === "Completed" ? "success" : v === "In Progress" ? "info" : "default"}>{v}</StatusPill> },
            { key: "lessons", label: "Lessons" },
            { key: "progress", label: "Progress" },
            { key: "quiz", label: "Quiz score" },
            { key: "test", label: "Course test" },
            { key: "certificate", label: "Certificate" },
            { key: "assigned", label: "Assigned" },
          ]}
          rows={courseRows}
        />
      </Section>

      <MyActivityCard userId={studentId} />

      <Section title="Activity by month" subtitle="LMS logins, Blockzie logins and device connections." source={["LoginLogs", "Blockzie: sessions", "Blockzie: bluetooth_sessions"]}>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar isAnimationActive={false} dataKey="lmsLogins" name="LMS logins" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="blockzieLogins" name="Blockzie logins" fill={COLORS[5]} radius={[8, 8, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="deviceConnections" name="Device connections" fill={COLORS[2]} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title="Blockzie projects" source="Blockzie: BlockzieProject">
          {bzId ? (
            <DataTable
              columns={[
                { key: "title", label: "Project" },
                { key: "projectType", label: "Type" },
                { key: "visibility", label: "Visibility", render: (v) => <StatusPill tone={v === "public" ? "sky" : "default"}>{v}</StatusPill> },
                { key: "created", label: "Created" },
                { key: "modified", label: "Last modified" },
              ]}
              rows={projectRows}
            />
          ) : (
            <EmptyState>This student's LMS account is not linked to a Blockzie account (no shared keycloak_id).</EmptyState>
          )}
        </Section>
        <Section title="Device connections" source="Blockzie: bluetooth_sessions">
          {bzId ? (
            <DataTable
              columns={[
                { key: "device", label: "Device" },
                { key: "type", label: "Type" },
                { key: "platform", label: "App" },
                { key: "connected", label: "Connected" },
                { key: "duration", label: "Duration" },
                { key: "status", label: "Status", render: (v) => <StatusPill tone={v === "Active" ? "sky" : "default"}>{v}</StatusPill> },
              ]}
              rows={deviceRows}
              limit={8}
            />
          ) : (
            <EmptyState>No Blockzie link, so device connections can't be matched to this student.</EmptyState>
          )}
        </Section>
      </div>
    </DashboardFrame>
  );
}
