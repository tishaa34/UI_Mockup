import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import * as db from "../data/db";
import {
  enrollments, summarizeEnrollments, monthlyTrend, sessions, summarizeSessions, blockzieFor, countBy, transportLabel,
  institutesOfDepartment, pct, fmtNum, fmtINR, fmtDuration, fmtDate, trainees, schoolStudents, monthKey, MONTHS,
} from "../data/selectors";
import {
  DashboardFrame, MetricCard, Section, GroupLabel, DataTable, StatusPill
} from "../components/ui";
import { COLORS } from "../components/utils";

export default function OverviewDashboard({ onOpenDepartment }) {
  const data = useMemo(() => {
    const learning = summarizeEnrollments(enrollments);
    const field = summarizeSessions(sessions);
    const blockzie = blockzieFor(db.students.map((s) => s.id));
    const openTickets = db.query.filter((q) => q.status !== "Resolved");
    const successOrders = db.orders.filter((o) => o.status === "SUCCESS");
    const cities = new Set(db.institutes.map((i) => i.city.trim().toLowerCase()));
    const trend = monthlyTrend(enrollments, {
      logins: (m) => db.loginLogs.filter((l) => monthKey(l.loginTime) === m).length,
      deviceConnections: (m) => db.bluetoothSessions.filter((s) => monthKey(s.connectedAt) === m).length,
    });
    const departmentRows = db.departments.map((d) => {
      const instIds = institutesOfDepartment(d.id).map((i) => i.id);
      const rows = enrollments.filter((e) => instIds.includes(e.instituteId));
      const s = summarizeEnrollments(rows);
      const studentIds = db.assignedStudent.filter((a) => instIds.includes(a.instituteId)).map((a) => a.studentId);
      const f = summarizeSessions(sessions.filter((x) => instIds.includes(x.instituteId)));
      const b = blockzieFor(studentIds);
      return {
        id: d.id,
        name: d.fullName,
        state: d.state,
        institutes: instIds.length,
        students: studentIds.length,
        enrollments: s.enrollments,
        completion: `${s.completionRate}%`,
        quiz: `${s.avgQuiz}%`,
        attendance: `${f.attendanceRate}%`,
        devices: b.devices.length,
      };
    });
    return { learning, field, blockzie, openTickets, successOrders, cities, trend, departmentRows };
  }, []);

  const { learning, field, blockzie, openTickets, successOrders, cities, trend, departmentRows } = data;
  const transportSplit = countBy(blockzie.devices, (d) => transportLabel(d.transport));
  const ticketSplit = countBy(db.query, (q) => q.status.replace("_", " "));
  const leadSplit = countBy(db.leads, (l) => l.type.replace("_", " "));
  const thisMonth = MONTHS[MONTHS.length - 1];

  return (
    <DashboardFrame
      title="STEMbotix Ecosystem Overview"
      subtitle="One view of reach, learning, trainers in schools, Blockzie and device use, support, and website sales. For the STEMbotix team only."
      breadcrumb="Platform / Overview"
    >
      <GroupLabel>Reach</GroupLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Departments" value={db.departments.length} subtext="Partner programmes" source="Users (scopeType = DEPARTMENT)" />
        <MetricCard title="Institutes" value={db.institutes.length} subtext={`${db.institutes.filter((i) => i.status).length} active`} source="Users (INSTITUTE) · AssignedDepartment" />
        <MetricCard title="Instructors" value={db.instructors.length} subtext="Assigned to schools" source="Users (INSTRUCTOR) · AssignedInstructor" />
        <MetricCard title="Students" value={fmtNum(schoolStudents.length)} subtext={`+ ${trainees.length} trainers in training`} source="Users (STUDENT) · AssignedStudent" />
        <MetricCard title="Cities" value={cities.size} subtext={`${new Set(db.institutes.map((i) => i.state)).size} states`} source="Users.city · Users.state" />
      </div>

      <GroupLabel>Learning</GroupLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Courses" value={db.courses.length} subtext="Published" source="Course" />
        <MetricCard title="Enrollments" value={fmtNum(learning.enrollments)} subtext={`${fmtNum(learning.students)} students`} source="AssignedCourses" />
        <MetricCard title="Certificates" value={fmtNum(learning.completed)} subtext={`${learning.completionRate}% completion`} accent="text-emerald-700" source="Certificate" />
        <MetricCard title="Avg quiz score" value={`${learning.avgQuiz}%`} subtext="Across all quiz attempts" accent="text-violet-700" source="QuizScore" />
        <MetricCard title="Course rating" value={learning.avgRating} subtext={`${learning.ratingsCount} ratings`} accent="text-amber-700" source="Feedback.rating" />
      </div>

      <GroupLabel>Trainers in schools</GroupLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Sessions held" value={fmtNum(field.held)} subtext={`of ${fmtNum(field.scheduled)} scheduled`} source="Schedule · CheckInOutLog" />
        <MetricCard title="On-time check-in" value={`${field.onTimeRate}%`} subtext="Within 10 min of start" accent="text-emerald-700" source="CheckInOutLog.checkInTime" />
        <MetricCard title="Work logs filed" value={`${field.worklogRate}%`} subtext={`${fmtNum(field.worklogs)} logs`} source="Worklogs" />
        <MetricCard title="Student attendance" value={`${field.attendanceRate}%`} subtext="In sessions held" accent="text-violet-700" source="AttendanceLogs" />
        <MetricCard
          title="Sessions this month"
          value={sessions.filter((s) => monthKey(s.start) === thisMonth && s.held).length}
          subtext="Held so far"
          source="Schedule · CheckInOutLog"
        />
      </div>

      <GroupLabel>Blockzie and devices</GroupLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Linked Blockzie accounts" value={blockzie.linked} subtext={`${pct(blockzie.linked, db.students.length)}% of students`} accent="text-sky-700" source={["Users.keycloak_id", "Blockzie: Users"]} />
        <MetricCard title="Device connections" value={fmtNum(blockzie.devices.length)} subtext={`${blockzie.activeNow} connected now`} accent="text-sky-700" source="Blockzie: bluetooth_sessions" />
        <MetricCard title="Connected time" value={fmtDuration(blockzie.deviceSeconds)} subtext="Kits and boards in use" accent="text-sky-700" source="Blockzie: bluetooth_sessions" />
        <MetricCard title="Saved projects" value={fmtNum(blockzie.projects.length)} subtext={`${blockzie.creators} creators`} accent="text-sky-700" source="Blockzie: BlockzieProject" />
        <MetricCard title="App downloads" value={fmtNum(db.downloadBlockzie.reduce((s, d) => s + d.downloadCount, 0))} subtext="Download clicks" accent="text-sky-700" source="DownloadBlockzie.downloadCount" />
      </div>

      <GroupLabel>Support, sales and AI</GroupLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard title="Open tickets" value={openTickets.length} subtext={`${db.query.filter((q) => q.status === "Delayed").length} delayed`} accent="text-rose-700" source="Query.status" />
        <MetricCard title="Website orders" value={successOrders.length} subtext={`${fmtINR(successOrders.reduce((s, o) => s + o.amount, 0))} paid`} accent="text-emerald-700" source="Order · OrderItem" />
        <MetricCard title="Kits shipped" value={db.orders.filter((o) => o.shipmentStatus === "DELIVERED" || o.shipmentStatus === "SHIPPED").length} subtext="Website product orders" source="Shipment.status" />
        <MetricCard title="Enquiries" value={db.leads.length} subtext={`${db.leads.filter((l) => l.type === "LABS").length} for labs`} source="Lead.type" />
        <MetricCard title="AI chat messages" value={fmtNum(db.chatMessage.length)} subtext={`${db.students.filter((s) => s.aiAccess).length} students with AI access`} accent="text-violet-700" source="ChatMessage · Users.aiAccess" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Monthly activity" subtitle="Enrollments, certificates, LMS logins and device connections." source={["AssignedCourses", "Certificate", "LoginLogs", "Blockzie: bluetooth_sessions"]}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis dataKey="period" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="enrollments" name="Enrollments" stroke={COLORS[0]} strokeWidth={2} />
                <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="certificates" name="Certificates" stroke={COLORS[2]} strokeWidth={2} />
                <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="deviceConnections" name="Device connections" stroke={COLORS[5]} strokeWidth={2} />
                <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="logins" name="LMS logins (right axis)" stroke={COLORS[1]} strokeWidth={2} strokeDasharray="5 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Device connections by type" subtitle="How kits connect to Blockzie." source="Blockzie: bluetooth_sessions.transport">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={false} data={transportSplit} dataKey="value" nameKey="name" outerRadius={95}>
                  {transportSplit.map((item, idx) => (
                    <Cell key={item.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title="Departments" subtitle="Click a department to open its dashboard." source={["AssignedDepartment", "AssignedCourses", "Certificate", "AttendanceLogs", "Blockzie: bluetooth_sessions"]}>
        <DataTable
          columns={[
            {
              key: "name",
              label: "Department",
              render: (v, row) => (
                <button className="text-indigo-700 font-medium hover:underline" onClick={() => onOpenDepartment(row.id)}>
                  {v}
                </button>
              ),
            },
            { key: "state", label: "State" },
            { key: "institutes", label: "Institutes" },
            { key: "students", label: "Students" },
            { key: "enrollments", label: "Enrollments" },
            { key: "completion", label: "Completion" },
            { key: "quiz", label: "Avg quiz" },
            { key: "attendance", label: "Attendance" },
            { key: "devices", label: "Device connections" },
          ]}
          rows={departmentRows}
        />
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section title="Support tickets by status" subtitle={`${db.query.length} tickets since June.`} source="Query.status">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ticketSplit}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="value" name="Tickets" fill={COLORS[1]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Enquiries by type" subtitle="Website forms, also sent to Zoho CRM." source="Lead.type">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadSplit}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="value" name="Enquiries" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title="Latest open tickets" subtitle="Not yet resolved." source="Query">
        <DataTable
          columns={[
            { key: "ticketCode", label: "Ticket" },
            { key: "type", label: "Type" },
            { key: "category", label: "Category" },
            {
              key: "status",
              label: "Status",
              render: (v) => <StatusPill tone={v === "Delayed" ? "danger" : v === "Hold" ? "default" : "warning"}>{v.replace("_", " ")}</StatusPill>,
            },
            { key: "createdAt", label: "Raised", render: (v) => fmtDate(v) },
          ]}
          rows={[...openTickets].sort((a, b) => b.createdAt - a.createdAt)}
          limit={6}
        />
      </Section>
    </DashboardFrame>
  );
}
