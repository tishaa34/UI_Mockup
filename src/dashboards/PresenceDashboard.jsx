import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";
import * as db from "../data/db";
import {
  PRESENCE_DAYS, TODAY_KEY, IDLE_THRESHOLD_MIN, dayLabel, peopleInScope, summarizeDay,
} from "../data/presence";
import { userById, classIdOfStudent, classById, fmtDuration, fmtNum, pct } from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, GroupLabel, SmallButton,
} from "../components/ui";
import { COLORS } from "../components/utils";

const fmtClock = (ms) =>
  ms ? new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—";

const STATE_STYLE = {
  ACTIVE: { tone: "success", label: "🟢 Active" },
  IDLE: { tone: "warning", label: "🟡 Idle" },
  HIDDEN: { tone: "default", label: "⚪ Hidden" },
  OFFLINE: { tone: "danger", label: "🔴 Offline" },
};

const STATE_WORD = { ACTIVE: "Active", IDLE: "Idle", HIDDEN: "Hidden", OFFLINE: "Offline" };

const PLANNED_PRESENCE = ["Planned: Redis presence", "Planned: PresenceSnapshot"];
const PLANNED_DAILY = ["Planned: ActivitySegment", "Planned: UserDailyActivity"];

/** Value of the scope dropdown: "platform", "department:<id>" or "institute:<id>". */
const parseScope = (v) => {
  if (v === "platform") return { type: "platform" };
  const [type, id] = v.split(":");
  return { type, id };
};

async function downloadExcel({ scopeName, dayKey, summary, rows, childRows }) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "STEMbotix LMS";
  const header = (ws) => {
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      c.width = Math.max(14, (c.header || "").length + 4);
    });
  };

  const s1 = wb.addWorksheet("Summary");
  s1.columns = [
    { header: "Metric", key: "k" },
    { header: "Value", key: "v" },
  ];
  [
    ["Scope", scopeName],
    ["Day (IST, midnight to midnight)", dayKey],
    ["Total students", summary.totalStudents],
    ["Total instructors", summary.totalInstructors],
    ["Online now", summary.isToday ? summary.onlineNow : "Day closed"],
    ["Active today (unique)", summary.uniqueActive],
    ["Peak online", summary.peak],
    ["Peak at", fmtClock(summary.peakAt)],
    ["Active time", fmtDuration(summary.activeSec)],
    ["Idle time", fmtDuration(summary.idleSec)],
    ["Hidden time", fmtDuration(summary.hiddenSec)],
  ].forEach(([k, v]) => s1.addRow({ k, v }));
  header(s1);
  s1.getColumn("k").width = 32;

  const s2 = wb.addWorksheet("Every 5 minutes");
  s2.columns = [
    { header: "Time", key: "time" },
    { header: "Online", key: "online" },
    { header: "Active", key: "active" },
  ];
  summary.series.filter((p) => p.online !== null).forEach((p) => s2.addRow(p));
  header(s2);

  const s3 = wb.addWorksheet("Per person");
  s3.columns = [
    { header: "Name", key: "name" },
    { header: "Role", key: "role" },
    { header: "Institute", key: "institute" },
    { header: "Class", key: "className" },
    { header: "Status now", key: "state" },
    { header: "First seen", key: "first" },
    { header: "Last seen", key: "last" },
    { header: "Active", key: "active" },
    { header: "Idle", key: "idle" },
    { header: "Hidden", key: "hidden" },
    { header: "Active %", key: "activePct" },
  ];
  rows.forEach((r) => s3.addRow(r));
  header(s3);
  s3.getColumn("name").width = 24;
  s3.getColumn("institute").width = 26;

  const s4 = wb.addWorksheet("Breakdown");
  s4.columns = [
    { header: "Name", key: "name" },
    { header: "Total", key: "total" },
    { header: "Online now", key: "onlineNow" },
    { header: "Active today", key: "uniqueActive" },
    { header: "Peak", key: "peak" },
    { header: "Peak at", key: "peakAt" },
    { header: "Active time", key: "activeTime" },
  ];
  childRows.forEach((r) => s4.addRow(r));
  header(s4);
  s4.getColumn("name").width = 28;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `online-presence-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dayKey}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PresenceDashboard({ initialScope = "platform" }) {
  const [scopeValue, setScopeValue] = useState(initialScope);
  const [dayKey, setDayKey] = useState(TODAY_KEY);
  const [role, setRole] = useState("ALL");
  const [show, setShow] = useState("all");

  const scope = parseScope(scopeValue);
  const scopeName =
    scope.type === "platform" ? "All STEMbotix" : userById.get(scope.id)?.fullName ?? "—";

  const view = useMemo(() => {
    const people = peopleInScope(scope, role);
    const summary = summarizeDay(people, dayKey);

    let children;
    if (scope.type === "platform") {
      children = db.departments.map((d) => ({ id: d.id, name: d.fullName, next: `department:${d.id}`, people: peopleInScope({ type: "department", id: d.id }, role) }));
    } else if (scope.type === "department") {
      children = db.assignedDepartment
        .filter((a) => a.departmentId === scope.id)
        .map((a) => userById.get(a.instituteId))
        .map((i) => ({ id: i.id, name: i.fullName, next: `institute:${i.id}`, people: peopleInScope({ type: "institute", id: i.id }, role) }));
    } else {
      const classes = db.classes.filter((c) => c.instituteId === scope.id);
      children = [
        ...classes.map((c) => ({
          id: c.id,
          name: c.className,
          next: null,
          people: people.filter((p) => p.role === "STUDENT" && classIdOfStudent.get(p.userId) === c.id),
        })),
        ...(role === "STUDENT" ? [] : [{ id: "instructors", name: "Instructors", next: null, people: people.filter((p) => p.role === "INSTRUCTOR") }]),
      ];
    }
    const childRows = children.map((c) => {
      const s = summarizeDay(c.people, dayKey);
      return {
        id: c.id,
        next: c.next,
        name: c.name,
        total: s.total,
        onlineNow: s.isToday ? s.onlineNow : "—",
        uniqueActive: s.uniqueActive,
        activeShare: `${pct(s.uniqueActive, s.total)}%`,
        peak: s.peak,
        peakAt: fmtClock(s.peakAt),
        activeTime: fmtDuration(s.activeSec),
        idleShare: `${pct(s.idleSec, s.activeSec + s.idleSec + s.hiddenSec)}%`,
      };
    });
    return { summary, childRows };
    // scope is derived from scopeValue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeValue, dayKey, role]);

  const { summary, childRows } = view;
  const isToday = summary.isToday;

  const personRows = summary.perPerson
    .map((r) => {
      const u = userById.get(r.userId);
      const total = r.activeSec + r.idleSec + r.hiddenSec;
      return {
        id: `${r.userId}-${r.instituteId}`,
        name: u.fullName,
        role: r.role === "STUDENT" ? "Student" : "Instructor",
        institute: userById.get(r.instituteId).fullName,
        className: r.role === "STUDENT" ? classById.get(classIdOfStudent.get(r.userId))?.className : "—",
        stateKey: isToday ? r.stateNow : r.firstSeenAt ? "SEEN" : "NOT_SEEN",
        state: isToday ? STATE_WORD[r.stateNow] : r.firstSeenAt ? "Seen" : "Not seen",
        first: fmtClock(r.firstSeenAt),
        last: fmtClock(r.lastSeenAt),
        active: fmtDuration(r.activeSec),
        idle: fmtDuration(r.idleSec),
        hidden: fmtDuration(r.hiddenSec),
        activePct: total ? `${pct(r.activeSec, total)}%` : "—",
        _active: r.activeSec,
        _seen: r.firstSeenAt !== null,
      };
    })
    .filter((r) => {
      if (show === "online") return ["ACTIVE", "IDLE", "HIDDEN"].includes(r.stateKey);
      if (show === "idle") return r.stateKey === "IDLE" || r.stateKey === "HIDDEN";
      if (show === "seen") return r._seen;
      if (show === "notSeen") return !r._seen;
      return true;
    })
    .sort((a, b) => {
      const order = { ACTIVE: 0, IDLE: 1, HIDDEN: 2, SEEN: 3, OFFLINE: 4, NOT_SEEN: 5 };
      return order[a.stateKey] - order[b.stateKey] || b._active - a._active;
    });

  const exportRows = personRows.map(({ name, role: r, institute, className, state, first, last, active, idle, hidden, activePct }) => ({
    name, role: r, institute, className, state, first, last, active, idle, hidden, activePct,
  }));

  const stateSplit = [
    { name: "Active", value: summary.activeSec / 3600 },
    { name: "Idle", value: summary.idleSec / 3600 },
    { name: "Hidden", value: summary.hiddenSec / 3600 },
  ].map((s) => ({ ...s, value: Math.round(s.value * 10) / 10 }));

  const scopeOptions = [
    { value: "platform", label: "All STEMbotix" },
    ...db.departments.flatMap((d) => [
      { value: `department:${d.id}`, label: `Department: ${d.fullName}` },
      ...db.assignedDepartment
        .filter((a) => a.departmentId === d.id)
        .map((a) => userById.get(a.instituteId))
        .map((i) => ({ value: `institute:${i.id}`, label: `   ${i.fullName}` })),
    ]),
  ];

  const breadcrumb =
    scope.type === "platform"
      ? "Platform / Online & Engagement"
      : scope.type === "department"
        ? `Departments / ${scopeName} / Online & Engagement`
        : `Institutes / ${scopeName} / Online & Engagement`;

  return (
    <DashboardFrame
      title={`Online & Engagement: ${scopeName}`}
      subtitle="Who is online, who was active during the day, and whether they are really working or just have the tab open."
      breadcrumb={breadcrumb}
      filters={
        <>
          <FilterSelect label="Scope" value={scopeValue} onChange={setScopeValue} options={scopeOptions} />
          <FilterSelect label="Day (IST)" value={dayKey} onChange={setDayKey} options={PRESENCE_DAYS.map((d) => ({ value: d, label: dayLabel(d) }))} />
          <FilterSelect
            label="People"
            value={role}
            onChange={setRole}
            options={[
              { value: "ALL", label: "Students and instructors" },
              { value: "STUDENT", label: "Students" },
              { value: "INSTRUCTOR", label: "Instructors" },
            ]}
          />
        </>
      }
      headerAction={
        <button
          data-html2canvas-ignore="true"
          onClick={() => downloadExcel({ scopeName, dayKey, summary, rows: exportRows, childRows })}
          className="px-4 py-2 rounded-2xl bg-white text-indigo-700 shadow-sm font-medium"
        >
          Download Excel
        </button>
      }
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Planned feature (Feature Track F-038 to F-044). Not built yet.</strong> A day runs midnight to midnight, India
        time, then a new day starts from zero and the old one stays here to compare. <strong>Active</strong> = tab in front with
        a click, key or scroll in the last {IDLE_THRESHOLD_MIN} minutes, or a video playing. <strong>Idle</strong> = tab in front
        but nothing for {IDLE_THRESHOLD_MIN}+ minutes. <strong>Hidden</strong> = another tab in front. Departments see their
        institutes, institutes see themselves, instructors see names only for students they teach.
      </div>

      <GroupLabel>{isToday ? "Right now" : `${dayLabel(dayKey)} (day closed)`}</GroupLabel>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Total"
          value={fmtNum(summary.total)}
          subtext={`${summary.totalStudents} students · ${summary.totalInstructors} instructors`}
          source={["AssignedStudent", "AssignedInstructor"]}
        />
        <MetricCard
          title="Online now"
          value={isToday ? summary.onlineNow : "—"}
          subtext={isToday ? `${summary.activeNow} active · ${summary.idleNow} idle · ${summary.hiddenNow} hidden` : "Only for today"}
          accent="text-emerald-700"
          source={PLANNED_PRESENCE[0]}
        />
        <MetricCard
          title={isToday ? "Active today" : "Active that day"}
          value={summary.uniqueActive}
          subtext={`${summary.uniqueStudents} students · ${summary.uniqueInstructors} instructors · ${pct(summary.uniqueActive, summary.total)}%`}
          source="Planned: UserDailyActivity"
        />
        <MetricCard
          title="Peak online"
          value={summary.peak}
          subtext={summary.peakAt ? `at ${fmtClock(summary.peakAt)}` : "No one online"}
          accent="text-violet-700"
          source="Planned: OrgDailyPresence.peakConcurrent"
        />
        <MetricCard
          title="Really active"
          value={fmtDuration(summary.activeSec)}
          subtext={`${pct(summary.activeSec, summary.activeSec + summary.idleSec + summary.hiddenSec)}% of time online`}
          accent="text-emerald-700"
          source={PLANNED_DAILY}
        />
        <MetricCard
          title="Tab open, not used"
          value={fmtDuration(summary.idleSec + summary.hiddenSec)}
          subtext={`${fmtDuration(summary.idleSec)} idle · ${fmtDuration(summary.hiddenSec)} hidden`}
          accent="text-amber-700"
          source={PLANNED_DAILY}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section
          className="xl:col-span-2"
          title={`Online during ${dayLabel(dayKey).toLowerCase() === "today" ? "today" : dayLabel(dayKey)}`}
          subtitle={`Every 5 minutes, 6 am to 10 pm IST.${isToday ? " Updates live; the rest of the day fills in as it happens." : ""}`}
          source="Planned: PresenceSnapshot"
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.series}>
                <XAxis dataKey="time" interval={23} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area isAnimationActive={false} type="monotone" dataKey="online" name="Online" stroke={COLORS[0]} fill="#d7d8ff" connectNulls={false} />
                <Area isAnimationActive={false} type="monotone" dataKey="active" name="Active" stroke={COLORS[2]} fill="#c8ece8" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Where the time went" subtitle="Hours online, split by state." source="Planned: ActivitySegment.state">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateSplit}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => `${v} h`} />
                <Bar isAnimationActive={false} dataKey="value" name="Hours" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section
        title={scope.type === "platform" ? "By department" : scope.type === "department" ? "By institute" : "By class"}
        subtitle={scope.type === "institute" ? "Students per class, plus instructors." : "Click a name to drill down."}
        source={["Planned: OrgDailyPresence", "AssignedDepartment", "AssignedStudent", "AssignedClass"]}
      >
        <DataTable
          columns={[
            {
              key: "name",
              label: scope.type === "platform" ? "Department" : scope.type === "department" ? "Institute" : "Group",
              render: (v, r) =>
                r.next ? (
                  <button className="text-indigo-700 font-medium hover:underline text-left" onClick={() => setScopeValue(r.next)}>
                    {v}
                  </button>
                ) : (
                  v
                ),
            },
            { key: "total", label: "Total" },
            { key: "onlineNow", label: "Online now" },
            { key: "uniqueActive", label: "Active today" },
            { key: "activeShare", label: "% active" },
            { key: "peak", label: "Peak" },
            { key: "peakAt", label: "Peak at" },
            { key: "activeTime", label: "Active time" },
            { key: "idleShare", label: "Idle / hidden share" },
          ]}
          rows={childRows}
        />
        {scope.type !== "platform" ? (
          <div className="pt-3">
            <SmallButton onClick={() => setScopeValue(scope.type === "institute" ? `department:${db.assignedDepartment.find((a) => a.instituteId === scope.id)?.departmentId}` : "platform")}>
              ← Up one level
            </SmallButton>
          </div>
        ) : null}
      </Section>

      <Section
        title="People"
        subtitle={isToday ? "Live status and today's time. Sorted: active first." : "Time spent on the selected day."}
        source={["Planned: Redis presence", "Planned: UserDailyActivity", "AssignedClass"]}
        action={
          <select
            value={show}
            onChange={(e) => setShow(e.target.value)}
            data-html2canvas-ignore="true"
            className="px-3 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-sm font-medium"
          >
            <option value="all">Everyone</option>
            {isToday ? <option value="online">Online now</option> : null}
            {isToday ? <option value="idle">Online but not working</option> : null}
            <option value="seen">{isToday ? "Seen today" : "Seen that day"}</option>
            <option value="notSeen">{isToday ? "Not seen today" : "Not seen that day"}</option>
          </select>
        }
      >
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "institute", label: "Institute" },
            { key: "className", label: "Class" },
            {
              key: "state",
              label: isToday ? "Status now" : "Status",
              render: (v, r) => {
                const style = STATE_STYLE[r.stateKey];
                if (style) return <StatusPill tone={style.tone}>{style.label}</StatusPill>;
                return <StatusPill tone={r._seen ? "info" : "default"}>{v}</StatusPill>;
              },
            },
            { key: "first", label: "First seen" },
            { key: "last", label: "Last seen" },
            { key: "active", label: "Active" },
            { key: "idle", label: "Idle" },
            { key: "hidden", label: "Hidden" },
            { key: "activePct", label: "Active %" },
          ]}
          rows={personRows}
          limit={15}
        />
      </Section>
    </DashboardFrame>
  );
}
