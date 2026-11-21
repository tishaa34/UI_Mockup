import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { TODAY_KEY, peopleInScope, summarizeDay, dailyActivityOf } from "../data/presence";
import { fmtDuration, pct } from "../data/selectors";
import { Section, MiniStat, SmallButton, StatusPill } from "../components/ui";
import { COLORS } from "../components/utils";

const fmtClock = (ms) =>
  ms ? new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—";

/** Small "who is online" panel for the Department and Institute tabs (planned feature). */
export function PresencePanel({ scopeType, scopeId, onOpen }) {
  const s = useMemo(() => summarizeDay(peopleInScope({ type: scopeType, id: scopeId }, "ALL"), TODAY_KEY), [scopeType, scopeId]);
  return (
    <Section
      title="Online today"
      subtitle="Planned feature (F-038 to F-044). Students and instructors, midnight to midnight IST."
      source={["Planned: Redis presence", "Planned: UserDailyActivity", "Planned: OrgDailyPresence"]}
      action={<SmallButton onClick={onOpen}>Open Online & Engagement</SmallButton>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="Online now" value={`${s.onlineNow} / ${s.total}`} accent="text-emerald-700" />
        <MiniStat label="Active today" value={`${s.uniqueActive} (${pct(s.uniqueActive, s.total)}%)`} />
        <MiniStat label="Peak" value={`${s.peak} at ${fmtClock(s.peakAt)}`} accent="text-violet-700" />
        <MiniStat
          label="Really active"
          value={`${pct(s.activeSec, s.activeSec + s.idleSec + s.hiddenSec)}%`}
          accent="text-amber-700"
        />
      </div>
    </Section>
  );
}

/** The student's own "My Activity" card (planned feature). No comparisons with other students. */
export function MyActivityCard({ userId }) {
  const days = useMemo(() => dailyActivityOf(userId, 7), [userId]);
  const today = days[days.length - 1];
  const week = days.reduce((t, d) => t + d.activeSec, 0);
  const chart = days.map((d) => ({ day: d.label, Active: Math.round(d.activeSec / 60), Idle: Math.round((d.idleSec + d.hiddenSec) / 60) }));
  return (
    <Section
      title="My Activity (what the student sees)"
      subtitle="Planned feature (F-041). Only the student's own time. No rankings or comparisons."
      source={["Planned: UserDailyActivity"]}
      action={<StatusPill tone="warning">Planned</StatusPill>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        <div className="space-y-3">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="text-sm text-emerald-700">Today you were active for</div>
            <div className="text-3xl font-bold text-emerald-700 mt-1">{fmtDuration(today.activeSec)}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">This week</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{fmtDuration(week)}</div>
          </div>
        </div>
        <div className="lg:col-span-2 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v}m`} />
              <Tooltip formatter={(v) => `${v} min`} />
              <Legend formatter={(v) => <span className="text-slate-600">{v}</span>} />
              <Bar isAnimationActive={false} dataKey="Active" stackId="t" fill={COLORS[2]} radius={[0, 0, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Idle" name="Open, not used" stackId="t" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}
