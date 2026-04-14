import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["#5b5ff7", "#ff8a65", "#4db6ac", "#ffd54f", "#a78bfa", "#60a5fa"];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Card({ children, className = "" }) {
  return (
    <div className={cn("bg-white rounded-[24px] shadow-sm border border-slate-100", className)}>
      {children}
    </div>
  );
}

function CardBody({ children, className = "" }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

function StatusPill({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
    info: "bg-indigo-50 text-indigo-700",
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ title, value, subtext, accent = "text-indigo-700" }) {
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-slate-500">{title}</div>
        <div className={cn("text-3xl font-bold mt-2", accent)}>{value}</div>
        {subtext ? <div className="text-xs text-slate-500 mt-2">{subtext}</div> : null}
      </CardBody>
    </Card>
  );
}

function DemoTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="text-left font-medium py-3 pr-4 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-50 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="py-3 pr-4 align-top text-slate-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DownloadActionButton({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-sm font-medium shadow-sm hover:bg-indigo-100 transition"
    >
      {label}
    </button>
  );
}

function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printStudentPDF() {
  window.print();
}

function DashboardFrame({ title, subtitle, filters, headerAction, breadcrumb, children }) {
  const frameRef = useRef(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!frameRef.current || isExportingPdf) return;

    setIsExportingPdf(true);
    try {
      const canvas = await html2canvas(frameRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f6f7fb",
        windowWidth: frameRef.current.scrollWidth,
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imageHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      pdf.save(`${safeTitle || "dashboard"}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div ref={frameRef} className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 text-white p-8 rounded-[28px] shadow-md">
        {breadcrumb ? <div className="text-xs uppercase tracking-[0.24em] text-indigo-100 mb-4">{breadcrumb}</div> : null}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-sm opacity-90 mt-2 max-w-3xl">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {filters}
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
            >
              {isExportingPdf ? "Preparing PDF..." : "Download PDF"}
            </button>
            {headerAction}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* -------------------- SAMPLE DATA -------------------- */

const analyticsData = [
  {
    course: "AI Basics",
    city: "Ahmedabad",
    state: "Gujarat",
    institute: "STEM Public School",
    instructor: "Ravi Mehta",
    enroll: 180,
    complete: 150,
    timeSpent: 2.1,
    preScore: 55,
    postScore: 80,
    activeLearners: 132,
    rating: 4.7,
    month: "Jan",
  },
  {
    course: "AI Basics",
    city: "Surat",
    state: "Gujarat",
    institute: "Future Academy",
    instructor: "Priya Desai",
    enroll: 120,
    complete: 90,
    timeSpent: 2.0,
    preScore: 51,
    postScore: 76,
    activeLearners: 84,
    rating: 4.4,
    month: "Feb",
  },
  {
    course: "Robotics",
    city: "Ahmedabad",
    state: "Gujarat",
    institute: "STEM Public School",
    instructor: "Neha Shah",
    enroll: 130,
    complete: 70,
    timeSpent: 3.2,
    preScore: 40,
    postScore: 65,
    activeLearners: 74,
    rating: 4.4,
    month: "Jan",
  },
  {
    course: "Robotics",
    city: "Vadodara",
    state: "Gujarat",
    institute: "Innovation School",
    instructor: "Amit Joshi",
    enroll: 100,
    complete: 60,
    timeSpent: 2.8,
    preScore: 42,
    postScore: 60,
    activeLearners: 58,
    rating: 4.1,
    month: "Feb",
  },
  {
    course: "Physics",
    city: "Mumbai",
    state: "Maharashtra",
    institute: "Bright Future College",
    instructor: "Karan Patil",
    enroll: 90,
    complete: 70,
    timeSpent: 1.5,
    preScore: 60,
    postScore: 85,
    activeLearners: 69,
    rating: 4.5,
    month: "Jan",
  },
  {
    course: "Physics",
    city: "Pune",
    state: "Maharashtra",
    institute: "Scholars International",
    instructor: "Sneha Kulkarni",
    enroll: 110,
    complete: 80,
    timeSpent: 1.8,
    preScore: 58,
    postScore: 82,
    activeLearners: 77,
    rating: 4.3,
    month: "Feb",
  },
  {
    course: "Financial Literacy",
    city: "Mumbai",
    state: "Maharashtra",
    institute: "Bright Future College",
    instructor: "Karan Patil",
    enroll: 140,
    complete: 96,
    timeSpent: 2.7,
    preScore: 48,
    postScore: 76,
    activeLearners: 88,
    rating: 4.3,
    month: "Jan",
  },
  {
    course: "STEM Basics",
    city: "Pune",
    state: "Maharashtra",
    institute: "Scholars International",
    instructor: "Sneha Kulkarni",
    enroll: 110,
    complete: 72,
    timeSpent: 2.4,
    preScore: 50,
    postScore: 74,
    activeLearners: 66,
    rating: 4.2,
    month: "Feb",
  },
];

const trendData = [
  { period: "Jan", enrollments: 280, completions: 170, active: 190 },
  { period: "Feb", enrollments: 320, completions: 210, active: 225 },
  { period: "Mar", enrollments: 360, completions: 245, active: 250 },
  { period: "Apr", enrollments: 410, completions: 280, active: 290 },
  { period: "May", enrollments: 450, completions: 315, active: 330 },
  { period: "Jun", enrollments: 500, completions: 360, active: 370 },
];

const moduleData = [
  { module: "Module 1", type: "Content", completion: 92, score: 0, dropOff: 3 },
  { module: "Module 2", type: "Quiz", completion: 84, score: 76, dropOff: 6 },
  { module: "Module 3", type: "Assignment", completion: 63, score: 68, dropOff: 18 },
  { module: "Module 4", type: "Quiz", completion: 58, score: 64, dropOff: 22 },
];

const studentCourses = [
  {
    title: "AI and Robotics",
    status: "In Progress",
    progress: 65,
    time: "4h 20m",
    nextAction: "Continue Lesson 4",
    quiz: "88%",
    certificate: "Locked",
    report: "Download CSV",
  },
  {
    title: "Financial Literacy",
    status: "Completed",
    progress: 100,
    time: "12h 15m",
    nextAction: "Review Content",
    quiz: "92%",
    certificate: "Available",
    report: "Download CSV",
  },
  {
    title: "Blockzie",
    status: "Not Started",
    progress: 0,
    time: "0m",
    nextAction: "Start Lesson 1",
    quiz: "—",
    certificate: "Locked",
    report: "Download CSV",
  },
];

const progressBreakdown = [
  { activity: "Pre-Assessment Quiz", status: "Completed", modules: "—", score: "38 / 50", progress: 76 },
  { activity: "Chapter 1 Foundations", status: "Completed", modules: "4 / 4", score: "9 / 10", progress: 100 },
  { activity: "Chapter 2 Network Architecture", status: "Completed", modules: "4 / 4", score: "8 / 10", progress: 100 },
  { activity: "Chapter 3 Security Protocols", status: "In Progress", modules: "2 / 4", score: "0 / 10", progress: 50 },
  { activity: "Chapter 4 Cloud Integration", status: "Not Started", modules: "0 / 4", score: "0 / 10", progress: 0 },
];

const instituteDirectoryRows = [
  {
    institute: "STEM Public School",
    city: "Ahmedabad, Gujarat",
    board: "CBSE",
    trainer: "Neha Shah",
    students: 640,
    status: "Active",
  },
  {
    institute: "Future Academy",
    city: "Surat, Gujarat",
    board: "State",
    trainer: "Priya Desai",
    students: 430,
    status: "Active",
  },
  {
    institute: "Bright Future College",
    city: "Mumbai, Maharashtra",
    board: "ICSE",
    trainer: "Karan Patil",
    students: 510,
    status: "Inactive",
  },
];

const instructorRows = [
  {
    name: "Neha Shah",
    institutes: "12 institutes",
    students: 1240,
    completion: "78%",
    improvement: "+18%",
    lastLogin: "Today",
    status: "Active",
  },
  {
    name: "Ravi Mehta",
    institutes: "9 institutes",
    students: 980,
    completion: "74%",
    improvement: "+14%",
    lastLogin: "Today",
    status: "Active",
  },
  {
    name: "Priya Desai",
    institutes: "7 institutes",
    students: 820,
    completion: "69%",
    improvement: "+11%",
    lastLogin: "Yesterday",
    status: "Active",
  },
];

const departmentRows = [
  {
    name: "Yuva Unstoppable",
    courses: 5,
    instructors: 50,
    institutes: 200,
    students: 50000,
    status: "Active",
  },
];

const instituteMapRows = [
  { name: "STEM Public School", city: "Ahmedabad", trainer: "Neha Shah", students: 640, completion: "82%", improvement: "+22%" },
  { name: "Future Academy", city: "Surat", trainer: "Priya Desai", students: 430, completion: "74%", improvement: "+16%" },
  { name: "Innovation School", city: "Vadodara", trainer: "Amit Joshi", students: 290, completion: "61%", improvement: "+9%" },
];

const studentDirectoryRows = [
  { name: "Aarav Shah", institute: "STEM Public School", className: "Grade 8", lastLogin: "Today", status: "Active", completion: "85%", quiz: "89%", impact: "A" },
  { name: "Mahi Patel", institute: "Future Academy", className: "Grade 7", lastLogin: "4 days ago", status: "Active", completion: "63%", quiz: "77%", impact: "B" },
  { name: "Rohan Kulkarni", institute: "Innovation School", className: "Grade 9", lastLogin: "18 days ago", status: "Inactive", completion: "21%", quiz: "52%", impact: "C" },
];

const departmentName = "Yuva Unstoppable";

function getCourseBreakdown(rows) {
  return Object.values(
    rows.reduce((acc, curr) => {
      if (!acc[curr.course]) {
        acc[curr.course] = { name: curr.course, enroll: 0, complete: 0, scoreTotal: 0, count: 0 };
      }
      acc[curr.course].enroll += curr.enroll;
      acc[curr.course].complete += curr.complete;
      acc[curr.course].scoreTotal += curr.postScore;
      acc[curr.course].count += 1;
      return acc;
    }, {})
  ).map((course) => ({
    ...course,
    completionRate: course.enroll ? Math.round((course.complete / course.enroll) * 100) : 0,
    avgScore: course.count ? Math.round(course.scoreTotal / course.count) : 0,
  }));
}

/* -------------------- DASHBOARDS -------------------- */

function InsightsDashboard() {
  const [selectedCity, setSelectedCity] = useState("All");

  const filtered = useMemo(() => {
    return selectedCity === "All"
      ? analyticsData
      : analyticsData.filter((d) => d.city === selectedCity);
  }, [selectedCity]);

  const totalEnroll = filtered.reduce((a, b) => a + b.enroll, 0);
  const totalComplete = filtered.reduce((a, b) => a + b.complete, 0);

  const byCourse = Object.values(
    filtered.reduce((acc, curr) => {
      if (!acc[curr.course]) acc[curr.course] = { name: curr.course, enroll: 0, complete: 0 };
      acc[curr.course].enroll += curr.enroll;
      acc[curr.course].complete += curr.complete;
      return acc;
    }, {})
  );

  const byCity = Object.values(
    filtered.reduce((acc, curr) => {
      if (!acc[curr.city]) acc[curr.city] = { name: curr.city, value: 0 };
      acc[curr.city].value += curr.enroll;
      return acc;
    }, {})
  );

  return (
    <DashboardFrame
      title="Insights Dashboard 🚀"
      subtitle="Cross-functional overview of learning performance, engagement, course adoption, and regional reach."
      filters={
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm min-w-[160px]"
        >
          <option value="All">All Cities</option>
          {[...new Set(analyticsData.map((d) => d.city))].map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>
      }
      headerAction={
        <button
          onClick={() => downloadCSV("insights-report.csv", filtered)}
          className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
        >
          Download Insights CSV
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Enrollments" value={totalEnroll} subtext="Filtered total" />
        <MetricCard title="Completions" value={totalComplete} subtext="Filtered total" accent="text-emerald-700" />
        <MetricCard
          title="Completion Rate"
          value={`${totalEnroll ? Math.round((totalComplete / totalEnroll) * 100) : 0}%`}
          subtext="Overall"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <SectionTitle title="Course Performance" subtitle="Enrollments vs completions by course." />
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCourse}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="enroll" fill="#5b5ff7" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="complete" fill="#ff8a65" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionTitle title="Location Distribution" subtitle="Enrollment distribution by city." />
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCity} dataKey="value" nameKey="name" outerRadius={95}>
                    {byCity.map((item, idx) => (
                      <Cell key={item.name} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
    </DashboardFrame>
  );
}

function CourseDashboard({ selectedCourse, departmentContext, onBackToDepartment }) {
  const rows = analyticsData.filter((r) => r.course === selectedCourse);
  const activeCourse = rows[0]?.course || selectedCourse || analyticsData[0]?.course || "Course";

  const totals = rows.reduce(
    (acc, curr) => {
      acc.institutes.add(curr.institute);
      acc.instructors.add(curr.instructor);
      acc.students += curr.enroll;
      acc.completions += curr.complete;
      acc.rating += curr.rating;
      acc.active += curr.activeLearners;
      acc.count += 1;
      return acc;
    },
    { institutes: new Set(), instructors: new Set(), students: 0, completions: 0, rating: 0, active: 0, count: 0 }
  );

  const averageTimeSpent = totals.count ? (rows.reduce((sum, row) => sum + row.timeSpent, 0) / totals.count).toFixed(1) : "0.0";
  const averageQuizScore = totals.count ? Math.round(rows.reduce((sum, row) => sum + row.postScore, 0) / totals.count) : 0;
  const inProgressCount = Math.max(Math.round((totals.students - totals.completions) * 0.7), 0);
  const notStartedCount = Math.max(totals.students - totals.completions - inProgressCount, 0);
  const courseTrendData = rows.map((row) => ({ period: row.month, active: row.activeLearners }));

  const instituteRows = rows.map((row) => ({
    institute: row.institute,
    city: `${row.city}, ${row.state}`,
    instructor: row.instructor,
    students: row.enroll,
    progress: `${Math.round((row.complete / row.enroll) * 100)}%`,
    score: `${row.postScore}%`,
    completion: `${Math.round((row.complete / row.enroll) * 100)}%`,
  }));

  const courseInstructorRows = rows.map((row) => ({
    name: row.instructor,
    institute: row.institute,
    students: row.enroll,
    backlog: Math.max(2, Math.round((row.enroll - row.complete) / 12)),
    lastLogin: "Today, 10:45 AM",
  }));

  const learnerRows = rows.map((row, idx) => ({
    name: ["Aarav Shah", "Mahi Patel", "Dhruv Joshi"][idx] || `Student ${idx + 1}`,
    institute: row.institute,
    className: `Grade ${8 + idx}`,
    status: idx === 0 ? "Completed" : idx === 1 ? "In Progress" : "Not Started",
    modulesDone: idx === 0 ? "32/32" : idx === 1 ? "20/32" : "0/32",
    grade: `${row.postScore}%`,
    timeSpent: `${row.timeSpent} hrs`,
    lastActivity: idx === 0 ? "Today" : "2 days ago",
  }));

  return (
    <DashboardFrame
      title={`Course Dashboard - ${activeCourse}`}
      subtitle="Detailed performance view for the selected course, including institute, instructor, and student-level detail."
      breadcrumb={departmentContext ? `Departments / ${departmentContext} / ${activeCourse}` : `Courses / ${activeCourse}`}
      filters={
        <>
          {departmentContext ? (
            <button className="px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 shadow-sm">{`Department: ${departmentContext}`}</button>
          ) : null}
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Category: STEM</button>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Level: Beginner</button>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Language: English</button>
        </>
      }
      headerAction={
        <>
          {departmentContext ? (
            <button
              onClick={onBackToDepartment}
              className="px-4 py-2 rounded-2xl bg-indigo-950/20 text-white border border-white/20 shadow-sm font-medium"
            >
              Back to Department
            </button>
          ) : null}
          <button
            onClick={() => downloadCSV("course-dashboard.csv", rows)}
            className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
          >
            Download Course CSV
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard title="Institutes" value={totals.institutes.size} subtext="Running this course" />
        <MetricCard title="Instructors" value={totals.instructors.size} subtext="Assigned facilitators" />
        <MetricCard title="Students" value={totals.students} subtext="Total enrolled learners" />
        <MetricCard
          title="Completion Rate"
          value={`${totals.students ? Math.round((totals.completions / totals.students) * 100) : 0}%`}
          subtext="Overall course completion"
          accent="text-emerald-700"
        />
        <MetricCard title="Active Learners" value={totals.active} subtext="Recent engaged learners" accent="text-violet-700" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardBody>
            <SectionTitle title="Course Health Snapshot" subtitle="Progress status, engagement, and performance." />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Not Started</div><div className="text-2xl font-bold mt-2">{notStartedCount}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">In Progress</div><div className="text-2xl font-bold mt-2 text-amber-700">{inProgressCount}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Completed</div><div className="text-2xl font-bold mt-2 text-emerald-700">{totals.completions}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Avg Time</div><div className="text-2xl font-bold mt-2 text-indigo-700">{averageTimeSpent}h</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-sm text-slate-500">Final Quiz</div><div className="text-2xl font-bold mt-2 text-violet-700">{averageQuizScore}%</div></div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={courseTrendData}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="active" stroke="#5b5ff7" fill="#d7d8ff" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionTitle title="Quick Indicators" subtitle="Low completion and module risk flags." />
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-rose-50">
                <div className="font-medium text-rose-700">Module 4 quiz failure rate high</div>
                <div className="text-sm text-rose-600 mt-1">Needs review and content simplification.</div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50">
                <div className="font-medium text-amber-700">Module 3 drop-off at 18%</div>
                <div className="text-sm text-amber-600 mt-1">Assignment stage causing learner slowdown.</div>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-50">
                <div className="font-medium text-indigo-700">Last 30-day active learners</div>
                <div className="text-sm text-indigo-600 mt-1">{totals.active} active learners remain engaged.</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Content & Assessment Status"
            subtitle="Module name, type, completion, score, and drop-off points."
            action={<DownloadActionButton onClick={() => downloadCSV("course-content-assessment.csv", moduleData)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "module", label: "Module" },
              { key: "type", label: "Type" },
              { key: "completion", label: "Completion %", render: (v) => `${v}%` },
              { key: "score", label: "Avg Score", render: (v) => (v ? `${v}%` : "-") },
              { key: "dropOff", label: "Drop-off", render: (v) => `${v}%` },
            ]}
            rows={moduleData}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle
            title="Institutes Running This Course"
            subtitle="Institute, location, instructor, student count, and completion."
            action={<DownloadActionButton onClick={() => downloadCSV("course-institutes.csv", instituteRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "institute", label: "Institute" },
              { key: "city", label: "City / State" },
              { key: "instructor", label: "Assigned Instructor" },
              { key: "students", label: "Student Count" },
              { key: "progress", label: "Avg Progress" },
              { key: "score", label: "Avg Score" },
              { key: "completion", label: "Completion Rate" },
            ]}
            rows={instituteRows}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle
            title="Instructors for This Course"
            subtitle="Track instructor load, backlog, and recent activity."
            action={<DownloadActionButton onClick={() => downloadCSV("course-instructors.csv", courseInstructorRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "name", label: "Instructor Name" },
              { key: "institute", label: "Institute" },
              { key: "students", label: "Student Count" },
              { key: "backlog", label: "Grading Backlog" },
              { key: "lastLogin", label: "Last Login" },
            ]}
            rows={courseInstructorRows}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle
            title="Student Enrollment & Performance"
            subtitle="Student name, institute, class, status, modules, grade, time spent, and last activity."
            action={<DownloadActionButton onClick={() => downloadCSV("course-students.csv", learnerRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "name", label: "Student Name" },
              { key: "institute", label: "Institute" },
              { key: "className", label: "Class" },
              {
                key: "status",
                label: "Status",
                render: (v) => (
                  <StatusPill tone={v === "Completed" ? "success" : v === "In Progress" ? "warning" : "default"}>
                    {v}
                  </StatusPill>
                ),
              },
              { key: "modulesDone", label: "Modules Done" },
              { key: "grade", label: "Current Grade" },
              { key: "timeSpent", label: "Time Spent" },
              { key: "lastActivity", label: "Last Activity" },
            ]}
            rows={learnerRows}
          />
        </CardBody>
      </Card>
    </DashboardFrame>
  );
}

function StudentDashboard() {
  return (
    <DashboardFrame
      title="Student Dashboard — Aarav Shah"
      subtitle="Student header section, course list, and detailed progress report."
      filters={
        <>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Institute: STEM Public School</button>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Instructor: Neha Shah</button>
        </>
      }
      headerAction={
        <button
          onClick={printStudentPDF}
          className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
        >
          Download Student PDF
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardBody>
            <SectionTitle title="Student Header" subtitle="Identity, enrollment, login, and overall performance." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3 text-slate-600">
                <div><span className="font-medium text-slate-800">LMS ID:</span> LMS-10021</div>
                <div><span className="font-medium text-slate-800">Email:</span> aarav.shah@example.com</div>
                <div><span className="font-medium text-slate-800">Phone:</span> +91 98765 43210</div>
                <div><span className="font-medium text-slate-800">Enrollment Date:</span> 07 Feb 2026</div>
                <div><span className="font-medium text-slate-800">Last Login:</span> Today, 09:35 AM</div>
                <div><span className="font-medium text-slate-800">Status:</span> <StatusPill tone="success">Active</StatusPill></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500 text-xs">Total Learning Time</p>
                  <div className="text-2xl font-bold text-indigo-700 mt-2">16h 35m</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500 text-xs">Login Streak</p>
                  <div className="text-2xl font-bold text-violet-700 mt-2">8 days</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500 text-xs">Overall Completion</p>
                  <div className="text-2xl font-bold text-emerald-700 mt-2">72%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-slate-500 text-xs">Avg Quiz Score</p>
                  <div className="text-2xl font-bold text-amber-700 mt-2">89%</div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionTitle title="Overall Course Split" subtitle="Assigned, in progress, completed, not started." />
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Completed", value: 1 },
                      { name: "In Progress", value: 1 },
                      { name: "Not Started", value: 1 },
                    ]}
                    dataKey="value"
                    outerRadius={90}
                  >
                    <Cell fill="#4db6ac" />
                    <Cell fill="#5b5ff7" />
                    <Cell fill="#ffd54f" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Course List"
            subtitle="Course title, status, progress, time spent, next action, quiz, certificate, and progress report."
            action={<DownloadActionButton onClick={() => downloadCSV("student-course-list.csv", studentCourses)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "title", label: "Course Title" },
              {
                key: "status",
                label: "Status",
                render: (v) => (
                  <StatusPill tone={v === "Completed" ? "success" : v === "In Progress" ? "info" : "default"}>
                    {v}
                  </StatusPill>
                ),
              },
              { key: "progress", label: "Progress", render: (v) => `${v}%` },
              { key: "time", label: "Time Spent" },
              { key: "nextAction", label: "Next Action" },
              { key: "quiz", label: "Quiz" },
              { key: "certificate", label: "Certificate" },
              { key: "report", label: "Progress Report", render: (v) => <button className="text-indigo-700 font-medium">{v}</button> },
            ]}
            rows={studentCourses}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1">
          <CardBody>
            <SectionTitle title="Progress Report Summary" subtitle="Printable report summary." />
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
              <div><span className="font-medium text-slate-800">User Name:</span> Aarav Shah</div>
              <div><span className="font-medium text-slate-800">Course Name:</span> AI and Robotics</div>
              <div><span className="font-medium text-slate-800">Report Date:</span> 07 Feb 2026</div>
              <div><span className="font-medium text-slate-800">Overall Completion:</span> 85%</div>
              <div><span className="font-medium text-slate-800">Total Time Invested:</span> 14h 22m</div>
              <div><span className="font-medium text-slate-800">Pre-Assessment Score:</span> 65%</div>
              <div><span className="font-medium text-slate-800">Chapters Completed:</span> 3 / 8</div>
              <div><span className="font-medium text-slate-800">Modules Completed:</span> 14 / 32</div>
              <div><span className="font-medium text-slate-800">Post-Assessment Status:</span> Locked</div>
            </div>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardBody>
            <SectionTitle
              title="Detailed Activity Breakdown"
              subtitle="Activity/chapter-wise status, modules, score, and progress."
              action={<DownloadActionButton onClick={() => downloadCSV("student-activity-breakdown.csv", progressBreakdown)} label="Download CSV" />}
            />
            <DemoTable
              columns={[
                { key: "activity", label: "Activity / Chapter" },
                {
                  key: "status",
                  label: "Status",
                  render: (v) => (
                    <StatusPill tone={v === "Completed" ? "success" : v === "In Progress" ? "warning" : "default"}>
                      {v}
                    </StatusPill>
                  ),
                },
                { key: "modules", label: "Modules Completed" },
                { key: "score", label: "Score" },
                { key: "progress", label: "Progress %", render: (v) => `${v}%` },
              ]}
              rows={progressBreakdown}
            />
          </CardBody>
        </Card>
      </div>
    </DashboardFrame>
  );
}

function DepartmentDashboard({ selectedCourse, onOpenCourse }) {
  const courseBreakdown = useMemo(() => getCourseBreakdown(analyticsData), []);
  const totalStudents = analyticsData.reduce((sum, row) => sum + row.enroll, 0);
  const totalCompletions = analyticsData.reduce((sum, row) => sum + row.complete, 0);
  const instructorCount = new Set(analyticsData.map((row) => row.instructor)).size;
  const instituteCount = new Set(analyticsData.map((row) => row.institute)).size;
  const summaryRow = [
    {
      name: departmentName,
      courses: courseBreakdown.length,
      instructors: instructorCount,
      institutes: instituteCount,
      students: totalStudents,
      status: "Active",
    },
  ];
  return (
    <DashboardFrame
      title={`Department Dashboard - ${departmentName}`}
      subtitle="Department overview with course drilldown, institute coverage, instructor performance, and student-level detail."
      breadcrumb={`Departments / ${departmentName}`}
      filters={
        <>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Quarter: Q1</button>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">State: Gujarat + Maharashtra</button>
          <button className="px-4 py-2 rounded-2xl bg-emerald-50 text-emerald-700 shadow-sm">Status: Active</button>
        </>
      }
      headerAction={
        <button
          onClick={() => downloadCSV("department-report.csv", summaryRow)}
          className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
        >
          Download Department CSV
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard title="Courses Assigned" value={courseBreakdown.length} subtext="Across partner ecosystem" />
        <MetricCard title="Instructors" value={instructorCount} subtext="Active trainers" />
        <MetricCard title="Institutes" value={instituteCount} subtext="Mapped institutes" />
        <MetricCard title="Total Students" value={totalStudents} subtext="Enrolled students" />
        <MetricCard title="Avg Completion" value={`${Math.round((totalCompletions / totalStudents) * 100)}%`} subtext="Department-wide" accent="text-emerald-700" />
        <MetricCard title="Status" value="Active" subtext="Master toggle enabled" accent="text-violet-700" />
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Department Master Overview"
            subtitle="Summary of assigned courses, institutes, instructors, and students."
            action={
              <div className="flex flex-wrap gap-2 justify-end">
                <DownloadActionButton onClick={() => downloadCSV("department-master-overview.csv", summaryRow)} label="Download CSV" />
                <button className="px-4 py-2 rounded-2xl bg-rose-50 text-rose-700 text-sm">Disable Department</button>
              </div>
            }
          />
          <DemoTable
            columns={[
              { key: "name", label: "Department Name" },
              { key: "courses", label: "Courses Assigned" },
              { key: "instructors", label: "Instructors" },
              { key: "institutes", label: "Institutes" },
              { key: "students", label: "Total Students" },
              { key: "status", label: "Status", render: (v) => <StatusPill tone="success">{v}</StatusPill> },
            ]}
            rows={summaryRow}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <SectionTitle title="Course Performance" subtitle="Enrollments vs completions by course." />
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseBreakdown}>
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    name="Enrollments"
                    dataKey="enroll"
                    fill="#5b5ff7"
                    radius={[8, 8, 0, 0]}
                    onClick={(data) => onOpenCourse(data?.name || data?.payload?.name)}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="right"
                    name="Completion %"
                    dataKey="completionRate"
                    fill="#ff8a65"
                    radius={[8, 8, 0, 0]}
                    onClick={(data) => onOpenCourse(data?.name || data?.payload?.name)}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionTitle
              title="Institute Map / List"
              subtitle="Institute name, city, trainer, student count, completion, and improvement."
              action={<DownloadActionButton onClick={() => downloadCSV("department-institute-list.csv", instituteMapRows)} label="Download CSV" />}
            />
            <DemoTable
              columns={[
                { key: "name", label: "Institute" },
                { key: "city", label: "City" },
                { key: "trainer", label: "Assigned Trainer" },
                { key: "students", label: "Students" },
                { key: "completion", label: "Avg Completion" },
                { key: "improvement", label: "Score Improvement" },
              ]}
              rows={instituteMapRows}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Instructor Leaderboard"
            subtitle="Instructor name, institutes, students, completion, improvement, last login, and status."
            action={<DownloadActionButton onClick={() => downloadCSV("department-instructors.csv", instructorRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "name", label: "Instructor Name" },
              { key: "institutes", label: "Assigned Institutes" },
              { key: "students", label: "Students" },
              { key: "completion", label: "Avg Completion" },
              { key: "improvement", label: "Avg Improvement" },
              { key: "lastLogin", label: "Last Login" },
              { key: "status", label: "Status", render: (v) => <StatusPill tone="success">{v}</StatusPill> },
            ]}
            rows={instructorRows}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle
            title="Student Directory"
            subtitle="Student name, institute, class, last login, status, completion, quiz score, and impact grade."
            action={<DownloadActionButton onClick={() => downloadCSV("department-student-directory.csv", studentDirectoryRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "name", label: "Student Name" },
              { key: "institute", label: "Institute" },
              { key: "className", label: "Class / Section" },
              { key: "lastLogin", label: "Last Login" },
              {
                key: "status",
                label: "Status",
                render: (v) => <StatusPill tone={v === "Active" ? "success" : "danger"}>{v}</StatusPill>,
              },
              { key: "completion", label: "Completion %" },
              { key: "quiz", label: "Avg Quiz Score" },
              {
                key: "impact",
                label: "Impact Grade",
                render: (v) => (
                  <StatusPill tone={v === "A" ? "success" : v === "B" ? "warning" : "danger"}>
                    {v}
                  </StatusPill>
                ),
              },
            ]}
            rows={studentDirectoryRows}
          />
        </CardBody>
      </Card>
    </DashboardFrame>
  );
}

function InstituteDashboard() {
  return (
    <DashboardFrame
      title="Institute Dashboard"
      subtitle="Institute profile, management actions, assignments, student drill-down, and downloadable institute reporting."
      filters={
        <>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Region Split: Gujarat / Maharashtra</button>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Board Type</button>
        </>
      }
      headerAction={
        <button
          onClick={() => downloadCSV("institute-report.csv", instituteDirectoryRows)}
          className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
        >
          Download Institute CSV
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard title="Institutes" value="3" subtext="Demo list" />
        <MetricCard title="Active Institutes" value="2" subtext="Enabled" accent="text-emerald-700" />
        <MetricCard title="Assigned Trainers" value="3" subtext="Responsible instructors" />
        <MetricCard title="Students Enrolled" value="1,580" subtext="Across listed institutes" />
        <MetricCard title="Top Board" value="CBSE" subtext="Largest represented board" accent="text-violet-700" />
        <MetricCard title="Export Type" value="CSV" subtext="Institute report" accent="text-amber-700" />
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Institute Master List"
            subtitle="Institute name, city/state, board, trainer, students, and active status."
            action={<DownloadActionButton onClick={() => downloadCSV("institute-master-list.csv", instituteDirectoryRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "institute", label: "Institute Name" },
              { key: "city", label: "City / State" },
              { key: "board", label: "Board / Type" },
              { key: "trainer", label: "Assigned Trainer" },
              { key: "students", label: "Students Enrolled" },
              {
                key: "status",
                label: "Status",
                render: (v) => <StatusPill tone={v === "Active" ? "success" : "danger"}>{v}</StatusPill>,
              },
            ]}
            rows={instituteDirectoryRows}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <SectionTitle title="Management & Configuration" subtitle="Admin actions for institute-level governance." />
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-slate-100 text-slate-700">Edit Institute Info</button>
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-rose-50 text-rose-700">Change Status</button>
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-indigo-50 text-indigo-700">Assign Instructor</button>
              <button className="w-full text-left px-4 py-3 rounded-2xl bg-violet-50 text-violet-700">Assign Course</button>
            </div>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardBody>
            <SectionTitle title="Bulk Upload Tool" subtitle="Download template → fill data → upload → validation → success." />
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-center text-sm">
              {["Download Template", "Fill Data", "Upload File", "Validation Check", "Success"].map((step, index) => (
                <div key={step} className="rounded-2xl bg-slate-50 p-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mx-auto mb-2">
                    {index + 1}
                  </div>
                  <div className="font-medium text-slate-700">{step}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Students Enrolled (Drill-down)"
            subtitle="Student-level institute report with CSV export fields."
            action={
              <DownloadActionButton onClick={() => downloadCSV("students-institute-report.csv", studentDirectoryRows)} label="Download CSV" />
            }
          />
          <DemoTable
            columns={[
              { key: "name", label: "Student Name" },
              { key: "className", label: "Class / Section" },
              { key: "institute", label: "Institute" },
              { key: "lastLogin", label: "Last Login" },
              {
                key: "status",
                label: "Status",
                render: (v) => <StatusPill tone={v === "Active" ? "success" : "danger"}>{v}</StatusPill>,
              },
              { key: "completion", label: "Completion %" },
              { key: "quiz", label: "Avg Quiz Score" },
              {
                key: "impact",
                label: "Impact Grade",
                render: (v) => (
                  <StatusPill tone={v === "A" ? "success" : v === "B" ? "warning" : "danger"}>
                    {v}
                  </StatusPill>
                ),
              },
            ]}
            rows={studentDirectoryRows}
          />
        </CardBody>
      </Card>
    </DashboardFrame>
  );
}

function InstructorDashboard() {
  return (
    <DashboardFrame
      title="Instructor Dashboard"
      subtitle="Instructor summary, student load, completion, grading backlog, and last login."
      filters={
        <>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Department: STEM</button>
          <button className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm">Quarter: Q1</button>
        </>
      }
      headerAction={
        <button
          onClick={() => downloadCSV("instructor-dashboard.csv", instructorRows)}
          className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
        >
          Download Instructor CSV
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Instructors" value={instructorRows.length} subtext="Visible in leaderboard" />
        <MetricCard title="Total Students" value={instructorRows.reduce((a, b) => a + b.students, 0)} subtext="Across listed instructors" />
        <MetricCard title="Avg Completion" value="74%" subtext="Blended completion" accent="text-emerald-700" />
        <MetricCard title="Active Status" value="100%" subtext="All listed instructors active" accent="text-violet-700" />
      </div>

      <Card>
        <CardBody>
          <SectionTitle
            title="Instructor Leaderboard"
            subtitle="Instructor, institute load, students, completion, improvement, and activity."
            action={<DownloadActionButton onClick={() => downloadCSV("instructor-leaderboard.csv", instructorRows)} label="Download CSV" />}
          />
          <DemoTable
            columns={[
              { key: "name", label: "Instructor Name" },
              { key: "institutes", label: "Assigned Institutes" },
              { key: "students", label: "Students" },
              { key: "completion", label: "Avg Completion" },
              { key: "improvement", label: "Avg Improvement" },
              { key: "lastLogin", label: "Last Login" },
              {
                key: "status",
                label: "Status",
                render: (v) => <StatusPill tone="success">{v}</StatusPill>,
              },
            ]}
            rows={instructorRows}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle title="Instructor Load Distribution" subtitle="Student count handled by each instructor." />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instructorRows}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill="#5b5ff7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </DashboardFrame>
  );
}

/* -------------------- MAIN APP -------------------- */

const tabs = ["insights", "course", "student", "department", "institute", "instructor"];

export default function App() {
  const [tab, setTab] = useState("insights");
  const [selectedCourse, setSelectedCourse] = useState(analyticsData[0]?.course ?? "");

  const openDepartmentCourse = (courseName) => {
    if (!courseName) return;
    setSelectedCourse(courseName);
    setTab("course");
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-5 md:p-6">
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-2xl text-sm font-medium capitalize transition",
              tab === t ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-200 text-slate-800"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "insights" && <InsightsDashboard />}
      {tab === "course" && (
        <CourseDashboard
          selectedCourse={selectedCourse}
          departmentContext={departmentName}
          onBackToDepartment={() => setTab("department")}
        />
      )}
      {tab === "student" && <StudentDashboard />}
      {tab === "department" && (
        <DepartmentDashboard selectedCourse={selectedCourse} onOpenCourse={openDepartmentCourse} />
      )}
      {tab === "institute" && <InstituteDashboard />}
      {tab === "instructor" && <InstructorDashboard />}
    </div>
  );
}
