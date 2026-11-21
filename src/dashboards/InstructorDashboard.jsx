import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import * as db from "../data/db";
import {
  sessions, summarizeSessions, institutesOfInstructor, userById, instituteIdOfStudent, lastLoginOf, loginsOf,
  enrollments, summarizeEnrollments, fmtDate, fmtDateTime, monthKey, monthLabel, MONTHS,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, CsvButton
} from "../components/ui";
import { COLORS } from "../components/utils";

export default function InstructorDashboard({ instructorId, onInstructorChange }) {
  const instructor = userById.get(instructorId);

  const view = useMemo(() => {
    const mine = sessions.filter((s) => s.instructorId === instructorId);
    const institutes = institutesOfInstructor(instructorId);
    const instIds = new Set(institutes.map((i) => i.id));
    // Students this instructor teaches: course assignments they made, plus attendance they recorded.
    const taught = new Set([
      ...enrollments.filter((e) => e.assignedById === instructorId).map((e) => e.userId),
      ...db.attendanceLogs.filter((a) => a.instructorId === instructorId).map((a) => a.studentId),
    ]);
    const backlog = db.courseTestSubmission.filter((t) => t.status === "Pending" && instIds.has(instituteIdOfStudent.get(t.userId)));
    const graded = db.courseTestSubmission.filter((t) => t.gradedById === instructorId);
    return {
      mine,
      institutes,
      taught,
      backlog,
      graded,
      field: summarizeSessions(mine),
      learning: summarizeEnrollments(enrollments.filter((e) => taught.has(e.userId) && instIds.has(e.instituteId))),
    };
  }, [instructorId]);

  const { mine, institutes, taught, backlog, graded, field, learning } = view;

  const monthly = MONTHS.map((m) => {
    const inMonth = mine.filter((s) => monthKey(s.start) === m);
    return {
      period: monthLabel(m),
      scheduled: inMonth.length,
      held: inMonth.filter((s) => s.held).length,
      onTime: inMonth.filter((s) => s.onTime).length,
    };
  });

  const instituteRows = institutes.map((inst) => {
    const f = summarizeSessions(mine.filter((s) => s.instituteId === inst.id));
    return {
      id: inst.id,
      institute: inst.fullName,
      location: `${inst.city}, ${inst.state}`,
      scheduled: f.scheduled,
      held: f.held,
      onTime: `${f.onTimeRate}%`,
      attendance: `${f.attendanceRate}%`,
      worklogs: f.worklogs,
    };
  });

  const sessionRows = [...mine]
    .sort((a, b) => b.start - a.start)
    .map((s) => ({
      id: s.id,
      date: fmtDate(s.start),
      institute: userById.get(s.instituteId).fullName,
      session: s.title,
      checkIn: s.checkIn ? fmtDateTime(s.checkIn.checkInTime) : "—",
      checkOut: s.checkIn?.checkOutTime ? fmtDateTime(s.checkIn.checkOutTime) : "—",
      punctuality: !s.held ? "Not held" : s.onTime ? "On time" : `${s.minutesLate} min late`,
      present: s.held ? `${s.present} / ${s.classSize}` : "—",
      worklog: s.worklog ? `${s.worklog.title}${s.worklog.filesCount ? ` (${s.worklog.filesCount} ${s.worklog.filesCount === 1 ? "file" : "files"})` : ""}` : "—",
    }));

  return (
    <DashboardFrame
      title={`Instructor: ${instructor.fullName}`}
      subtitle={`${instructor.email} · ${instructor.phone}. School visits, punctuality, attendance, work logs and grading.`}
      breadcrumb="Instructors"
      filters={
        <FilterSelect
          label="Instructor"
          value={instructorId}
          onChange={onInstructorChange}
          options={db.instructors.map((i) => ({ value: i.id, label: i.fullName }))}
        />
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Institutes" value={institutes.length} subtext={institutes.map((i) => i.city).join(", ")} source="AssignedInstructor" />
        <MetricCard title="Students taught" value={taught.size} subtext={`Course completion ${learning.completionRate}%`} source={["AssignedCourses.assignedById", "AttendanceLogs.instructorId"]} />
        <MetricCard title="Sessions held" value={`${field.held} / ${field.scheduled}`} subtext={`${field.heldRate}% of scheduled`} source={["Schedule", "CheckInOutLog"]} />
        <MetricCard title="On-time check-in" value={`${field.onTimeRate}%`} subtext="Within 10 min of start" accent="text-emerald-700" source="CheckInOutLog.checkInTime" />
        <MetricCard title="Student attendance" value={`${field.attendanceRate}%`} subtext={`${field.worklogRate}% sessions with work log`} accent="text-violet-700" source={["AttendanceLogs", "Worklogs"]} />
        <MetricCard title="Tests to grade" value={backlog.length} subtext={`${graded.length} graded so far`} accent="text-rose-700" source="CourseTestSubmission" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Sessions by month" subtitle="Scheduled, held, and held on time." source={["Schedule", "CheckInOutLog"]}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar isAnimationActive={false} dataKey="scheduled" name="Scheduled" fill="#c7c8fb" radius={[8, 8, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="held" name="Held" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="onTime" name="On time" fill={COLORS[2]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Account" source={["Users", "LoginLogs"]}>
          <div className="space-y-3 text-sm text-slate-600">
            <div><span className="font-medium text-slate-800">Status:</span> <StatusPill tone={instructor.status ? "success" : "danger"}>{instructor.status ? "Active" : "Inactive"}</StatusPill></div>
            <div><span className="font-medium text-slate-800">Joined:</span> {fmtDate(instructor.createdAt)}</div>
            <div><span className="font-medium text-slate-800">Last login:</span> {fmtDateTime(lastLoginOf(instructorId))}</div>
            <div><span className="font-medium text-slate-800">Logins since June:</span> {loginsOf(instructorId).length}</div>
          </div>
        </Section>
      </div>

      <Section title="Institutes" source={["AssignedInstructor", "Schedule", "CheckInOutLog", "AttendanceLogs", "Worklogs"]} action={<CsvButton filename="instructor-institutes.csv" rows={instituteRows} />}>
        <DataTable
          columns={[
            { key: "institute", label: "Institute" },
            { key: "location", label: "City, State" },
            { key: "scheduled", label: "Scheduled" },
            { key: "held", label: "Held" },
            { key: "onTime", label: "On time" },
            { key: "attendance", label: "Attendance" },
            { key: "worklogs", label: "Work logs" },
          ]}
          rows={instituteRows}
        />
      </Section>

      <Section title="Session log" subtitle="Each scheduled session with check-in/out, attendance and work log." source={["Schedule", "CheckInOutLog", "AttendanceLogs", "Worklogs", "WorklogsHasFiles"]} action={<CsvButton filename="instructor-sessions.csv" rows={sessionRows} />}>
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            { key: "institute", label: "Institute" },
            { key: "session", label: "Session" },
            { key: "checkIn", label: "Check-in" },
            { key: "checkOut", label: "Check-out" },
            {
              key: "punctuality",
              label: "Punctuality",
              render: (v) => <StatusPill tone={v === "On time" ? "success" : v === "Not held" ? "danger" : "warning"}>{v}</StatusPill>,
            },
            { key: "present", label: "Present" },
            { key: "worklog", label: "Work log" },
          ]}
          rows={sessionRows}
          limit={10}
        />
      </Section>
    </DashboardFrame>
  );
}
