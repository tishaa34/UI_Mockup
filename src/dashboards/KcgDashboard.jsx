import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import {
  colleges, clusters, kitDeliveries, collegeIssues, projects, submissions, programSettings, programLevels, LEVELS,
  FLAG_LABEL, KIT_LABEL, STATUS_LABEL, TODAY_STR, collegeStudents,
} from "../data/kcg";
import { fmtDate, fmtNum, pct } from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, GroupLabel, SmallButton, MiniStat, EmptyState,
} from "../components/ui";
import { COLORS, cn, downloadCSV } from "../components/utils";

const ALL = "ALL";
const KIT_TONE = { NONE: "danger", PENDING: "danger", DISPATCHED: "warning", DELIVERED: "info", CONFIRMED: "success" };
const STATUS_TONE = { NOT_STARTED: "default", IN_PROGRESS: "info", PASSED: "success", FAILED: "danger", NOT_MOVED_UP: "warning" };
const OWNER_LABEL = { COLLEGE: "College", TRAINER: "Trainer", STEMBOTIX: "STEMbotix" };
const percent = (v) => (v === null || v === undefined ? "—" : `${v}%`);
const fraction = (done, total) => (total ? `${done} / ${total}` : "—");

const TRAINING = {
  NOT_BOOKED: (r) => r.trainingDaysBooked === 0,
  UNDER_WAY: (r) => r.trainingDaysBooked > 0 && r.trainingDaysDone < r.trainingDaysBooked,
  DONE: (r) => r.trainingDaysBooked > 0 && r.trainingDaysDone === r.trainingDaysBooked,
};

/** KCG programme: colleges in clusters, levels, training days, teams and projects, kits, issues. */
export default function KcgDashboard() {
  const [cluster, setCluster] = useState(ALL);
  const [kit, setKit] = useState(ALL);
  const [training, setTraining] = useState(ALL);
  const [flag, setFlag] = useState(ALL);
  const [search, setSearch] = useState("");
  const [openCollegeId, setOpenCollegeId] = useState(null);

  const rows = useMemo(() => {
    const text = search.trim().toLowerCase();
    return colleges.filter(
      (r) =>
        (!text || r.collegeName.toLowerCase().includes(text)) &&
        (cluster === ALL || r.clusterId === cluster) &&
        (kit === ALL || r.kitSummary === kit) &&
        (training === ALL || TRAINING[training](r)) &&
        (flag === ALL || (flag === "ANY" ? r.flags.length > 0 : r.flags.includes(flag)))
    );
  }, [cluster, kit, training, flag, search]);

  const ids = new Set(rows.map((r) => r.instituteId));
  const sum = (key) => rows.reduce((t, r) => t + (r[key] ?? 0), 0);
  const attended = rows.filter((r) => r.attendance !== null);
  const avgAttendance = attended.length ? Math.round((attended.reduce((t, r) => t + r.attendance, 0) / attended.length) * 10) / 10 : null;
  const students = sum("students");
  const flagged = rows.filter((r) => r.flags.length > 0).length;

  const levelFunnel = LEVELS.map((lvl, i) => ({
    level: `Level ${lvl}`,
    students: rows.reduce((t, r) => t + r.studentsPerLevel[i], 0),
    colleges: rows.filter((r) => r.currentLevel === lvl).length,
  }));

  const myKits = kitDeliveries.filter((k) => ids.has(k.instituteId));
  const kitSplit = ["CONFIRMED", "DELIVERED", "DISPATCHED", "PENDING"].map((s) => ({
    name: KIT_LABEL[s],
    value: myKits.filter((k) => k.status === s).length,
    key: s,
  })).filter((s) => s.value > 0);
  const kitsAtColleges = myKits.filter((k) => ["DELIVERED", "CONFIRMED"].includes(k.status)).reduce((t, k) => t + k.quantity, 0);
  const kitsTotal = myKits.reduce((t, k) => t + k.quantity, 0);

  const myProjects = projects.filter((p) => ids.has(p.instituteId));
  const trlChart = Array.from({ length: 8 }, (_, trl) => ({ trl: `TRL ${trl}`, projects: myProjects.filter((p) => p.trl === trl).length }));
  const mySubs = submissions.filter((s) => ids.has(s.instituteId));
  const reviewSplit = [
    { name: "Approved", value: mySubs.filter((s) => s.review === "APPROVED").length },
    { name: "Needs corrections", value: mySubs.filter((s) => s.review === "NEEDS_CORRECTIONS").length },
    { name: "Waiting for review", value: mySubs.filter((s) => s.review === "PENDING").length },
  ];

  const myIssues = collegeIssues.filter((x) => ids.has(x.instituteId));
  const openIssues = myIssues.filter((x) => x.status === "OPEN");
  const issueByOwner = ["COLLEGE", "TRAINER", "STEMBOTIX"].map((o) => ({
    owner: OWNER_LABEL[o],
    open: openIssues.filter((x) => x.owner === o && x.targetDate >= TODAY_STR).length,
    overdue: openIssues.filter((x) => x.owner === o && x.targetDate < TODAY_STR).length,
  }));

  const flagCounts = Object.keys(FLAG_LABEL).map((f) => [f, colleges.filter((r) => r.flags.includes(f)).length]);

  const clusterRows = clusters
    .map((c) => {
      const list = rows.filter((r) => r.clusterId === c.id);
      if (!list.length) return null;
      const att = list.filter((r) => r.attendance !== null);
      const s = (k) => list.reduce((t, r) => t + (r[k] ?? 0), 0);
      return {
        id: c.id,
        cluster: c.name,
        trainer: c.instructor.fullName,
        coordinator: c.coordinators.map((x) => x.fullName).join(", "),
        colleges: list.length,
        students: s("students"),
        kitsNotDelivered: list.filter((r) => r.flags.includes("kit")).length,
        training: `${s("trainingDaysDone")} / ${s("trainingDaysBooked")}`,
        attendance: att.length ? `${Math.round((att.reduce((t, r) => t + r.attendance, 0) / att.length) * 10) / 10}%` : "—",
        teamsWithoutProject: s("teamsWithoutProject"),
        reviewsWaiting: s("reviewsWaitingTooLong"),
        issues: `${s("openIssues")}${s("overdueIssues") ? ` (${s("overdueIssues")} overdue)` : ""}`,
        flagged: list.filter((r) => r.flags.length > 0).length,
      };
    })
    .filter(Boolean);

  const collegeExport = rows.map((r) => ({
    College: r.collegeName,
    Cluster: r.clusterName,
    Trainer: r.trainerName,
    Kit: KIT_LABEL[r.kitSummary],
    "Training days done": r.trainingDaysDone,
    "Training days booked": r.trainingDaysBooked,
    "Attendance %": r.attendance,
    Students: r.students,
    "Level 1": r.studentsPerLevel[0],
    "Level 2": r.studentsPerLevel[1],
    "Level 3": r.studentsPerLevel[2],
    "Level 4": r.studentsPerLevel[3],
    "Project sends reviewed": r.submissionsReviewed,
    "Project sends": r.submissions,
    "Current level": r.currentLevel,
    "Teams marked": r.teamsMarked,
    Teams: r.teams,
    "Open issues": r.openIssues,
    "Overdue issues": r.overdueIssues,
    "Red flags": r.flags.map((f) => FLAG_LABEL[f]).join("; "),
  }));

  const openCollege = colleges.find((r) => r.instituteId === openCollegeId) ?? null;

  return (
    <DashboardFrame
      title="KCG Programme"
      subtitle="Every KCG college at a glance: clusters, levels, training days, teams and projects, kits and issues. Red flags show what needs following up."
      breadcrumb="Departments / KCG"
      filters={
        <>
          <FilterSelect label="Cluster" value={cluster} onChange={setCluster} options={[{ value: ALL, label: "All clusters" }, ...clusters.map((c) => ({ value: c.id, label: c.name }))]} />
          <FilterSelect label="Kit" value={kit} onChange={setKit} options={[{ value: ALL, label: "All kit statuses" }, ...Object.entries(KIT_LABEL).map(([value, label]) => ({ value, label }))]} />
          <FilterSelect
            label="Training"
            value={training}
            onChange={setTraining}
            options={[
              { value: ALL, label: "All" },
              { value: "NOT_BOOKED", label: "Not booked" },
              { value: "UNDER_WAY", label: "Under way" },
              { value: "DONE", label: "All booked days done" },
            ]}
          />
          <FilterSelect
            label="Red flags"
            value={flag}
            onChange={setFlag}
            options={[{ value: ALL, label: "All colleges" }, { value: "ANY", label: "Any red flag" }, ...Object.entries(FLAG_LABEL).map(([value, label]) => ({ value, label }))]}
          />
        </>
      }
    >
      <div className="flex flex-wrap gap-2" data-html2canvas-ignore="true">
        {flagCounts.map(([f, count]) => (
          <button
            key={f}
            onClick={() => setFlag(flag === f ? ALL : f)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-sm transition",
              count > 0 ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-slate-200 bg-white text-slate-500",
              flag === f && "ring-2 ring-rose-400"
            )}
          >
            {FLAG_LABEL[f]}: <b>{count}</b>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Colleges" value={rows.length} subtext={`${clusterRows.length} clusters`} />
        <MetricCard
          title="Students enrolled"
          value={fmtNum(students)}
          subtext={`Target ${fmtNum(rows.length * programSettings.batchTarget)} (${programSettings.batchTarget} per college)`}
        />
        <MetricCard title="Training days" value={`${sum("trainingDaysDone")} / ${sum("trainingDaysBooked")}`} subtext="Held / booked" />
        <MetricCard title="Attendance" value={percent(avgAttendance)} subtext={`Needed: ${programSettings.attendancePercent}%`} accent="text-violet-700" />
        <MetricCard title="Kits at colleges" value={`${kitsAtColleges} / ${kitsTotal}`} subtext="Delivered or confirmed" accent="text-emerald-700" />
        <MetricCard title="Colleges with red flags" value={flagged} subtext={`${pct(flagged, rows.length)}% of colleges`} accent="text-rose-700" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Students per level" subtitle="Level 1 is the whole batch; each later level, those who moved up into it.">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelFunnel}>
                <XAxis dataKey="level" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                <Tooltip />
                <Legend formatter={(v) => <span className="text-slate-600">{v}</span>} />
                <Bar isAnimationActive={false} yAxisId="left" dataKey="students" name="Students" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
                <Bar isAnimationActive={false} yAxisId="right" dataKey="colleges" name="Colleges on this level now (right axis)" fill={COLORS[1]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Kit deliveries" subtitle={`${myKits.length} deliveries to ${new Set(myKits.map((k) => k.instituteId)).size} colleges.`}>
          {kitSplit.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={false} data={kitSplit} dataKey="value" nameKey="name" outerRadius={90} stroke="#fff" strokeWidth={2}>
                    {kitSplit.map((s) => (
                      <Cell key={s.key} fill={{ CONFIRMED: COLORS[2], DELIVERED: COLORS[0], DISPATCHED: COLORS[3], PENDING: COLORS[1] }[s.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend formatter={(v) => <span className="text-slate-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section title="Project TRL" subtitle="Latest Technology Readiness Level of each team's project.">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trlChart}>
                <XAxis dataKey="trl" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="projects" name="Projects" fill={COLORS[4]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Project reviews" subtitle={`A send waiting more than ${programSettings.reviewWaitDays} days is flagged.`}>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Teams" value={sum("teams")} />
            <MiniStat label="Without a project" value={sum("teamsWithoutProject")} accent="text-rose-700" />
            {reviewSplit.map((r) => (
              <MiniStat key={r.name} label={r.name} value={r.value} accent={r.name === "Approved" ? "text-emerald-700" : r.name === "Needs corrections" ? "text-amber-700" : "text-indigo-700"} />
            ))}
            <MiniStat label="Waiting too long" value={sum("reviewsWaitingTooLong")} accent="text-rose-700" />
          </div>
        </Section>
        <Section title="Open issues by owner" subtitle={`${openIssues.length} open, ${openIssues.filter((x) => x.targetDate < TODAY_STR).length} past their target date.`}>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueByOwner}>
                <XAxis dataKey="owner" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend formatter={(v) => <span className="text-slate-600">{v}</span>} />
                <Bar isAnimationActive={false} dataKey="open" name="On time" stackId="i" fill={COLORS[0]} />
                <Bar isAnimationActive={false} dataKey="overdue" name="Overdue" stackId="i" fill={COLORS[1]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section
        title="Clusters"
        subtitle="Each cluster has a trainer and a coordinator."
        action={<SmallButton onClick={() => downloadCSV(`kcg-clusters-${TODAY_STR}.csv`, clusterRows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "id"))))}>Export clusters (CSV)</SmallButton>}
      >
        <DataTable
          columns={[
            { key: "cluster", label: "Cluster", render: (v, r) => <button className="text-indigo-700 font-medium hover:underline text-left" onClick={() => setCluster(r.id)}>{v}</button> },
            { key: "trainer", label: "Trainer" },
            { key: "coordinator", label: "Coordinator" },
            { key: "colleges", label: "Colleges" },
            { key: "students", label: "Students" },
            { key: "kitsNotDelivered", label: "Kits not delivered" },
            { key: "training", label: "Training days" },
            { key: "attendance", label: "Avg attendance" },
            { key: "teamsWithoutProject", label: "Teams w/o project" },
            { key: "reviewsWaiting", label: "Reviews waiting" },
            { key: "issues", label: "Open issues" },
            { key: "flagged", label: "Colleges flagged", render: (v) => (v ? <StatusPill tone="danger">{v}</StatusPill> : "0") },
          ]}
          rows={clusterRows}
        />
      </Section>

      <Section
        title="Colleges"
        subtitle={`Showing ${rows.length} of ${colleges.length}. Click a college to see its students, level dates, kits and issues.`}
        action={
          <div className="flex flex-wrap gap-2 justify-end" data-html2canvas-ignore="true">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search college"
              className="px-3 py-2 rounded-2xl border border-slate-200 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <SmallButton onClick={() => downloadCSV(`kcg-colleges-${TODAY_STR}.csv`, collegeExport)}>Export colleges (CSV)</SmallButton>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: "collegeName",
              label: "College",
              render: (v, r) => (
                <div>
                  <button
                    className={cn("font-medium hover:underline text-left", openCollegeId === r.instituteId ? "text-violet-700" : "text-indigo-700")}
                    onClick={() => setOpenCollegeId(openCollegeId === r.instituteId ? null : r.instituteId)}
                  >
                    {v}
                  </button>
                  {r.flags.length ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.flags.map((f) => (
                        <span key={f} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-700">{FLAG_LABEL[f]}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            },
            { key: "clusterName", label: "Cluster" },
            { key: "trainerName", label: "Trainer" },
            { key: "kitSummary", label: "Kit", render: (v) => <StatusPill tone={KIT_TONE[v]}>{KIT_LABEL[v]}</StatusPill> },
            { key: "trainingDaysDone", label: "Training days", render: (v, r) => fraction(v, r.trainingDaysBooked) },
            { key: "attendance", label: "Attendance", render: (v) => <span className={cn(v !== null && v < programSettings.attendancePercent && "text-rose-600 font-medium")}>{percent(v)}</span> },
            { key: "studentsPerLevel", label: "Students per level", render: (v) => <span className="whitespace-nowrap text-xs">{v.map((c, i) => `L${i + 1}: ${c || "–"}`).join("  ")}</span> },
            { key: "submissionsReviewed", label: "Projects reviewed", render: (v, r) => fraction(v, r.submissions) },
            { key: "currentLevel", label: "Marks entered", render: (v, r) => (v ? `L${v}: ${fraction(r.teamsMarked, r.teams)}` : "—") },
            { key: "openIssues", label: "Open issues", render: (v, r) => <span className={cn(r.overdueIssues > 0 && "text-rose-600")}>{v}{r.overdueIssues ? ` (${r.overdueIssues} overdue)` : ""}</span> },
          ]}
          rows={rows.map((r) => ({ ...r, id: r.instituteId }))}
        />
      </Section>

      {openCollege ? <CollegeDetail row={openCollege} onClose={() => setOpenCollegeId(null)} /> : null}

      <GroupLabel>Programme rules</GroupLabel>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section title="How a level is passed" subtitle="Same for every college.">
          <div className="space-y-2 text-sm text-slate-600">
            <div>Level mark = <b>{programSettings.projectWeight}%</b> project + <b>{programSettings.quizWeight}%</b> quiz + <b>{programSettings.testWeight}%</b> test</div>
            <div>Pass = level mark at or above the pass mark, <b>and</b> attendance at least <b>{programSettings.attendancePercent}%</b> (or an approved exception)</div>
            <div>Best of the first <b>{programSettings.maxAttempts}</b> attempts inside the level's dates counts</div>
            <div>Teams of up to <b>{programSettings.maxTeamSize}</b> · batch target <b>{programSettings.batchTarget}</b>, max <b>{programSettings.batchMax}</b></div>
          </div>
        </Section>
        <Section className="xl:col-span-2" title="Levels">
          <DataTable
            columns={[
              { key: "level", label: "Level", render: (v) => `Level ${v}` },
              { key: "trl", label: "TRL range" },
              { key: "trainingDays", label: "Training days" },
              { key: "passMark", label: "Pass mark", render: (v) => `${v}%` },
              { key: "certificates", label: "Certificate", render: (v) => <StatusPill tone={v ? "success" : "default"}>{v ? "Yes" : "Not yet"}</StatusPill> },
            ]}
            rows={programLevels.map((l) => ({ ...l, id: l.level, trl: l.trlMin === l.trlMax ? `TRL ${l.trlMin}` : `TRL ${l.trlMin}–${l.trlMax}` }))}
          />
        </Section>
      </div>
    </DashboardFrame>
  );
}

function CollegeDetail({ row, onClose }) {
  const students = collegeStudents(row);
  const kits = kitDeliveries.filter((k) => k.instituteId === row.instituteId);
  const issues = collegeIssues.filter((x) => x.instituteId === row.instituteId);
  const statusCounts = Object.keys(STATUS_LABEL).map((s) => [s, students.filter((x) => x.status === s).length]).filter(([, c]) => c > 0);
  return (
    <Card2 title={`${row.collegeName}`} subtitle={`${row.clusterName} · trainer ${row.trainerName}${row.currentLevel ? ` · now on Level ${row.currentLevel}` : ""}`} onClose={onClose}>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {row.windows.map((w) => {
          const state = w.endDate < TODAY_STR ? (row.finishedLevels.includes(w.level) ? "Finished" : "Ended, marks due") : w.startDate <= TODAY_STR ? "Running" : "Upcoming";
          const tone = state === "Finished" ? "success" : state === "Running" ? "info" : state === "Upcoming" ? "default" : "danger";
          const b = row.bookings[w.level - 1];
          return (
            <div key={w.level} className="rounded-2xl bg-slate-50 p-3 col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Level {w.level}</span>
                <StatusPill tone={tone}>{state}</StatusPill>
              </div>
              <div className="text-xs text-slate-500 mt-2">{fmtDate(w.startDate)} – {fmtDate(w.endDate)}</div>
              <div className="text-xs text-slate-600 mt-1">Training days {fraction(b.held, b.booked)} · {row.studentsPerLevel[w.level - 1]} students</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {statusCounts.map(([s, c]) => (
          <StatusPill key={s} tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}: {c}</StatusPill>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <div className="xl:col-span-2">
          <div className="text-sm font-semibold text-slate-800 mb-2">Students</div>
          <DataTable
            columns={[
              { key: "fullName", label: "Student" },
              { key: "teamName", label: "Team" },
              { key: "level", label: "Level", render: (v) => `Level ${v}` },
              { key: "attendance", label: "Attendance", render: (v) => <span className={cn(v < programSettings.attendancePercent && "text-rose-600 font-medium")}>{percent(v)}</span> },
              { key: "levelMark", label: "Level mark", render: (v) => percent(v) },
              { key: "status", label: "Status", render: (v) => <StatusPill tone={STATUS_TONE[v]}>{STATUS_LABEL[v]}</StatusPill> },
            ]}
            rows={students.map((s) => ({ ...s, id: s.studentId }))}
            limit={12}
          />
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-2">Kit deliveries</div>
            {kits.length ? (
              <div className="space-y-2">
                {kits.map((k) => (
                  <div key={k.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{k.kitType} × {k.quantity}</span>
                      <StatusPill tone={KIT_TONE[k.status]}>{KIT_LABEL[k.status]}</StatusPill>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Dispatched {k.dispatchDate ? fmtDate(k.dispatchDate) : "—"} · Delivered {k.deliveryDate ? fmtDate(k.deliveryDate) : "—"}
                      {k.confirmedBy ? ` · confirmed by ${k.confirmedBy}` : ""}
                    </div>
                    {k.issueNotes ? <div className="text-xs text-amber-700 mt-1">{k.issueNotes}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No kit recorded for this college.</EmptyState>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 mb-2">Issues</div>
            {issues.length ? (
              <div className="space-y-2">
                {issues.map((x) => {
                  const overdue = x.status === "OPEN" && x.targetDate < TODAY_STR;
                  return (
                    <div key={x.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{x.title}</span>
                        <StatusPill tone={x.status === "CLOSED" ? "success" : overdue ? "danger" : "warning"}>{x.status === "CLOSED" ? "Closed" : overdue ? "Overdue" : "Open"}</StatusPill>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Owner: {OWNER_LABEL[x.owner]} ({x.ownerName}) · target {fmtDate(x.targetDate)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>No issues raised.</EmptyState>
            )}
          </div>
        </div>
      </div>
    </Card2>
  );
}

function Card2({ title, subtitle, onClose, children }) {
  return (
    <div className="bg-white rounded-[24px] shadow-sm border-2 border-violet-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        <SmallButton onClick={onClose}>Close</SmallButton>
      </div>
      {children}
    </div>
  );
}
