import { OFFICER_PORTAL_CODE } from "./config.js";
import { loginWithUsername } from "./auth.js";
import { db, doc, getDoc } from "./firebase.js";
import { $, showMsg, hideMsg } from "./ui.js";

const msg = $("#msg");

$("#officerLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(msg);

  try {
    const username = $("#username").value;
    const password = $("#password").value;
    const code = $("#code").value;

    if (code !== OFFICER_PORTAL_CODE) {
      throw new Error("Wrong officer code.");
    }

    const user = await loginWithUsername(username, password);

    // Must also be in officers list (real permission gate)
    const offSnap = await getDoc(doc(db, "officers", user.uid));
    if (!offSnap.exists() || offSnap.data()?.enabled === false) {
      throw new Error("You are not listed as an officer in Firestore.");
    }

    sessionStorage.setItem("officerVerified", "true");
    window.location.href = "officer.html";
  } catch (err) {
    showMsg(msg, err.message || "Officer login failed", false);
  }
});