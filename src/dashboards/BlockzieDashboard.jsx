import { useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import * as db from "../data/db";
import {
  blockzieFor, studentsOfInstitute, lmsStudentOfBlockzie, instituteIdOfStudent, userById, transportLabel, platformLabel,
  sessionSeconds, countBy, pct, fmtNum, fmtDate, fmtDateTime, fmtDuration, monthKey, monthLabel, MONTHS,
} from "../data/selectors";
import {
  DashboardFrame, FilterSelect, MetricCard, Section, DataTable, StatusPill, CsvButton
} from "../components/ui";
import { COLORS } from "../components/utils";

/*
 * Blockzie & devices. Reads Blockzie's own database read-only (BLOCKZIE_DATABASE_URL,
 * feat/blockzie-dashboard branch). Users are matched to the LMS only through a shared keycloak_id.
 */
export default function BlockzieDashboard() {
  const [instituteId, setInstituteId] = useState("all");
  const [month, setMonth] = useState("all");
  const [transport, setTransport] = useState("all");

  const view = useMemo(() => {
    const lmsStudents = instituteId === "all" ? db.students : studentsOfInstitute(instituteId);
    const b = blockzieFor(lmsStudents.map((s) => s.id));
    const inMonth = (d) => month === "all" || monthKey(d) === month;
    const devices = b.devices.filter((d) => inMonth(d.connectedAt) && (transport === "all" || transportLabel(d.transport) === transport));
    const projects = b.projects.filter((p) => inMonth(p.createdAt));
    const logins = b.logins.filter((l) => inMonth(l.loginAt));
    return { lmsStudents, linked: b.linked, devices, projects, logins };
  }, [instituteId, month, transport]);

  const { lmsStudents, linked, devices, projects, logins } = view;
  const seconds = devices.reduce((s, d) => s + sessionSeconds(d), 0);
  const activeNow = devices.filter((d) => !d.disconnectedAt);
  const byTransport = countBy(devices, (d) => transportLabel(d.transport));
  const byPlatform = countBy(devices, (d) => platformLabel(d.clientPlatform));

  const monthly = MONTHS.map((m) => ({
    period: monthLabel(m),
    connections: devices.filter((d) => monthKey(d.connectedAt) === m).length,
    projects: projects.filter((p) => monthKey(p.createdAt) === m).length,
    logins: logins.filter((l) => monthKey(l.loginAt) === m).length,
  }));

  const deviceRows = [...new Set(devices.map((d) => d.deviceName))]
    .map((name) => {
      const rows = devices.filter((d) => d.deviceName === name);
      return {
        id: name,
        device: name,
        type: transportLabel(rows[0].transport),
        connections: rows.length,
        users: new Set(rows.map((r) => r.userId)).size,
        time: fmtDuration(rows.reduce((s, r) => s + sessionSeconds(r), 0)),
        avg: fmtDuration(rows.reduce((s, r) => s + sessionSeconds(r), 0) / rows.length),
      };
    })
    .sort((a, b) => b.connections - a.connections);

  const instituteRows = (instituteId === "all" ? db.institutes : [userById.get(instituteId)]).map((inst) => {
    const ids = studentsOfInstitute(inst.id).map((s) => s.id);
    const b = blockzieFor(ids);
    const dev = b.devices.filter((d) => (month === "all" || monthKey(d.connectedAt) === month) && (transport === "all" || transportLabel(d.transport) === transport));
    const proj = b.projects.filter((p) => month === "all" || monthKey(p.createdAt) === month);
    return {
      id: inst.id,
      institute: inst.fullName,
      linked: `${b.linked} / ${ids.length}`,
      connections: dev.length,
      time: fmtDuration(dev.reduce((s, d) => s + sessionSeconds(d), 0)),
      projects: proj.length,
      creators: new Set(proj.map((p) => p.userId)).size,
    };
  });

  const sessionRows = [...devices]
    .sort((a, b) => b.connectedAt - a.connectedAt)
    .map((d) => {
      const stu = lmsStudentOfBlockzie(d.userId);
      return {
        id: d.id,
        student: stu?.fullName ?? "Blockzie-only user",
        institute: stu ? userById.get(instituteIdOfStudent.get(stu.id)).fullName : "—",
        device: d.deviceName,
        type: transportLabel(d.transport),
        platform: platformLabel(d.clientPlatform),
        connected: fmtDateTime(d.connectedAt),
        duration: fmtDuration(sessionSeconds(d)),
        status: d.disconnectedAt ? "Completed" : "Active",
      };
    });

  const projectRows = [...projects]
    .sort((a, b) => b.lastModified - a.lastModified)
    .map((p) => {
      const stu = lmsStudentOfBlockzie(p.userId);
      return {
        id: p.id,
        title: p.title,
        owner: stu?.fullName ?? "Blockzie-only user",
        institute: stu ? userById.get(instituteIdOfStudent.get(stu.id)).fullName : "—",
        projectType: p.projectType,
        visibility: p.visibility,
        modified: fmtDate(p.lastModified),
      };
    });

  const templateSplit = countBy(db.projectTemplate, (t) => t.type);

  return (
    <DashboardFrame
      title="Blockzie & Devices"
      subtitle="Blockzie logins, saved projects and kit/board connections, matched to LMS students by their shared Keycloak login."
      breadcrumb="Platform / Blockzie"
      filters={
        <>
          <FilterSelect
            label="Institute"
            value={instituteId}
            onChange={setInstituteId}
            options={[{ value: "all", label: "All institutes" }, ...db.institutes.map((i) => ({ value: i.id, label: i.fullName }))]}
          />
          <FilterSelect
            label="Month-Year"
            value={month}
            onChange={setMonth}
            options={[{ value: "all", label: "All months" }, ...MONTHS.map((m) => ({ value: m, label: monthLabel(m) }))]}
          />
          <FilterSelect
            label="Connection"
            value={transport}
            onChange={setTransport}
            options={[{ value: "all", label: "All types" }, ...["BLE", "Wi-Fi", "Serial"].map((t) => ({ value: t, label: t }))]}
          />
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Linked accounts" value={`${linked}`} subtext={`${pct(linked, lmsStudents.length)}% of ${lmsStudents.length} students`} accent="text-sky-700" source={["Users.keycloak_id", "Blockzie: Users.keycloak_id"]} />
        <MetricCard title="Blockzie logins" value={fmtNum(logins.length)} subtext={`${new Set(logins.map((l) => l.userId)).size} students`} accent="text-sky-700" source="Blockzie: sessions" />
        <MetricCard title="Device connections" value={fmtNum(devices.length)} subtext={`${new Set(devices.map((d) => d.userId)).size} students`} accent="text-sky-700" source="Blockzie: bluetooth_sessions" />
        <MetricCard title="Connected time" value={fmtDuration(seconds)} subtext={`Avg ${fmtDuration(devices.length ? seconds / devices.length : 0)} per connection`} accent="text-sky-700" source="Blockzie: bluetooth_sessions.durationSeconds" />
        <MetricCard title="Connected now" value={activeNow.length} subtext="No disconnect time yet" accent="text-emerald-700" source="Blockzie: bluetooth_sessions.status" />
        <MetricCard title="Saved projects" value={fmtNum(projects.length)} subtext={`${projects.filter((p) => p.visibility === "public").length} public · ${new Set(projects.map((p) => p.userId)).size} creators`} accent="text-sky-700" source="Blockzie: BlockzieProject" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Activity by month" subtitle="Device connections, new projects and Blockzie logins." source={["Blockzie: bluetooth_sessions", "Blockzie: BlockzieProject", "Blockzie: sessions"]}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line isAnimationActive={false} type="monotone" dataKey="connections" name="Device connections" stroke={COLORS[5]} strokeWidth={2} />
                <Line isAnimationActive={false} type="monotone" dataKey="projects" name="New projects" stroke={COLORS[4]} strokeWidth={2} />
                <Line isAnimationActive={false} type="monotone" dataKey="logins" name="Blockzie logins" stroke={COLORS[0]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Connection type" source="Blockzie: bluetooth_sessions.transport">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={false} data={byTransport} dataKey="value" nameKey="name" outerRadius={90}>
                  {byTransport.map((item, idx) => (
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section title="App used to connect" source="Blockzie: bluetooth_sessions.clientPlatform">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPlatform} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={70} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="value" name="Connections" fill={COLORS[5]} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section className="xl:col-span-2" title="Devices" subtitle="Each kit or board that connected, by device name." source="Blockzie: bluetooth_sessions.deviceName" action={<CsvButton filename="blockzie-devices.csv" rows={deviceRows} />}>
          <DataTable
            columns={[
              { key: "device", label: "Device" },
              { key: "type", label: "Type" },
              { key: "connections", label: "Connections" },
              { key: "users", label: "Students" },
              { key: "time", label: "Total time" },
              { key: "avg", label: "Avg per connection" },
            ]}
            rows={deviceRows}
          />
        </Section>
      </div>

      <Section title="By institute" source={["AssignedStudent", "Users.keycloak_id", "Blockzie: bluetooth_sessions", "Blockzie: BlockzieProject"]} action={<CsvButton filename="blockzie-institutes.csv" rows={instituteRows} />}>
        <DataTable
          columns={[
            { key: "institute", label: "Institute" },
            { key: "linked", label: "Linked students" },
            { key: "connections", label: "Device connections" },
            { key: "time", label: "Connected time" },
            { key: "projects", label: "Projects" },
            { key: "creators", label: "Creators" },
          ]}
          rows={instituteRows}
        />
      </Section>

      <Section title="Recent device connections" source="Blockzie: bluetooth_sessions" action={<CsvButton filename="blockzie-device-sessions.csv" rows={sessionRows} />}>
        <DataTable
          columns={[
            { key: "student", label: "Student" },
            { key: "institute", label: "Institute" },
            { key: "device", label: "Device" },
            { key: "type", label: "Type" },
            { key: "platform", label: "App" },
            { key: "connected", label: "Connected" },
            { key: "duration", label: "Duration" },
            { key: "status", label: "Status", render: (v) => <StatusPill tone={v === "Active" ? "sky" : "default"}>{v}</StatusPill> },
          ]}
          rows={sessionRows}
          limit={10}
        />
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Section className="xl:col-span-2" title="Recent projects" source="Blockzie: BlockzieProject" action={<CsvButton filename="blockzie-projects.csv" rows={projectRows} />}>
          <DataTable
            columns={[
              { key: "title", label: "Project" },
              { key: "owner", label: "Student" },
              { key: "institute", label: "Institute" },
              { key: "projectType", label: "Type" },
              { key: "visibility", label: "Visibility", render: (v) => <StatusPill tone={v === "public" ? "sky" : "default"}>{v}</StatusPill> },
              { key: "modified", label: "Last modified" },
            ]}
            rows={projectRows}
            limit={8}
          />
        </Section>
        <Section title="Templates and downloads" source={["Blockzie: ProjectTemplate", "DownloadBlockzie.downloadCount"]}>
          <div className="space-y-3 text-sm">
            {templateSplit.map((t) => (
              <div key={t.name} className="flex justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="capitalize text-slate-600">{t.name} templates</span>
                <span className="font-semibold text-slate-800">{t.value}</span>
              </div>
            ))}
            {db.downloadBlockzie.map((d) => (
              <div key={d.id} className="flex justify-between rounded-2xl bg-sky-50 px-4 py-3">
                <span className="text-sky-800">{d.title} {d.version}</span>
                <span className="font-semibold text-sky-800">{fmtNum(d.downloadCount)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </DashboardFrame>
  );
}
