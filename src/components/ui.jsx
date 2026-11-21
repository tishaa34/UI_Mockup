import { useContext, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { cn, downloadCSV, SourceContext } from "./utils";

/* ---------- Data-source labels ---------- */

/** Shows which table a number comes from, when the "Show data sources" switch is on. */
export function SourceTag({ source }) {
  const show = useContext(SourceContext);
  if (!show || !source) return null;
  const items = Array.isArray(source) ? source : [source];
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {items.map((s) => {
        const blockzie = s.startsWith("Blockzie");
        return (
          <span
            key={s}
            className={cn(
              "px-2 py-0.5 rounded-md text-[10px] font-mono",
              blockzie ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-600"
            )}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

/* ---------- Layout ---------- */

export function Card({ children, className = "" }) {
  return <div className={cn("bg-white rounded-[24px] shadow-sm border border-slate-100", className)}>{children}</div>;
}

export function CardBody({ children, className = "" }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function SectionTitle({ title, subtitle, action, source }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
        <SourceTag source={source} />
      </div>
      {action}
    </div>
  );
}

export function Section({ title, subtitle, source, action, children, className = "" }) {
  return (
    <Card className={className}>
      <CardBody>
        <SectionTitle title={title} subtitle={subtitle} source={source} action={action} />
        {children}
      </CardBody>
    </Card>
  );
}

export function GroupLabel({ children }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mt-2">{children}</h3>;
}

export function MetricCard({ title, value, subtext, accent = "text-indigo-700", source }) {
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-slate-500">{title}</div>
        <div className={cn("text-3xl font-bold mt-2", accent)}>{value}</div>
        {subtext ? <div className="text-xs text-slate-500 mt-2">{subtext}</div> : null}
        <SourceTag source={source} />
      </CardBody>
    </Card>
  );
}

export function MiniStat({ label, value, accent = "text-slate-800" }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={cn("text-2xl font-bold mt-2", accent)}>{value}</div>
    </div>
  );
}

export function StatusPill({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
    info: "bg-indigo-50 text-indigo-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return <span className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap", tones[tone])}>{children}</span>;
}

export function EmptyState({ children = "No records for these filters." }) {
  return <div className="text-sm text-slate-500 py-6 text-center">{children}</div>;
}

export function DataTable({ columns, rows, limit }) {
  if (!rows.length) return <EmptyState />;
  const visible = limit ? rows.slice(0, limit) : rows;
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
          {visible.map((row, idx) => (
            <tr key={row.id ?? idx} className="border-b border-slate-50 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="py-3 pr-4 align-top text-slate-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit ? (
        <div className="text-xs text-slate-500 pt-3">
          Showing {limit} of {rows.length}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Inputs ---------- */

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.18em] text-indigo-100">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-4 py-2 rounded-2xl bg-white text-slate-700 shadow-sm min-w-[170px] text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SmallButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-2xl bg-indigo-50 text-indigo-700 text-sm font-medium shadow-sm hover:bg-indigo-100 transition whitespace-nowrap"
    >
      {children}
    </button>
  );
}

export function CsvButton({ filename, rows }) {
  return <SmallButton onClick={() => downloadCSV(filename, rows)}>Download CSV</SmallButton>;
}

/* ---------- Dashboard frame with PDF export ---------- */

export function DashboardFrame({ title, subtitle, breadcrumb, filters, headerAction, children }) {
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
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-sm opacity-90 mt-2 max-w-3xl">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {filters}
            <button
              onClick={handleDownloadPdf}
              data-html2canvas-ignore="true"
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
