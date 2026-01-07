import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
} from "./firebase.js";

import { usernameToEmail, validUsername } from "./ui.js";

export function getUser() {
  return auth.currentUser;
}

export function waitForAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function requireAuthOrRedirect() {
  const user = await waitForAuth();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}

export async function logout() {
  await signOut(auth);
  sessionStorage.removeItem("officerVerified");
  window.location.href = "index.html";
}

export async function signupWithUsername(username, password) {
  if (!validUsername(username)) {
    throw new Error("Username must be 3–20 chars and only letters/numbers/._-");
  }
  const email = usernameToEmail(username);
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Create user doc
  const userRef = doc(db, "users", cred.user.uid);
  await setDoc(userRef, {
    username: username.trim(),
    balance: 0,
    disabled: false,
    createdAt: serverTimestamp(),
  }, { merge: true });

  // Initial log
  await addDoc(collection(db, "users", cred.user.uid, "logs"), {
    type: "init",
    amount: 0,
    reason: "Account created",
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export async function loginWithUsername(username, password) {
  if (!validUsername(username)) {
    throw new Error("Invalid username format.");
  }
  const email = usernameToEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Ensure user doc exists
  const userRef = doc(db, "users", cred.user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      username: username.trim(),
      balance: 0,
      disabled: false,
      createdAt: serverTimestamp(),
    });
  }
  return cred.user;
}

export async function getMyUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}