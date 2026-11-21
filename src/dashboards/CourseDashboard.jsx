import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import * as db from "../data/db";
import {
  enrollments, summarizeEnrollments, monthlyTrend, courseById, userById, classById, pct, fmtDate,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, MiniStat, CsvButton
} from "../components/ui";
import { COLORS } from "../components/utils";

export default function CourseDashboard({ courseId, onCourseChange, departmentContext, onBackToDepartment }) {
  const course = courseById.get(courseId);

  const view = useMemo(() => {
    const rows = enrollments.filter((e) => e.courseId === courseId && (!departmentContext || e.departmentId === departmentContext));
    // Share of enrolled students who completed each lesson (from CompleteCurriculum).
    const funnel = Array.from({ length: course.lessonCount }, (_, i) => ({
      lesson: `L${i + 1}`,
      reached: pct(rows.filter((r) => r.lessonsDone >= i + 1).length, rows.length),
    }));
    return { rows, summary: summarizeEnrollments(rows), funnel, trend: monthlyTrend(rows) };
  }, [courseId, departmentContext, course.lessonCount]);

  const { rows, summary, funnel, trend } = view;
  const biggestDrop = funnel.reduce(
    (best, cur, i) => (i > 0 && funnel[i - 1].reached - cur.reached > best.drop ? { lesson: cur.lesson, drop: funnel[i - 1].reached - cur.reached } : best),
    { lesson: "—", drop: 0 }
  );
  const department = departmentContext ? userById.get(departmentContext) : null;

  const instituteRows = [...new Set(rows.map((r) => r.instituteId))].map((id) => {
    const inst = userById.get(id);
    const s = summarizeEnrollments(rows.filter((r) => r.instituteId === id));
    return {
      id,
      institute: inst.fullName,
      location: `${inst.city}, ${inst.state}`,
      students: s.students,
      inProgress: s.inProgress,
      completed: s.completed,
      completion: `${s.completionRate}%`,
      quiz: `${s.avgQuiz}%`,
      pendingTests: s.pendingTests,
    };
  });

  const learnerRows = [...rows]
    .sort((a, b) => b.lessonsDone - a.lessonsDone)
    .map((r) => ({
      id: r.id,
      name: r.student.fullName,
      institute: userById.get(r.instituteId).fullName,
      className: classById.get(r.classId)?.className,
      status: r.status,
      lessons: `${r.lessonsDone} / ${r.lessonCount}`,
      quiz: r.quizTotal ? `${pct(r.quizScore, r.quizTotal)}%` : "—",
      lastLesson: r.lastLessonDate ? fmtDate(r.lastLessonDate) : "—",
      certificate: r.certificate ? r.certificate.certificateId : "—",
      assigned: fmtDate(r.assignedDate),
    }));

  return (
    <DashboardFrame
      title={`Course: ${course.title}`}
      subtitle={`${course.courseCode} · ${course.chapterCount} chapters · ${course.lessonCount} lessons · ${course.passPercentage ? `pass mark ${course.passPercentage}%` : "no pass mark"}`}
      breadcrumb={department ? `Departments / ${department.fullName} / ${course.title}` : `Courses / ${course.title}`}
      filters={
        <>
          <FilterSelect label="Course" value={courseId} onChange={onCourseChange} options={db.courses.map((c) => ({ value: c.id, label: c.title }))} />
          <span className="px-4 py-2 rounded-2xl bg-white/15 text-white text-sm">Category: {course.categoryCourse.name}</span>
          <span className="px-4 py-2 rounded-2xl bg-white/15 text-white text-sm">Level: {course.courseLevel.levelName}</span>
          <span className="px-4 py-2 rounded-2xl bg-white/15 text-white text-sm">Language: {course.courseLanguage.language}</span>
        </>
      }
      headerAction={
        department ? (
          <button onClick={onBackToDepartment} data-html2canvas-ignore="true" className="px-4 py-2 rounded-2xl bg-indigo-950/20 text-white border border-white/20 shadow-sm font-medium">
            Back to department
          </button>
        ) : null
      }
    >
      {department ? (
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <StatusPill tone="info">Showing {department.fullName} only</StatusPill>
          <button className="text-indigo-700 font-medium hover:underline" onClick={() => onCourseChange(courseId, null)}>
            Show all departments
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Institutes" value={instituteRows.length} subtext="Running this course" source="AssignedCourses.instituteId" />
        <MetricCard title="Students" value={summary.students} subtext="Enrolled" source="AssignedCourses" />
        <MetricCard title="Completion" value={`${summary.completionRate}%`} subtext={`${summary.completed} certificates`} accent="text-emerald-700" source="Certificate" />
        <MetricCard title="Avg quiz score" value={`${summary.avgQuiz}%`} subtext={course.passPercentage ? `Pass mark ${course.passPercentage}%` : "No pass mark"} accent="text-violet-700" source={["QuizScore", "Course.passPercentage"]} />
        <MetricCard title="Rating" value={summary.avgRating} subtext={`${summary.ratingsCount} ratings`} accent="text-amber-700" source="Feedback.rating" />
        <MetricCard title="Tests to grade" value={summary.pendingTests} subtext="Submitted, not graded" accent="text-rose-700" source="CourseTestSubmission.status" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Lesson completion" subtitle={`Share of enrolled students who completed each lesson. Biggest drop: ${biggestDrop.lesson} (−${biggestDrop.drop} pts).`} source={["CompleteCurriculum", "CourseContent.contentSequence"]}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={funnel}>
                <XAxis dataKey="lesson" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Area isAnimationActive={false} type="monotone" dataKey="reached" name="Completed lesson" stroke={COLORS[0]} fill="#d7d8ff" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Learning status" source={["CompleteCurriculum", "Certificate"]}>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Not started" value={summary.notStarted} />
            <MiniStat label="In progress" value={summary.inProgress} accent="text-amber-700" />
            <MiniStat label="Completed" value={summary.completed} accent="text-emerald-700" />
            <MiniStat label="Lessons done" value={summary.lessonsDone} accent="text-indigo-700" />
          </div>
        </Section>
      </div>

      <Section title="Enrollments and certificates by month" source={["AssignedCourses.assignedDate", "Certificate.completedDate"]}>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar isAnimationActive={false} dataKey="enrollments" name="Enrollments" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="certificates" name="Certificates" fill={COLORS[2]} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Institutes running this course" source={["AssignedCourses", "Certificate", "QuizScore", "CourseTestSubmission"]} action={<CsvButton filename="course-institutes.csv" rows={instituteRows} />}>
        <DataTable
          columns={[
            { key: "institute", label: "Institute" },
            { key: "location", label: "City, State" },
            { key: "students", label: "Students" },
            { key: "inProgress", label: "In progress" },
            { key: "completed", label: "Completed" },
            { key: "completion", label: "Completion" },
            { key: "quiz", label: "Avg quiz" },
            { key: "pendingTests", label: "Tests to grade" },
          ]}
          rows={instituteRows}
        />
      </Section>

      <Section title="Students" subtitle="Progress, quiz score and certificate for each enrolled student." source={["AssignedCourses", "AssignedClass", "CompleteCurriculum", "QuizScore", "Certificate"]} action={<CsvButton filename="course-students.csv" rows={learnerRows} />}>
        <DataTable
          columns={[
            { key: "name", label: "Student" },
            { key: "institute", label: "Institute" },
            { key: "className", label: "Class" },
            {
              key: "status",
              label: "Status",
              render: (v) => <StatusPill tone={v === "Completed" ? "success" : v === "In Progress" ? "warning" : "default"}>{v}</StatusPill>,
            },
            { key: "lessons", label: "Lessons" },
            { key: "quiz", label: "Quiz score" },
            { key: "lastLesson", label: "Last lesson" },
            { key: "certificate", label: "Certificate" },
          ]}
          rows={learnerRows}
          limit={12}
        />
      </Section>
    </DashboardFrame>
  );
}
