import { APP_TZ } from "./config.js";

export const $ = (sel) => document.querySelector(sel);

export function showMsg(el, text, ok = true) {
  el.textContent = text;
  el.classList.remove("hidden", "ok", "bad");
  el.classList.add(ok ? "ok" : "bad");
}

export function hideMsg(el) {
  el.classList.add("hidden");
}

export function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function usernameToEmail(username) {
  const u = (username ?? "").trim().toLowerCase();
  return `${u}@escobar.local`;
}

export function validUsername(username) {
  const u = (username ?? "").trim();
  // allow letters, numbers, dot, underscore, dash (simple)
  return /^[a-zA-Z0-9._-]{3,20}$/.test(u);
}

export function fmtTs(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function badge(text) {
  return `<span class="badge">${escapeHtml(text)}</span>`;
}