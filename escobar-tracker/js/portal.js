import {
  db,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "./firebase.js";

import { requireAuthOrRedirect, logout, getMyUserDoc } from "./auth.js";
import { $, showMsg, hideMsg, fmtTs, escapeHtml, badge } from "./ui.js";

const welcome = $("#welcome");
const balanceEl = $("#balance");
const logsEl = $("#logs");
const annEl = $("#announcements");
const reqEl = $("#requests");
const spendMsg = $("#spendMsg");

$("#logoutBtn").addEventListener("click", logout);

const user = await requireAuthOrRedirect();
if (!user) throw new Error("No auth");

const my = await getMyUserDoc(user.uid);
if (my?.disabled) {
  showMsg(spendMsg, "Your account is disabled. Ask an officer.", false);
  await logout();
}

welcome.textContent = `Logged in as ${my?.username ?? "—"}`;

// Live balance
onSnapshot(doc(db, "users", user.uid), (snap) => {
  const data = snap.data();
  if (!data) return;
  if (data.disabled) logout();
  balanceEl.textContent = (data.balance ?? 0).toString();
});

// Live logs (latest 30)
onSnapshot(
  query(collection(db, "users", user.uid, "logs"), orderBy("createdAt", "desc"), limit(30)),
  (snap) => {
    if (snap.empty) {
      logsEl.innerHTML = `<div class="muted">No logs yet.</div>`;
      return;
    }
    logsEl.innerHTML = snap.docs.map(d => {
      const x = d.data();
      const sign = x.type === "deduct" || x.type === "spend" ? "-" : "+";
      const amt = x.amount ?? 0;
      return `
        <div class="item">
          <div class="title">${escapeHtml(x.reason || "(no reason)")}</div>
          <div class="meta">
            ${badge(x.type || "log")}
            <span>${escapeHtml(sign)}${escapeHtml(String(amt))}</span>
            <span>${escapeHtml(fmtTs(x.createdAt))}</span>
          </div>
        </div>
      `;
    }).join("");
  }
);

// Live announcements (latest 20)
onSnapshot(
  query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20)),
  (snap) => {
    if (snap.empty) {
      annEl.innerHTML = `<div class="muted">No announcements.</div>`;
      return;
    }
    annEl.innerHTML = snap.docs.map(d => {
      const x = d.data();
      return `
        <div class="item">
          <div class="title">${escapeHtml(x.title || "Announcement")}</div>
          <div class="meta"><span>${escapeHtml(fmtTs(x.createdAt))}</span></div>
          <div>${escapeHtml(x.body || "")}</div>
        </div>
      `;
    }).join("");
  }
);

// Live my spend requests (latest 20)
onSnapshot(
  query(collection(db, "spendRequests"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(20)),
  (snap) => {
    if (snap.empty) {
      reqEl.innerHTML = `<div class="muted">No spend requests yet.</div>`;
      return;
    }
    reqEl.innerHTML = snap.docs.map(d => {
      const x = d.data();
      const status = x.status || "pending";
      return `
        <div class="item">
          <div class="title">${escapeHtml(x.reason || "(no reason)")}</div>
          <div class="meta">
            ${badge("spend request")}
            ${badge(status)}
            <span>Amount: ${escapeHtml(String(x.amount ?? 0))}</span>
            <span>${escapeHtml(fmtTs(x.createdAt))}</span>
          </div>
          ${x.officerNote ? `<div class="muted small">Officer note: ${escapeHtml(x.officerNote)}</div>` : ""}
        </div>
      `;
    }).join("");
  }
);

// Spend request submit
$("#spendForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(spendMsg);

  try {
    const amount = parseInt($("#spendAmount").value, 10);
    const reason = $("#spendReason").value.trim();

    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
    if (!reason) throw new Error("Enter a reason/item.");

    // optional: check current balance
    const uSnap = await getDoc(doc(db, "users", user.uid));
    const bal = uSnap.data()?.balance ?? 0;
    if (amount > bal) throw new Error(`Not enough escobars. Your balance is ${bal}.`);

    await addDoc(collection(db, "spendRequests"), {
      uid: user.uid,
      username: uSnap.data()?.username ?? "",
      amount,
      reason,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    $("#spendAmount").value = "";
    $("#spendReason").value = "";
    showMsg(spendMsg, "Spend request sent to officers.", true);
  } catch (err) {
    showMsg(spendMsg, err.message || "Failed to send request", false);
  }
});