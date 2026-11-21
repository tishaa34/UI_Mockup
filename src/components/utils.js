import { createContext } from "react";

export const COLORS = ["#5b5ff7", "#ff8a65", "#4db6ac", "#ffd54f", "#a78bfa", "#60a5fa", "#f472b6"];

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/** True when the "Show data sources" switch is on. */
export const SourceContext = createContext(false);

export function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
