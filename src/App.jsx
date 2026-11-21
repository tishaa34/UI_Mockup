import { useState } from "react";
import * as db from "./data/db";
import { cn, SourceContext } from "./components/utils";
import OverviewDashboard from "./dashboards/OverviewDashboard";
import DepartmentDashboard from "./dashboards/DepartmentDashboard";
import InstituteDashboard from "./dashboards/InstituteDashboard";
import CourseDashboard from "./dashboards/CourseDashboard";
import InstructorDashboard from "./dashboards/InstructorDashboard";
import StudentDashboard from "./dashboards/StudentDashboard";
import BlockzieDashboard from "./dashboards/BlockzieDashboard";
import { instituteIdOfStudent, enrollments, blockzieIdOf } from "./data/selectors";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "department", label: "Department" },
  { id: "institute", label: "Institute" },
  { id: "course", label: "Course" },
  { id: "instructor", label: "Instructor" },
  { id: "student", label: "Student" },
  { id: "blockzie", label: "Blockzie & Devices" },
];

export default function App() {
  const [tab, setTab] = useState("overview");
  const [showSources, setShowSources] = useState(false);
  const [departmentId, setDepartmentId] = useState(db.departments[0].id);
  const [instituteId, setInstituteId] = useState(db.institutes[0].id);
  const [courseId, setCourseId] = useState(db.courses[0].id);
  const [courseDepartment, setCourseDepartment] = useState(null);
  const [instructorId, setInstructorId] = useState((db.instructors.find((i) => i.status) ?? db.instructors[0]).id);
  const [studentId, setStudentId] = useState(
    () => (db.students.find((s) => blockzieIdOf(s.id) && enrollments.filter((e) => e.userId === s.id).length >= 2) ?? db.students[0]).id
  );

  const openDepartment = (id) => {
    setDepartmentId(id);
    setTab("department");
  };
  const openCourseFromDepartment = (id) => {
    if (!id) return;
    setCourseId(id);
    setCourseDepartment(departmentId);
    setTab("course");
  };
  const openInstitute = (id) => {
    setInstituteId(id);
    setTab("institute");
  };
  const openStudent = (id) => {
    setStudentId(id);
    setTab("student");
  };
  const changeInstitute = (id) => {
    setInstituteId(id);
  };
  const changeStudent = (id) => {
    setStudentId(id);
    setInstituteId(instituteIdOfStudent.get(id));
  };

  return (
    <SourceContext.Provider value={showSources}>
      <div className="min-h-screen bg-[#f6f7fb] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "course") setCourseDepartment(null);
                  setTab(t.id);
                }}
                className={cn(
                  "px-4 py-2 rounded-2xl text-sm font-medium transition",
                  tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            Show data sources
          </label>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Sample data.</strong> Every number uses only fields that exist today: the LMS database, and the Blockzie
          database read through the <code className="font-mono">feat/blockzie-dashboard</code> branch. Turn on
          &ldquo;Show data sources&rdquo; to see the table behind each card.
        </div>

        {tab === "overview" && <OverviewDashboard onOpenDepartment={openDepartment} />}
        {tab === "department" && (
          <DepartmentDashboard
            key={departmentId}
            departmentId={departmentId}
            onDepartmentChange={setDepartmentId}
            onOpenCourse={openCourseFromDepartment}
            onOpenInstitute={openInstitute}
          />
        )}
        {tab === "institute" && (
          <InstituteDashboard instituteId={instituteId} onInstituteChange={changeInstitute} onOpenStudent={openStudent} />
        )}
        {tab === "course" && (
          <CourseDashboard
            courseId={courseId}
            departmentContext={courseDepartment}
            onCourseChange={(id, dept) => {
              setCourseId(id);
              if (dept !== undefined) setCourseDepartment(dept);
            }}
            onBackToDepartment={() => setTab("department")}
          />
        )}
        {tab === "instructor" && <InstructorDashboard instructorId={instructorId} onInstructorChange={setInstructorId} />}
        {tab === "student" && <StudentDashboard studentId={studentId} onStudentChange={changeStudent} />}
        {tab === "blockzie" && <BlockzieDashboard />}
      </div>
    </SourceContext.Provider>
  );
}
