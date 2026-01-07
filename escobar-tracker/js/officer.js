import {
  db,
  auth,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "./firebase.js";

import { requireAuthOrRedirect, logout } from "./auth.js";
import { $, showMsg, hideMsg, fmtTs, escapeHtml, badge } from "./ui.js";

$("#logoutBtn").addEventListener("click", logout);

const user = await requireAuthOrRedirect();
if (!user) throw new Error("No auth");

if (sessionStorage.getItem("officerVerified") !== "true") {
  window.location.href = "officer-login.html";
}

// confirm officer in DB
const offSnap = await getDoc(doc(db, "officers", user.uid));
if (!offSnap.exists() || offSnap.data()?.enabled === false) {
  window.location.href = "officer-login.html";
}

$("#whoami").textContent = `Officer UID: ${user.uid}`;

const annMsg = $("#annMsg");
const reqMsg = $("#reqMsg");
const adjMsg = $("#adjMsg");

let cachedUsers = []; // for dropdown and list

async function loadUsersOnce() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("username", "asc"), limit(500)));
  cachedUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  refreshUserSelect();
  renderAccounts();
}

function refreshUserSelect() {
  const sel = $("#userSelect");
  sel.innerHTML = cachedUsers.map(u =>
    `<option value="${escapeHtml(u.uid)}">${escapeHtml(u.username || u.uid)} (bal: ${escapeHtml(String(u.balance ?? 0))})</option>`
  ).join("");
}

function renderAccounts(filter = "") {
  const list = $("#accounts");
  const f = filter.trim().toLowerCase();

  const shown = cachedUsers.filter(u => (u.username || "").toLowerCase().includes(f));

  if (!shown.length) {
    list.innerHTML = `<div class="muted">No matching accounts.</div>`;
    return;
  }

  list.innerHTML = shown.map(u => {
    const disabled = !!u.disabled;
    return `
      <div class="item">
        <div class="title">${escapeHtml(u.username || "(no username)")}</div>
        <div class="meta">
          ${badge("user")}
          <span>UID: ${escapeHtml(u.uid)}</span>
          <span>Balance: ${escapeHtml(String(u.balance ?? 0))}</span>
          ${disabled ? badge("DISABLED") : badge("active")}
        </div>
        <div class="actions">
          <button class="btn ${disabled ? "" : "btn-danger"}" data-toggle="${escapeHtml(u.uid)}">
            ${disabled ? "Enable" : "Disable"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  // hook buttons
  list.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-toggle");
      const target = cachedUsers.find(x => x.uid === uid);
      if (!target) return;

      try {
        await updateDoc(doc(db, "users", uid), { disabled: !target.disabled });
      } catch (e) {
        showMsg(adjMsg, e.message || "Failed to toggle", false);
      }
    });
  });
}

// Live users list (up to 500)
onSnapshot(query(collection(db, "users"), orderBy("username", "asc"), limit(500)), (snap) => {
  cachedUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  refreshUserSelect();
  renderAccounts($("#search").value);
});

$("#search").addEventListener("input", (e) => {
  renderAccounts(e.target.value);
});
$("#refreshBtn").addEventListener("click", loadUsersOnce);

// Adjust form (add/deduct)
$("#adjustForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(adjMsg);

  try {
    const uid = $("#userSelect").value;
    const action = $("#action").value;
    const amount = parseInt($("#amount").value, 10);
    const reason = $("#reason").value.trim();

    if (!uid) throw new Error("Select a user.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
    if (!reason) throw new Error("Enter a reason.");

    const delta = action === "deduct" ? -amount : amount;

    await runTransaction(db, async (tx) => {
      const userRef = doc(db, "users", uid);
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("User doc not found.");

      const data = snap.data();
      if (data.disabled) throw new Error("That account is disabled.");

      const bal = data.balance ?? 0;
      const newBal = bal + delta;
      if (newBal < 0) throw new Error(`Would go negative (current ${bal}).`);

      tx.update(userRef, { balance: newBal });

      const logRef = doc(collection(db, "users", uid, "logs"));
      tx.set(logRef, {
        type: delta >= 0 ? "add" : "deduct",
        amount: Math.abs(delta),
        reason,
        createdAt: serverTimestamp(),
        byOfficerUid: auth.currentUser.uid,
      });
    });

    $("#amount").value = "";
    $("#reason").value = "";
    showMsg(adjMsg, "Applied successfully.", true);
  } catch (err) {
    showMsg(adjMsg, err.message || "Failed to apply", false);
  }
});

// Announcements
$("#annForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(annMsg);

  try {
    const title = $("#annTitle").value.trim();
    const body = $("#annBody").value.trim();
    if (!title || !body) throw new Error("Title and message required.");

    await addDoc(collection(db, "announcements"), {
      title,
      body,
      createdAt: serverTimestamp(),
      byOfficerUid: auth.currentUser.uid,
    });

    $("#annTitle").value = "";
    $("#annBody").value = "";
    showMsg(annMsg, "Announcement posted.", true);
  } catch (err) {
    showMsg(annMsg, err.message || "Failed to post announcement", false);
  }
});

// Spend requests (pending)
onSnapshot(
  query(collection(db, "spendRequests"), where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(50)),
  (snap) => {
    const el = $("#spendRequests");
    if (snap.empty) {
      el.innerHTML = `<div class="muted">No pending requests.</div>`;
      return;
    }

    el.innerHTML = snap.docs.map(d => {
      const x = d.data();
      return `
        <div class="item">
          <div class="title">${escapeHtml(x.username || x.uid)}</div>
          <div class="meta">
            ${badge("pending")}
            <span>Amount: ${escapeHtml(String(x.amount ?? 0))}</span>
            <span>${escapeHtml(fmtTs(x.createdAt))}</span>
          </div>
          <div>${escapeHtml(x.reason || "")}</div>
          <div class="actions">
            <input placeholder="Officer note (optional)" data-note="${escapeHtml(d.id)}" />
            <button class="btn btn-primary" data-approve="${escapeHtml(d.id)}">Approve</button>
            <button class="btn btn-danger" data-reject="${escapeHtml(d.id)}">Reject</button>
          </div>
        </div>
      `;
    }).join("");

    // hook approve/reject
    el.querySelectorAll("[data-approve]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-approve");
        const note = el.querySelector(`[data-note="${CSS.escape(id)}"]`)?.value?.trim() || "";
        await handleRequest(id, true, note);
      });
    });
    el.querySelectorAll("[data-reject]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reject");
        const note = el.querySelector(`[data-note="${CSS.escape(id)}"]`)?.value?.trim() || "";
        await handleRequest(id, false, note);
      });
    });
  }
);

async function handleRequest(requestId, approve, officerNote) {
  hideMsg(reqMsg);

  try {
    await runTransaction(db, async (tx) => {
      const reqRef = doc(db, "spendRequests", requestId);
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) throw new Error("Request not found.");

      const req = reqSnap.data();
      if (req.status !== "pending") throw new Error("Already handled.");

      const uid = req.uid;
      const amount = req.amount ?? 0;
      if (!uid || !Number.isFinite(amount) || amount <= 0) throw new Error("Bad request data.");

      const userRef = doc(db, "users", uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error("User not found.");

      const u = userSnap.data();
      const bal = u.balance ?? 0;

      if (approve) {
        if (bal < amount) throw new Error(`User has only ${bal}. Cannot approve ${amount}.`);
        tx.update(userRef, { balance: bal - amount });

        const logRef = doc(collection(db, "users", uid, "logs"));
        tx.set(logRef, {
          type: "spend",
          amount,
          reason: `Spent: ${req.reason || ""}`,
          createdAt: serverTimestamp(),
          byOfficerUid: auth.currentUser.uid,
          requestId,
        });

        tx.update(reqRef, {
          status: "approved",
          handledAt: serverTimestamp(),
          handledBy: auth.currentUser.uid,
          officerNote: officerNote || "",
        });
      } else {
        tx.update(reqRef, {
          status: "rejected",
          handledAt: serverTimestamp(),
          handledBy: auth.currentUser.uid,
          officerNote: officerNote || "",
        });
      }
    });

    showMsg(reqMsg, approve ? "Approved request." : "Rejected request.", true);
  } catch (err) {
    showMsg(reqMsg, err.message || "Failed to handle request", false);
  }
}