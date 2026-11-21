import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import * as db from "../data/db";
import {
  trainees, enrollments, summarizeEnrollments, byCourse, classIdOfStudent, classById, instituteIdOfStudent, userById,
  lastLoginOf, loginsOf, studentAttendance, pct, fmtDate,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, CsvButton, EmptyState,
} from "../components/ui";
import { COLORS } from "../components/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Trainers who take courses as students (accounts like trainer1@gmail.com). */
export default function TraineesView({ onOpenTrainee }) {
  const [courseId, setCourseId] = useState("all");
  const [status, setStatus] = useState("all");

  const view = useMemo(() => {
    const ids = new Set(trainees.map((t) => t.id));
    const allRows = enrollments.filter((e) => ids.has(e.userId));
    const rows = allRows.filter((e) => (courseId === "all" || e.courseId === courseId) && (status === "all" || e.status === status));
    const activeThisWeek = trainees.filter((t) => loginsOf(t.id).some((l) => db.TODAY - l.loginTime <= WEEK_MS)).length;
    return { allRows, rows, summary: summarizeEnrollments(rows), courses: byCourse(rows), activeThisWeek };
  }, [courseId, status]);

  const { allRows, rows, summary, courses, activeThisWeek } = view;
  const courseOptions = db.courses.filter((c) => allRows.some((r) => r.courseId === c.id));

  const traineeRows = trainees
    .map((t) => {
      const mine = rows.filter((r) => r.userId === t.id);
      const s = summarizeEnrollments(mine);
      const lessons = mine.reduce((sum, r) => sum + r.lessonsDone, 0);
      const lessonTotal = mine.reduce((sum, r) => sum + r.lessonCount, 0);
      return {
        id: t.id,
        name: t.fullName,
        email: t.email,
        batch: classById.get(classIdOfStudent.get(t.id))?.className ?? "—",
        institute: userById.get(instituteIdOfStudent.get(t.id))?.fullName ?? "—",
        courses: mine.length,
        lessons: `${lessons} / ${lessonTotal}`,
        progress: lessonTotal ? `${pct(lessons, lessonTotal)}%` : "—",
        quiz: s.avgQuiz ? `${s.avgQuiz}%` : "—",
        certificates: s.completed,
        testsPending: s.pendingTests,
        attendance: `${studentAttendance(t.id).rate}%`,
        lastLogin: fmtDate(lastLoginOf(t.id)),
        status: t.status,
        _progress: lessonTotal ? lessons / lessonTotal : -1,
      };
    })
    .filter((r) => courseId === "all" && status === "all" ? true : r.courses > 0)
    .sort((a, b) => b._progress - a._progress);

  const exportRows = traineeRows.map(({ name, email, batch, courses: c, lessons, progress, quiz, certificates, testsPending, attendance, lastLogin }) => ({
    name, email, batch, courses: c, lessons, progress, quiz, certificates, testsPending, attendance, lastLogin,
  }));

  const courseRows = courses.map((c) => ({
    id: c.id,
    course: c.name,
    enrolled: c.enrollments,
    notStarted: c.notStarted,
    inProgress: c.inProgress,
    completed: c.completed,
    completion: `${c.completionRate}%`,
    quiz: `${c.avgQuiz}%`,
  }));

  return (
    <DashboardFrame
      title="Trainers in training"
      subtitle="Trainers taking STEMbotix courses as students, before they teach them in schools."
      breadcrumb="Students / Trainers in training"
      filters={
        <>
          <FilterSelect
            label="Course"
            value={courseId}
            onChange={setCourseId}
            options={[{ value: "all", label: "All courses" }, ...courseOptions.map((c) => ({ value: c.id, label: c.title }))]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              { value: "Completed", label: "Completed" },
              { value: "In Progress", label: "In progress" },
              { value: "Not Started", label: "Not started" },
            ]}
          />
        </>
      }
    >
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        <strong>Who is counted here:</strong> accounts with the <strong>Student</strong> role whose email is{" "}
        <code className="font-mono">trainer</code> followed by a number, e.g.{" "}
        <code className="font-mono">trainer1@gmail.com</code>, <code className="font-mono">trainer12@gmail.com</code>. They are
        left out of school student numbers on the other tabs.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Trainers in training" value={trainees.length} subtext={`${trainees.filter((t) => t.status).length} active accounts`} />
        <MetricCard title="Logged in this week" value={activeThisWeek} subtext={`${pct(activeThisWeek, trainees.length)}% of trainers`} accent="text-emerald-700" />
        <MetricCard title="Course enrollments" value={summary.enrollments} subtext={`${courses.length} courses`} />
        <MetricCard title="Completion" value={`${summary.completionRate}%`} subtext={`${summary.completed} certificates`} accent="text-emerald-700" />
        <MetricCard title="Avg quiz score" value={`${summary.avgQuiz}%`} accent="text-violet-700" />
        <MetricCard title="Tests to grade" value={summary.pendingTests} subtext="Submitted, not graded" accent="text-rose-700" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Progress by course" subtitle="How many trainers finished, are part-way, or haven't started each course.">
          {courses.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courses}>
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend formatter={(v) => <span className="text-slate-600">{v}</span>} />
                  <Bar isAnimationActive={false} dataKey="completed" name="Completed" stackId="s" fill={COLORS[2]} />
                  <Bar isAnimationActive={false} dataKey="inProgress" name="In progress" stackId="s" fill={COLORS[0]} />
                  <Bar isAnimationActive={false} dataKey="notStarted" name="Not started" stackId="s" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </Section>
        <Section title="Courses" subtitle="Per course, all trainers.">
          <DataTable
            columns={[
              { key: "course", label: "Course" },
              { key: "enrolled", label: "Enrolled" },
              { key: "completed", label: "Done" },
              { key: "completion", label: "Completion" },
            ]}
            rows={courseRows}
          />
        </Section>
      </div>

      <Section
        title="Trainers"
        subtitle="Click a name to open the trainer's full profile."
        action={<CsvButton filename="trainers-in-training.csv" rows={exportRows} />}
      >
        <DataTable
          columns={[
            {
              key: "name",
              label: "Trainer",
              render: (v, r) => (
                <button className="text-indigo-700 font-medium hover:underline text-left" onClick={() => onOpenTrainee(r.id)}>
                  {v}
                </button>
              ),
            },
            { key: "email", label: "Login email", render: (v) => <span className="font-mono text-xs">{v}</span> },
            { key: "batch", label: "Batch" },
            { key: "courses", label: "Courses" },
            { key: "lessons", label: "Lessons" },
            { key: "progress", label: "Progress" },
            { key: "quiz", label: "Avg quiz" },
            { key: "certificates", label: "Certificates" },
            { key: "testsPending", label: "Tests to grade" },
            { key: "attendance", label: "Attendance" },
            { key: "lastLogin", label: "Last login" },
            { key: "status", label: "Account", render: (v) => <StatusPill tone={v ? "success" : "danger"}>{v ? "Active" : "Inactive"}</StatusPill> },
          ]}
          rows={traineeRows}
        />
      </Section>
    </DashboardFrame>
  );
}
