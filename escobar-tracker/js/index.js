import { loginWithUsername, signupWithUsername } from "./auth.js";
import { $, showMsg, hideMsg } from "./ui.js";

const tabLogin = $("#tabLogin");
const tabSignup = $("#tabSignup");
const loginPanel = $("#loginPanel");
const signupPanel = $("#signupPanel");
const msg = $("#msg");

function setTab(isLogin) {
  hideMsg(msg);
  loginPanel.classList.toggle("hidden", !isLogin);
  signupPanel.classList.toggle("hidden", isLogin);
  tabLogin.classList.toggle("btn-secondary", !isLogin);
  tabSignup.classList.toggle("btn-secondary", isLogin);
}

tabLogin.addEventListener("click", () => setTab(true));
tabSignup.addEventListener("click", () => setTab(false));

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(msg);
  try {
    const u = $("#loginUsername").value;
    const p = $("#loginPassword").value;
    await loginWithUsername(u, p);
    window.location.href = "portal.html";
  } catch (err) {
    showMsg(msg, err.message || "Login failed", false);
  }
});

$("#signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(msg);
  try {
    const u = $("#signupUsername").value;
    const p = $("#signupPassword").value;
    await signupWithUsername(u, p);
    window.location.href = "portal.html";
  } catch (err) {
    showMsg(msg, err.message || "Signup failed", false);
  }
});

// default
setTab(true);