/**
 * admin.js — ProctorAdmin Dashboard (API-connected version)
 * All student CRUD and submissions call the REST API with JWT.
 * Live monitoring still uses BroadcastChannel for real-time frames.
 */

"use strict";

// ===== API HELPER =====
const API = {
  token: null,

  async request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  },

  get:    (p)    => API.request("GET",    p),
  post:   (p, b) => API.request("POST",   p, b),
  put:    (p, b) => API.request("PUT",    p, b),
  delete: (p)    => API.request("DELETE", p),
};

// ===== CONSTANTS & SOCKET =====
const proctorChannel = new BroadcastChannel("proctor_session_channel");
const socket = typeof io === "function" ? io() : null;

// ===== STATE =====
let students      = [];
let submissions   = [];
let adminPeer     = null;
let deleteTargetId= null;
let editingStudentDbId = null;
let liveSessions  = 0;
const sessionMap  = {};

// ===== DOM REFS =====
const adminLoginGate    = document.getElementById("adminLoginGate");
const adminDashboard    = document.getElementById("adminDashboard");
const adminUsername     = document.getElementById("adminUsername");
const adminPassword     = document.getElementById("adminPassword");
const adminLoginBtn     = document.getElementById("adminLoginBtn");
const adminLoginError   = document.getElementById("adminLoginError");
const adminLogoutBtn    = document.getElementById("adminLogoutBtn");

const navItems          = document.querySelectorAll(".nav-item");
const panels            = document.querySelectorAll(".panel");
const panelTitle        = document.getElementById("panelTitle");

const dashTotalStudents    = document.getElementById("dashTotalStudents");
const dashTotalSubmissions = document.getElementById("dashTotalSubmissions");
const dashLiveSessions     = document.getElementById("dashLiveSessions");
const dashTotalInfractions = document.getElementById("dashTotalInfractions");
const activityFeed         = document.getElementById("activityFeed");
const clearActivityBtn     = document.getElementById("clearActivityBtn");
const initTimeEl           = document.getElementById("initTime");

const addStudentBtn        = document.getElementById("addStudentBtn");
const studentFormBox       = document.getElementById("studentFormBox");
const sName                = document.getElementById("sName");
const sId                  = document.getElementById("sId");
const sPin                 = document.getElementById("sPin");
const sExam                = document.getElementById("sExam");
const saveStudentBtn       = document.getElementById("saveStudentBtn");
const cancelStudentFormBtn = document.getElementById("cancelStudentFormBtn");
const studentFormError     = document.getElementById("studentFormError");
const studentsTableBody    = document.getElementById("studentsTableBody");
const studentCountBadge    = document.getElementById("studentCountBadge");

const adminLiveVideo       = document.getElementById("adminLiveVideo");
const adminLiveFrame       = document.getElementById("adminLiveFrame");
const adminNoFeedPlaceholder=document.getElementById("adminNoFeedPlaceholder");
const liveMonitorStatus    = document.getElementById("liveMonitorStatus");
const liveMonitorDot       = document.getElementById("liveMonitorDot");
const liveSessionBadge     = document.getElementById("liveSessionBadge");
const adminSessionTimer    = document.getElementById("adminSessionTimer");
const statTabSwitches      = document.getElementById("statTabSwitches");
const statIntegrity        = document.getElementById("statIntegrity");
const adminAuditLog        = document.getElementById("adminAuditLog");
const telStudent           = document.getElementById("telStudent");
const telStudentId         = document.getElementById("telStudentId");

const multiStudentGrid   = document.getElementById("multiStudentGrid");
const multiGridEmpty     = document.getElementById("multiGridEmpty");
const liveActiveCount    = document.getElementById("liveActiveCount");
const statActiveSessions = document.getElementById("statActiveSessions");
const statTotalTabSwitches = document.getElementById("statTotalTabSwitches");
const statSubmittedCount = document.getElementById("statSubmittedCount");
const clearAuditBtn      = document.getElementById("clearAuditBtn");

const submissionsGrid       = document.getElementById("submissionsGrid");
const submissionCountBadge  = document.getElementById("submissionCountBadge");
const submissionNavBadge    = document.getElementById("submissionNavBadge");
const noSubmissionsMsg      = document.getElementById("noSubmissionsMsg");
const clearSubmissionsBtn   = document.getElementById("clearSubmissionsBtn");

const credModalOverlay    = document.getElementById("credModalOverlay");
const credName            = document.getElementById("credName");
const credStudentId       = document.getElementById("credStudentId");
const credPin             = document.getElementById("credPin");
const credExam            = document.getElementById("credExam");
const closeCredModal      = document.getElementById("closeCredModal");
const closeCredModal2     = document.getElementById("closeCredModal2");
const copyCredBtn         = document.getElementById("copyCredBtn");

const deleteConfirmOverlay= document.getElementById("deleteConfirmOverlay");
const cancelDeleteBtn     = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn    = document.getElementById("confirmDeleteBtn");

// ===== INIT =====
if (initTimeEl) initTimeEl.textContent = new Date().toLocaleTimeString();

// ===== ADMIN LOGIN =====
adminLoginBtn.addEventListener("click", handleAdminLogin);
adminPassword.addEventListener("keydown", e => { if (e.key === "Enter") handleAdminLogin(); });
adminUsername.addEventListener("keydown", e => { if (e.key === "Enter") adminPassword.focus(); });

async function handleAdminLogin() {
  const username = adminUsername.value.trim();
  const password = adminPassword.value.trim();
  adminLoginError.classList.add("hidden");

  if (!username || !password) {
    adminLoginError.textContent = "ERROR: Username and password are required.";
    adminLoginError.classList.remove("hidden");
    return;
  }

  adminLoginBtn.textContent = "AUTHENTICATING...";
  adminLoginBtn.disabled = true;

  try {
    const resp = await API.post("/auth/admin", { username, password });
    API.token = resp.token;
    sessionStorage.setItem("adminToken", resp.token);

    adminLoginGate.style.display = "none";
    adminDashboard.classList.remove("hidden");

    await loadAll();
    setupBroadcastListener();
    proctorChannel.postMessage({ type: "ADMIN_READY" });
  } catch (err) {
    adminLoginError.textContent = `ERROR: ${err.message || "Invalid credentials."}`;
    adminLoginError.classList.remove("hidden");
    adminPassword.value = "";
    adminPassword.focus();
  } finally {
    adminLoginBtn.textContent = "LOGIN »";
    adminLoginBtn.disabled = false;
  }
}

adminLogoutBtn && adminLogoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("adminToken");
  API.token = null;
  adminDashboard.classList.add("hidden");
  adminLoginGate.style.display = "";
  adminPassword.value = "";
  adminUsername.value = "";
});

// Restore session on reload
(function restoreAdminSession() {
  const token = sessionStorage.getItem("adminToken");
  if (token) {
    API.token = token;
    adminLoginGate.style.display = "none";
    adminDashboard.classList.remove("hidden");
    loadAll().then(() => {
      setupBroadcastListener();
      proctorChannel.postMessage({ type: "ADMIN_READY" });
    }).catch(() => {
      sessionStorage.removeItem("adminToken");
      adminDashboard.classList.add("hidden");
      adminLoginGate.style.display = "";
    });
  }
})();

// ===== LOAD ALL DATA =====
async function loadAll() {
  await Promise.all([loadStudents(), loadSubmissions()]);
  renderMultiGrid();
  updateDashboardStats();
}

async function loadStudents() {
  const resp = await API.get("/students");
  students = resp.students || [];
  renderStudentsTable();
}

async function loadSubmissions() {
  const resp = await API.get("/submissions");
  submissions = resp.submissions || [];
  renderSubmissions();
}

// ===== NAVIGATION =====
const panelTitles = {
  dashboard:   "Dashboard Overview",
  students:    "Student Management",
  live:        "Live Monitor",
  submissions: "Submissions",
};

navItems.forEach(item => {
  item.addEventListener("click", () => {
    const target = item.dataset.panel;
    navItems.forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    panels.forEach(p => p.classList.remove("active"));
    const targetPanel = document.getElementById(`panel-${target}`);
    if (targetPanel) targetPanel.classList.add("active");
    if (panelTitle) panelTitle.textContent = panelTitles[target] || target;
  });
});

// ===== DASHBOARD STATS =====
function updateDashboardStats() {
  const totalInfractions = submissions.reduce((acc, s) => acc + (s.tabSwitches || 0), 0);
  if (dashTotalStudents)    dashTotalStudents.textContent    = students.length;
  if (dashTotalSubmissions) dashTotalSubmissions.textContent = submissions.length;
  if (dashLiveSessions)     dashLiveSessions.textContent     = liveSessions;
  if (dashTotalInfractions) dashTotalInfractions.textContent = totalInfractions;
  if (studentCountBadge)    studentCountBadge.textContent    = students.length;
  if (submissionNavBadge)   submissionNavBadge.textContent   = submissions.length;
  if (submissionCountBadge) submissionCountBadge.textContent = `${submissions.length} Total`;
}

// ===== ACTIVITY LOG =====
function logActivity(msg, type = "info") {
  if (!activityFeed) return;
  const time = new Date().toLocaleTimeString();
  const item = document.createElement("div");
  item.className = "activity-item " + type;
  item.innerHTML = `
    <span class="activity-dot"></span>
    <span class="activity-text">${msg}</span>
    <span class="activity-time">${time}</span>
  `;
  activityFeed.prepend(item);
}

clearActivityBtn && clearActivityBtn.addEventListener("click", () => {
  if (activityFeed) activityFeed.innerHTML = "";
});

// ===== AUDIT LOG =====
function appendAuditLog(msg, type = "info") {
  if (!adminAuditLog) return;
  const entry = document.createElement("div");
  const time = new Date().toLocaleTimeString();
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  adminAuditLog.appendChild(entry);
  adminAuditLog.scrollTop = adminAuditLog.scrollHeight;
}

clearAuditBtn && clearAuditBtn.addEventListener("click", () => {
  if (adminAuditLog) adminAuditLog.innerHTML = "";
});

// ===== MULTI-STUDENT GRID =====
function renderMultiGrid() {
  if (!multiStudentGrid) return;
  multiStudentGrid.querySelectorAll(".student-tile").forEach(t => t.remove());

  if (students.length === 0) {
    if (multiGridEmpty) multiGridEmpty.style.display = "";
    return;
  }
  if (multiGridEmpty) multiGridEmpty.style.display = "none";

  students.forEach(student => {
    if (!sessionMap[student.studentId]) {
      sessionMap[student.studentId] = {
        status: student.status || "pending",
        tabSwitches: 0, duration: "00:00", lastFrame: null,
      };
    }
    const tile = document.createElement("div");
    tile.className = "student-tile";
    tile.id = `tile-${student.studentId}`;
    const state = sessionMap[student.studentId];
    const tileClass = getTileClass(state.status);
    if (tileClass) tile.classList.add(tileClass);
    tile.innerHTML = buildTileHTML(student, state);
    multiStudentGrid.appendChild(tile);
  });

  updateLiveSidebar();
}

function getTileClass(status) {
  if (status === "active")    return "tile-active";
  if (status === "warning")   return "tile-warning";
  if (status === "submitted") return "tile-submitted";
  return "";
}

function buildTileHTML(student, state) {
  const hasLive = state.status === "active" || state.status === "warning";
  const hasSwitches = state.tabSwitches > 0;
  const statusLabel = { pending:"Waiting", active:"Live", warning:"⚠ Warning", submitted:"Submitted" }[state.status] || "Waiting";
  const statusClass = { pending:"waiting", active:"active", warning:"warning", submitted:"submitted" }[state.status] || "waiting";

  return `
    <div class="tile-feed">
      ${state.lastFrame
        ? `<img class="tile-feed-img" src="${state.lastFrame}" alt="Live feed" />`
        : `<div class="tile-feed-placeholder">
             <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
             <span>Camera not started</span>
           </div>`}
      ${hasLive ? `<div class="tile-live-badge"><span class="dot"></span> LIVE</div>` : ""}
      ${hasLive ? `<div class="tile-duration-badge">${state.duration}</div>` : ""}
    </div>
    <div class="tile-info">
      <div class="tile-name">${escHtml(student.name)}</div>
      <div class="tile-id">${escHtml(student.studentId)}</div>
      <div class="tile-meta">
        <span class="tile-status-pill ${statusClass}">${statusLabel}</span>
        <span class="tile-switches ${hasSwitches ? "has-switches" : ""}">
          ${hasSwitches ? "⚠" : "✓"} ${state.tabSwitches} switch${state.tabSwitches !== 1 ? "es" : ""}
        </span>
      </div>
      ${student.exam ? `<div class="tile-exam">${escHtml(student.exam)}</div>` : ""}
    </div>
  `;
}

function updateTileFrame(studentId, frameDataUrl, duration) {
  if (!sessionMap[studentId]) return;
  sessionMap[studentId].lastFrame = frameDataUrl;
  sessionMap[studentId].duration  = duration || sessionMap[studentId].duration;

  const tile = document.getElementById(`tile-${studentId}`);
  if (!tile) return;

  let img = tile.querySelector(".tile-feed-img");
  if (!img) {
    const placeholder = tile.querySelector(".tile-feed-placeholder");
    if (placeholder) placeholder.remove();
    img = document.createElement("img");
    img.className = "tile-feed-img";
    img.alt = "Live feed";
    const feed = tile.querySelector(".tile-feed");
    const liveBadge = tile.querySelector(".tile-live-badge");
    feed.insertBefore(img, liveBadge);
  }
  img.src = frameDataUrl;

  const durBadge = tile.querySelector(".tile-duration-badge");
  if (durBadge) durBadge.textContent = duration;
}

function updateTileStatus(studentId, status, tabSwitches) {
  const state = sessionMap[studentId];
  if (!state) return;
  state.status = status;
  if (typeof tabSwitches === "number") state.tabSwitches = tabSwitches;

  const tile = document.getElementById(`tile-${studentId}`);
  if (!tile) return;

  tile.className = "student-tile";
  const cls = getTileClass(state.status);
  if (cls) tile.classList.add(cls);

  const pill = tile.querySelector(".tile-status-pill");
  if (pill) {
    const labels = { pending:"Waiting", active:"Live", warning:"⚠ Warning", submitted:"Submitted" };
    const classes = { pending:"waiting", active:"active", warning:"warning", submitted:"submitted" };
    pill.textContent = labels[state.status] || "Waiting";
    pill.className = `tile-status-pill ${classes[state.status] || "waiting"}`;
  }

  const sw = tile.querySelector(".tile-switches");
  if (sw) {
    const hasSw = state.tabSwitches > 0;
    sw.className = `tile-switches ${hasSw ? "has-switches" : ""}`;
    sw.textContent = `${hasSw ? "⚠" : "✓"} ${state.tabSwitches} switch${state.tabSwitches !== 1 ? "es" : ""}`;
  }

  const liveBadge = tile.querySelector(".tile-live-badge");
  const durBadge  = tile.querySelector(".tile-duration-badge");
  const isLive = status === "active" || status === "warning";

  if (isLive && !liveBadge) {
    const feed = tile.querySelector(".tile-feed");
    const lb = document.createElement("div");
    lb.className = "tile-live-badge";
    lb.innerHTML = `<span class="dot"></span> LIVE`;
    feed.appendChild(lb);
    const db = document.createElement("div");
    db.className = "tile-duration-badge";
    db.textContent = state.duration;
    feed.appendChild(db);
  } else if (!isLive && liveBadge) {
    liveBadge.remove();
    if (durBadge) durBadge.remove();
  }

  updateLiveSidebar();
}

function updateLiveSidebar() {
  let activeCount = 0, totalSwitches = 0, submittedCount = 0;
  Object.values(sessionMap).forEach(s => {
    if (s.status === "active" || s.status === "warning") activeCount++;
    if (s.status === "submitted") submittedCount++;
    totalSwitches += s.tabSwitches || 0;
  });

  liveSessions = activeCount;
  if (liveActiveCount) liveActiveCount.textContent = `${activeCount} Active`;
  if (statActiveSessions) statActiveSessions.textContent = activeCount;
  if (statTotalTabSwitches) {
    statTotalTabSwitches.textContent = totalSwitches;
    statTotalTabSwitches.className = `session-stat-val ${totalSwitches > 0 ? "warn" : ""}`;
  }
  if (statSubmittedCount) statSubmittedCount.textContent = submittedCount;

  if (liveSessionBadge) {
    if (activeCount > 0) { liveSessionBadge.classList.remove("hidden"); liveSessionBadge.textContent = "LIVE"; }
    else liveSessionBadge.classList.add("hidden");
  }

  if (liveMonitorStatus) {
    if (activeCount > 0) { liveMonitorStatus.textContent = `🟢 ${activeCount} Live`; liveMonitorStatus.className = "status-pill active"; }
    else if (submittedCount > 0) { liveMonitorStatus.textContent = `${submittedCount} Submitted`; liveMonitorStatus.className = "status-pill submitted"; }
    else { liveMonitorStatus.textContent = "Waiting..."; liveMonitorStatus.className = "status-pill waiting"; }
  }
  updateDashboardStats();
}

// ===== STUDENT MANAGEMENT =====
addStudentBtn.addEventListener("click", () => {
  editingStudentDbId = null;
  clearStudentForm();
  studentFormBox.classList.toggle("hidden");
  if (!studentFormBox.classList.contains("hidden")) {
    addStudentBtn.textContent = "✕ Cancel Add";
    sName.focus();
  } else {
    addStudentBtn.textContent = "+ Add Student";
  }
});

cancelStudentFormBtn.addEventListener("click", () => {
  studentFormBox.classList.add("hidden");
  addStudentBtn.textContent = "+ Add Student";
  editingStudentDbId = null;
  clearStudentForm();
});

function clearStudentForm() {
  sName.value = "";
  sId.value = "";
  sPin.value = "";
  if (sExam) sExam.value = "";
  if (studentFormError) { studentFormError.textContent = ""; studentFormError.classList.add("hidden"); }
}

saveStudentBtn.addEventListener("click", handleSaveStudent);

async function handleSaveStudent() {
  const name = sName.value.trim();
  const studentId = (sId.value || "").trim().toUpperCase();
  const pin = (sPin.value || "").trim();
  const exam = sExam ? sExam.value.trim() : "";

  if (!name || !studentId || !pin) {
    showFormError("Name, Student ID, and PIN are required.");
    return;
  }
  if (!/^\d{4,8}$/.test(pin)) {
    showFormError("PIN must be 4–8 digits only.");
    return;
  }

  saveStudentBtn.disabled = true;
  saveStudentBtn.textContent = "Saving...";

  try {
    if (editingStudentDbId) {
      const resp = await API.put(`/students/${editingStudentDbId}`, { name, studentId, pin, exam });
      const idx = students.findIndex(s => s._id === editingStudentDbId);
      if (idx !== -1) students[idx] = resp.student;
      logActivity(`Student updated: ${name} (${studentId})`, "info");
    } else {
      const resp = await API.post("/students", { name, studentId, pin, exam });
      students.unshift(resp.student);
      showCredentialCard({ name, studentId, pin, exam });
      logActivity(`Student added: ${name} (${studentId})`, "success");
    }

    renderStudentsTable();
    renderMultiGrid();
    updateDashboardStats();
    studentFormBox.classList.add("hidden");
    addStudentBtn.textContent = "+ Add Student";
    clearStudentForm();
    editingStudentDbId = null;
  } catch (err) {
    showFormError(err.message || "Failed to save student.");
  } finally {
    saveStudentBtn.disabled = false;
    saveStudentBtn.textContent = "Save Student";
  }
}

function showFormError(msg) {
  if (!studentFormError) return;
  studentFormError.textContent = msg;
  studentFormError.classList.remove("hidden");
}

function renderStudentsTable() {
  if (!studentsTableBody) return;
  studentsTableBody.innerHTML = "";

  if (students.length === 0) {
    studentsTableBody.innerHTML = `<tr class="no-data-row"><td colspan="7">No students added yet. Click "+ Add Student" to get started.</td></tr>`;
    return;
  }

  students.forEach(student => {
    const row = document.createElement("tr");
    const status = student.status || "pending";
    row.innerHTML = `
      <td>${escHtml(student.name)}</td>
      <td><code>${escHtml(student.studentId)}</code></td>
      <td class="pin-cell">
        <span class="pin-hidden" id="pin-${student._id}">••••••</span>
      </td>
      <td>${escHtml(student.exam || "—")}</td>
      <td><span class="status-pill ${status}">${capitalize(status)}</span></td>
      <td>
        <button class="btn-sm" onclick="showCredentialCard({name:'${escJs(student.name)}',studentId:'${escJs(student.studentId)}',pin:'****',exam:'${escJs(student.exam||'')}'},true)">Cred</button>
        <button class="btn-sm" onclick="editStudent('${student._id}')">Edit</button>
        <button class="btn-sm danger" onclick="promptDelete('${student._id}')">Del</button>
      </td>
    `;
    studentsTableBody.appendChild(row);
  });
}

function editStudent(dbId) {
  const student = students.find(s => s._id === dbId);
  if (!student) return;
  editingStudentDbId = dbId;
  sName.value = student.name;
  sId.value   = student.studentId;
  sPin.value  = "";
  if (sExam) sExam.value = student.exam || "";
  studentFormBox.classList.remove("hidden");
  addStudentBtn.textContent = "✕ Cancel Edit";
  sName.focus();
}

function promptDelete(dbId) {
  deleteTargetId = dbId;
  if (deleteConfirmOverlay) deleteConfirmOverlay.classList.remove("hidden");
}

cancelDeleteBtn && cancelDeleteBtn.addEventListener("click", () => {
  deleteTargetId = null;
  if (deleteConfirmOverlay) deleteConfirmOverlay.classList.add("hidden");
});

confirmDeleteBtn && confirmDeleteBtn.addEventListener("click", async () => {
  if (!deleteTargetId) return;
  const student = students.find(s => s._id === deleteTargetId);
  try {
    await API.delete(`/students/${deleteTargetId}`);
    if (student && student.studentId) delete sessionMap[student.studentId];
    students = students.filter(s => s._id !== deleteTargetId);
    renderStudentsTable();
    renderMultiGrid();
    updateDashboardStats();
    if (student) logActivity(`Student removed: ${student.name} (${student.studentId})`, "error");
  } catch (err) {
    alert("Failed to delete student: " + err.message);
  } finally {
    deleteTargetId = null;
    if (deleteConfirmOverlay) deleteConfirmOverlay.classList.add("hidden");
  }
});

// ===== CREDENTIAL CARD =====
function showCredentialCard(student, pinHidden = false) {
  if (!credModalOverlay) return;
  credName.textContent      = student.name;
  credStudentId.textContent = student.studentId;
  credPin.textContent       = pinHidden ? "(hidden)" : student.pin;
  credExam.textContent      = student.exam || "—";
  credModalOverlay.classList.remove("hidden");
}

// Ensure global accessibility for inline onclick handlers
window.editStudent = editStudent;
window.promptDelete = promptDelete;
window.showCredentialCard = showCredentialCard;

closeCredModal  && closeCredModal.addEventListener("click",  () => credModalOverlay.classList.add("hidden"));
closeCredModal2 && closeCredModal2.addEventListener("click", () => credModalOverlay.classList.add("hidden"));

copyCredBtn && copyCredBtn.addEventListener("click", () => {
  const text = `Student ID: ${credStudentId.textContent}\nPIN: ${credPin.textContent}\nExam: ${credExam.textContent}`;
  navigator.clipboard.writeText(text).then(() => {
    copyCredBtn.textContent = "✓ Copied!";
    setTimeout(() => { copyCredBtn.textContent = "Copy"; }, 1500);
  });
});

// ===== SUBMISSIONS =====
function renderSubmissions() {
  if (!submissionsGrid) return;
  submissionsGrid.innerHTML = "";
  updateDashboardStats();

  if (submissions.length === 0) {
    submissionsGrid.innerHTML = `<div class="no-data-msg" id="noSubmissionsMsg">No student assessments submitted yet.</div>`;
    return;
  }

  submissions.forEach(sub => {
    const integrityClass = sub.tabSwitches === 0 ? "ok" : sub.tabSwitches <= 2 ? "warn" : "danger";
    const card = document.createElement("div");
    card.className = "submission-card";
    card.innerHTML = `
      <div class="sub-photo-col">
        ${sub.snapshot
          ? `<img src="${sub.snapshot}" alt="Candidate photo" class="sub-photo" />`
          : `<div class="sub-no-photo">No Photo</div>`}
      </div>
      <div class="sub-details">
        <div class="sub-name">${escHtml(sub.candidateName || "—")}</div>
        <div class="sub-meta">
          <span class="sub-badge" id="sid">${escHtml(sub.studentId || "—")}</span>
          <span class="sub-badge ${integrityClass}">${sub.tabSwitches || 0} switches</span>
        </div>
        <div class="sub-info-grid">
          <span><strong>DOB:</strong> ${escHtml(sub.dob || "—")}</span>
          <span><strong>State:</strong> ${escHtml(sub.state || "—")}</span>
          <span><strong>District:</strong> ${escHtml(sub.district || "—")}</span>
          <span><strong>City:</strong> ${escHtml(sub.city || "—")}</span>
          <span><strong>Duration:</strong> ${escHtml(sub.duration || "—")}</span>
          <span><strong>Submitted:</strong> ${sub.createdAt ? new Date(sub.createdAt).toLocaleString() : "—"}</span>
        </div>
      </div>
    `;
    submissionsGrid.appendChild(card);
  });
}

clearSubmissionsBtn && clearSubmissionsBtn.addEventListener("click", async () => {
  if (!confirm("Clear ALL submissions? This will also reset student statuses to pending.")) return;
  try {
    await API.delete("/submissions");
    submissions = [];
    students = students.map(s => ({ ...s, status: "pending" }));
    renderSubmissions();
    renderStudentsTable();
    renderMultiGrid();
    logActivity("All submissions cleared.", "error");
  } catch (err) {
    alert("Failed to clear submissions: " + err.message);
  }
});

// ===== BROADCAST & SOCKET LISTENER =====
function setupBroadcastListener() {
  if (socket) {
    socket.emit("join", { role: "admin" });
    socket.on("proctor_event", (msg) => {
      handleProctorMessage(msg);
    });
  }

  proctorChannel.onmessage = (event) => {
    handleProctorMessage(event.data);
  };
}

async function handleProctorMessage(msg) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "SESSION_START": {
      if (msg.studentId) {
        const st = students.find(s => s.studentId === msg.studentId);
        if (st) {
          st.status = "active";
          renderStudentsTable();
          if (!sessionMap[msg.studentId]) {
            sessionMap[msg.studentId] = { status: "active", tabSwitches: 0, duration: "00:00", lastFrame: null };
          } else {
            sessionMap[msg.studentId].status = "active";
          }
          updateTileStatus(msg.studentId, "active");
        }
      }
      appendAuditLog(`🟢 Student joined: ${msg.studentId || "Unknown"}`, "success");
      logActivity(`Session started — ID: ${msg.studentId || "?"}`, "success");
      break;
    }

    case "SESSION_STATE": break;

    case "STREAM_FRAME": {
      if (msg.studentId && msg.frame) {
        if (!sessionMap[msg.studentId]) {
          sessionMap[msg.studentId] = { status: "active", tabSwitches: 0, duration: "00:00", lastFrame: null };
        }
        updateTileFrame(msg.studentId, msg.frame, msg.sessionTimer || "00:00");
      } else if (msg.frame) {
        const firstActive = Object.keys(sessionMap).find(k => sessionMap[k].status === "active" || sessionMap[k].status === "warning");
        if (firstActive) updateTileFrame(firstActive, msg.frame, msg.sessionTimer || "00:00");
      }
      break;
    }

    case "TAB_SWITCH": {
      const swId = msg.studentId || null;
      if (swId && sessionMap[swId]) {
        sessionMap[swId].tabSwitches = msg.count;
        updateTileStatus(swId, "warning", msg.count);
        setTimeout(() => {
          if (sessionMap[swId] && sessionMap[swId].status === "warning") updateTileStatus(swId, "active");
        }, 4000);
      }
      appendAuditLog(`⚠️ Focus lost — ${swId || "?"} (Total: ${msg.count})`, "warning");
      logActivity(`Tab switch — ID: ${swId || "?"}`, "warning");
      updateLiveSidebar();
      break;
    }

    case "SUBMISSION": {
      const d = msg.data || {};
      // Refresh submissions from API (real data is in DB)
      try {
        await loadSubmissions();
      } catch (_) {}
      if (d.studentId && sessionMap[d.studentId]) {
        sessionMap[d.studentId].status = "submitted";
        updateTileStatus(d.studentId, "submitted");
      }
      appendAuditLog(`✅ Submitted: ${d.studentId || "?"}`, "success");
      logActivity(`Submission received — ${[d.firstName, d.lastName].filter(Boolean).join(" ")} (${d.studentId || "?"})`, "success");
      updateLiveSidebar();
      break;
    }

    case "RTC_OFFER": {
      if (msg.offer) await handleRTCOffer(msg.offer);
      break;
    }
    case "RTC_ICE_CANDIDATE": {
      if (adminPeer && msg.candidate) {
        try { await adminPeer.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch(_) {}
      }
      break;
    }
  }
}

// ===== WEBRTC (legacy single-feed fallback) =====
async function handleRTCOffer(offer) {
  if (adminPeer) { try { adminPeer.close(); } catch(_) {} }
  adminPeer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  adminPeer.ontrack = (event) => {
    if (adminLiveVideo && event.streams[0]) {
      adminLiveVideo.srcObject = event.streams[0];
    }
  };

  adminPeer.onicecandidate = (e) => {
    if (e.candidate) {
      proctorChannel.postMessage({ type: "RTC_ICE_CANDIDATE", candidate: e.candidate });
    }
  };

  await adminPeer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await adminPeer.createAnswer();
  await adminPeer.setLocalDescription(answer);
  proctorChannel.postMessage({ type: "RTC_ANSWER", answer });
}

// ===== UTILITY =====
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function escJs(str) {
  if (typeof str !== "string") return "";
  return str.replace(/'/g, "\\'");
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
