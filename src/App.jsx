import { useState } from "react";
import * as db from "./data/db";
import { cn } from "./components/utils";
import OverviewDashboard from "./dashboards/OverviewDashboard";
import DepartmentDashboard from "./dashboards/DepartmentDashboard";
import InstituteDashboard from "./dashboards/InstituteDashboard";
import CourseDashboard from "./dashboards/CourseDashboard";
import InstructorDashboard from "./dashboards/InstructorDashboard";
import StudentDashboard from "./dashboards/StudentDashboard";
import BlockzieDashboard from "./dashboards/BlockzieDashboard";
import PresenceDashboard from "./dashboards/PresenceDashboard";
import TraineesView from "./dashboards/TraineesView";
import KcgDashboard from "./dashboards/KcgDashboard";
import { instituteIdOfStudent, enrollments, blockzieIdOf, schoolStudents, trainees } from "./data/selectors";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "department", label: "Department" },
  { id: "institute", label: "Institute" },
  { id: "course", label: "Course" },
  { id: "instructor", label: "Instructor" },
  { id: "student", label: "Student" },
  { id: "blockzie", label: "Blockzie & Devices" },
  { id: "kcg", label: "KCG Programme" },
  { id: "presence", label: "Online & Engagement", planned: true },
];

export default function App() {
  const [tab, setTab] = useState("overview");
  const [departmentId, setDepartmentId] = useState(db.departments[0].id);
  const [instituteId, setInstituteId] = useState(db.institutes[0].id);
  const [courseId, setCourseId] = useState(db.courses[0].id);
  const [courseDepartment, setCourseDepartment] = useState(null);
  const [instructorId, setInstructorId] = useState((db.instructors.find((i) => i.status) ?? db.instructors[0]).id);
  const [studentId, setStudentId] = useState(
    () => (schoolStudents.find((s) => blockzieIdOf(s.id) && enrollments.filter((e) => e.userId === s.id).length >= 2) ?? schoolStudents[0]).id
  );

  const [presenceScope, setPresenceScope] = useState("platform");
  const [studentView, setStudentView] = useState("students");
  const openPresence = (scope) => {
    setPresenceScope(scope);
    setTab("presence");
  };
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
    setStudentView("students");
    setTab("student");
    window.scrollTo({ top: 0 });
  };
  const changeInstitute = (id) => {
    setInstituteId(id);
  };
  const changeStudent = (id) => {
    setStudentId(id);
    setInstituteId(instituteIdOfStudent.get(id));
  };

  return (
      <div className="min-h-screen bg-[#f6f7fb] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "course") setCourseDepartment(null);
                  if (t.id === "presence") setPresenceScope("platform");
                  setTab(t.id);
                }}
                className={cn(
                  "px-4 py-2 rounded-2xl text-sm font-medium transition",
                  tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                )}
              >
                {t.label}
                {t.planned ? (
                  <span className={cn("ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold", tab === t.id ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800")}>
                    PLANNED
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Sample data.</strong> Cards use fields that exist today, except anything marked
          <strong> Planned</strong>: online presence and active/idle tracking, which are designed but not built yet.
        </div>

        {tab === "overview" && <OverviewDashboard onOpenDepartment={openDepartment} onOpenKcg={() => setTab("kcg")} />}
        {tab === "department" && (
          <DepartmentDashboard
            key={departmentId}
            departmentId={departmentId}
            onDepartmentChange={setDepartmentId}
            onOpenCourse={openCourseFromDepartment}
            onOpenInstitute={openInstitute}
            onOpenPresence={openPresence}
          />
        )}
        {tab === "institute" && (
          <InstituteDashboard
            instituteId={instituteId}
            onInstituteChange={changeInstitute}
            onOpenStudent={openStudent}
            onOpenPresence={openPresence}
          />
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
        {tab === "student" && (
          <>
            <div className="mb-5 inline-flex rounded-2xl bg-white p-1 shadow-sm border border-slate-100">
              {[
                { id: "students", label: "Students" },
                { id: "trainees", label: `Trainers in training (${trainees.length})` },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setStudentView(v.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition",
                    studentView === v.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {studentView === "students" ? (
              <StudentDashboard studentId={studentId} onStudentChange={changeStudent} />
            ) : (
              <TraineesView onOpenTrainee={openStudent} />
            )}
          </>
        )}
        {tab === "blockzie" && <BlockzieDashboard />}
        {tab === "kcg" && <KcgDashboard />}
        {tab === "presence" && <PresenceDashboard key={presenceScope} initialScope={presenceScope} />}
      </div>
  );
}
