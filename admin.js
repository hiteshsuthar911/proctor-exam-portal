/**
 * ProctorAdmin — Advanced Admin Dashboard JS
 * Multi-student login with assigned ID & PIN
 * Live monitor via BroadcastChannel + WebRTC
 */

// ===== CONSTANTS =====
const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };
const LS_STUDENTS = "proctor_students_v2";
const LS_SUBMISSIONS = "proctor_submissions_v2";
const proctorChannel = new BroadcastChannel("proctor_session_channel");

// ===== STATE =====
let students = [];       // { id, name, studentId, pin, exam, status }
let submissions = [];    // { ...data }
let adminPeer = null;
let deleteTargetId = null;
let editingStudentId = null;
let liveSessions = 0;

// ===== DOM REFS =====
const adminLoginGate    = document.getElementById("adminLoginGate");
const adminDashboard    = document.getElementById("adminDashboard");
const adminUsername     = document.getElementById("adminUsername");
const adminPassword     = document.getElementById("adminPassword");
const adminLoginBtn     = document.getElementById("adminLoginBtn");
const adminLoginError   = document.getElementById("adminLoginError");
const adminLogoutBtn    = document.getElementById("adminLogoutBtn");

// Nav
const navItems          = document.querySelectorAll(".nav-item");
const panels            = document.querySelectorAll(".panel");
const panelTitle        = document.getElementById("panelTitle");

// Dashboard
const dashTotalStudents    = document.getElementById("dashTotalStudents");
const dashTotalSubmissions = document.getElementById("dashTotalSubmissions");
const dashLiveSessions     = document.getElementById("dashLiveSessions");
const dashTotalInfractions = document.getElementById("dashTotalInfractions");
const activityFeed         = document.getElementById("activityFeed");
const clearActivityBtn     = document.getElementById("clearActivityBtn");
const initTimeEl           = document.getElementById("initTime");

// Students panel
const addStudentBtn        = document.getElementById("addStudentBtn");
const studentFormBox       = document.getElementById("studentFormBox");
const sName                = document.getElementById("sName");
const sId                  = document.getElementById("sId");
const sPin                 = document.getElementById("sPin");
const sExam                = document.getElementById("sExam");
const saveStudentBtn       = document.getElementById("saveStudentBtn");

// Submissions
const submissionsGrid       = document.getElementById("submissionsGrid");
const submissionCountBadge  = document.getElementById("submissionCountBadge");
const submissionNavBadge    = document.getElementById("submissionNavBadge");
const noSubmissionsMsg      = document.getElementById("noSubmissionsMsg");
const clearSubmissionsBtn   = document.getElementById("clearSubmissionsBtn");

// Modals
const credModalOverlay      = document.getElementById("credModalOverlay");
const credName              = document.getElementById("credName");
const credStudentId         = document.getElementById("credStudentId");
const credPin               = document.getElementById("credPin");
const credExam              = document.getElementById("credExam");
const closeCredModal        = document.getElementById("closeCredModal");
const closeCredModal2       = document.getElementById("closeCredModal2");
const copyCredBtn           = document.getElementById("copyCredBtn");

const deleteConfirmOverlay  = document.getElementById("deleteConfirmOverlay");
const cancelDeleteBtn       = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn      = document.getElementById("confirmDeleteBtn");

const cancelStudentFormBtn = document.getElementById("cancelStudentFormBtn");
const studentFormError     = document.getElementById("studentFormError");
const studentsTableBody    = document.getElementById("studentsTableBody");
const studentCountBadge    = document.getElementById("studentCountBadge");

// Live monitor
const adminLiveVideo       = document.getElementById("adminLiveVideo");
const adminLiveFrame       = document.getElementById("adminLiveFrame");
const adminNoFeedPlaceholder = document.getElementById("adminNoFeedPlaceholder");
const liveMonitorStatus    = document.getElementById("liveMonitorStatus");
const liveMonitorDot       = document.getElementById("liveMonitorDot");
const liveSessionBadge     = document.getElementById("liveSessionBadge");
const adminSessionTimer    = document.getElementById("adminSessionTimer");
const statTabSwitches      = document.getElementById("statTabSwitches");
const statIntegrity        = document.getElementById("statIntegrity");
const adminAuditLog        = document.getElementById("adminAuditLog");
const telStudent           = document.getElementById("telStudent");
const telStudentId         = document.getElementById("telStudentId");

// Multi-student grid
const multiStudentGrid   = document.getElementById("multiStudentGrid");
const multiGridEmpty     = document.getElementById("multiGridEmpty");
const liveActiveCount    = document.getElementById("liveActiveCount");
const statActiveSessions = document.getElementById("statActiveSessions");
const statTotalTabSwitches = document.getElementById("statTotalTabSwitches");
const statSubmittedCount = document.getElementById("statSubmittedCount");
const clearAuditBtn      = document.getElementById("clearAuditBtn");

// ===== SESSION MAP =====
// Tracks real-time state for every registered student
// key = studentId, value = { name, exam, status, tabSwitches, duration, lastFrame }
const sessionMap = {};

// ===== INIT =====
function init() {
  if (initTimeEl) initTimeEl.textContent = new Date().toLocaleTimeString();
  loadFromStorage();
  updateDashboardStats();
  renderStudentsTable();
  renderSubmissions();
  renderMultiGrid();          // build live grid from registered students
  setupBroadcastListener();
  // Announce to any waiting student tabs that admin is online
  proctorChannel.postMessage({ type: "ADMIN_READY" });
}

// ===== LOCAL STORAGE =====
function loadFromStorage() {
  try {
    const s = localStorage.getItem(LS_STUDENTS);
    if (s) students = JSON.parse(s);
  } catch(e) {}
  try {
    const sub = localStorage.getItem(LS_SUBMISSIONS);
    if (sub) submissions = JSON.parse(sub);
  } catch(e) {}
}

function saveStudentsToStorage() {
  try { localStorage.setItem(LS_STUDENTS, JSON.stringify(students)); } catch(e) {}
}
function saveSubmissionsToStorage() {
  try { localStorage.setItem(LS_SUBMISSIONS, JSON.stringify(submissions)); } catch(e) {}
}

// ===== LOGIN =====
adminLoginBtn.addEventListener("click", handleAdminLogin);
adminPassword.addEventListener("keydown", e => { if (e.key === "Enter") handleAdminLogin(); });

function handleAdminLogin() {
  const user = adminUsername.value.trim();
  const pass = adminPassword.value;
  if (user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password) {
    adminLoginGate.style.display = "none";
    adminDashboard.classList.remove("hidden");
    init();
    // Broadcast admin is ready to any active student tab
    proctorChannel.postMessage({ type: "ADMIN_READY" });
  } else {
    adminLoginError.classList.remove("hidden");
    adminPassword.value = "";
    adminPassword.focus();
  }
}

adminLogoutBtn.addEventListener("click", () => {
  adminDashboard.classList.add("hidden");
  adminLoginGate.style.display = "";
  adminPassword.value = "";
  adminLoginError.classList.add("hidden");
  adminUsername.value = "";
});

// ===== NAVIGATION =====
const panelTitles = {
  dashboard:   "Dashboard Overview",
  students:    "Student Management",
  live:        "Live Monitor",
  submissions: "Submissions"
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
  activityFeed.innerHTML = "";
});

// ===== AUDIT LOG (LIVE MONITOR) =====
function appendAuditLog(msg, type = "info") {
  const entry = document.createElement("div");
  const time = new Date().toLocaleTimeString();
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  adminAuditLog.appendChild(entry);
  adminAuditLog.scrollTop = adminAuditLog.scrollHeight;
}

clearAuditBtn && clearAuditBtn.addEventListener("click", () => {
  adminAuditLog.innerHTML = "";
});

// ===== MULTI-STUDENT GRID =====

/**
 * Build (or rebuild) the live grid from the current students array.
 * Existing tiles are removed and recreated — call this after adding/removing students.
 */
function renderMultiGrid() {
  if (!multiStudentGrid) return;

  // Clear existing tiles (keep the empty-state placeholder in DOM)
  multiStudentGrid.querySelectorAll(".student-tile").forEach(t => t.remove());

  if (students.length === 0) {
    if (multiGridEmpty) multiGridEmpty.style.display = "";
    return;
  }
  if (multiGridEmpty) multiGridEmpty.style.display = "none";

  students.forEach(student => {
    // Initialise session state if not yet present
    if (!sessionMap[student.studentId]) {
      sessionMap[student.studentId] = {
        status: student.status || "pending",
        tabSwitches: 0,
        duration: "00:00",
        lastFrame: null
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

/** Returns the CSS modifier class for a given status string */
function getTileClass(status) {
  if (status === "active")    return "tile-active";
  if (status === "warning")   return "tile-warning";
  if (status === "submitted") return "tile-submitted";
  return "";
}

/** Builds the inner HTML for a student tile */
function buildTileHTML(student, state) {
  const hasLive = state.status === "active" || state.status === "warning";
  const hasSwitches = state.tabSwitches > 0;
  const statusLabel = {
    pending:   "Waiting",
    active:    "Live",
    warning:   "⚠ Warning",
    submitted: "Submitted"
  }[state.status] || "Waiting";
  const statusClass = {
    pending:   "waiting",
    active:    "active",
    warning:   "warning",
    submitted: "submitted"
  }[state.status] || "waiting";

  return `
    <div class="tile-feed">
      ${state.lastFrame
        ? `<img class="tile-feed-img" src="${state.lastFrame}" alt="Live feed" />`
        : `<div class="tile-feed-placeholder">
             <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
             <span>Camera not started</span>
           </div>`
      }
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

/**
 * Update a single student's tile with a new live frame and duration.
 * Fast path: only updates the img src and duration badge without full rebuild.
 */
function updateTileFrame(studentId, frameDataUrl, duration) {
  if (!sessionMap[studentId]) return;
  sessionMap[studentId].lastFrame = frameDataUrl;
  sessionMap[studentId].duration  = duration || sessionMap[studentId].duration;

  const tile = document.getElementById(`tile-${studentId}`);
  if (!tile) return;

  // Update or insert the feed image
  let img = tile.querySelector(".tile-feed-img");
  if (!img) {
    const placeholder = tile.querySelector(".tile-feed-placeholder");
    if (placeholder) placeholder.remove();
    img = document.createElement("img");
    img.className = "tile-feed-img";
    img.alt = "Live feed";
    tile.querySelector(".tile-feed").insertBefore(img, tile.querySelector(".tile-live-badge"));
  }
  img.src = frameDataUrl;

  // Update duration badge
  const durBadge = tile.querySelector(".tile-duration-badge");
  if (durBadge) durBadge.textContent = duration;
}

/**
 * Update a student tile's status class, status pill text, and tab-switch counter.
 */
function updateTileStatus(studentId, status, tabSwitches) {
  const state = sessionMap[studentId];
  if (!state) return;
  state.status = status;
  if (typeof tabSwitches === "number") state.tabSwitches = tabSwitches;

  const tile = document.getElementById(`tile-${studentId}`);
  if (!tile) return;

  // Update border class
  tile.className = "student-tile";
  const cls = getTileClass(state.status);
  if (cls) tile.classList.add(cls);

  // Update status pill
  const pill = tile.querySelector(".tile-status-pill");
  if (pill) {
    const labels = { pending: "Waiting", active: "Live", warning: "⚠ Warning", submitted: "Submitted" };
    const classes = { pending: "waiting", active: "active", warning: "warning", submitted: "submitted" };
    pill.textContent = labels[state.status] || "Waiting";
    pill.className = `tile-status-pill ${classes[state.status] || "waiting"}`;
  }

  // Update switches counter
  const sw = tile.querySelector(".tile-switches");
  if (sw) {
    const hasSw = state.tabSwitches > 0;
    sw.className = `tile-switches ${hasSw ? "has-switches" : ""}`;
    sw.textContent = `${hasSw ? "⚠" : "✓"} ${state.tabSwitches} switch${state.tabSwitches !== 1 ? "es" : ""}`;
  }

  // Show/hide LIVE badge & duration badge depending on active state
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

/** Recalculate the active/switches/submitted counts in the right sidebar */
function updateLiveSidebar() {
  let activeCount = 0;
  let totalSwitches = 0;
  let submittedCount = 0;

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

  // Update the sidebar live badge in nav
  if (liveSessionBadge) {
    if (activeCount > 0) {
      liveSessionBadge.classList.remove("hidden");
      liveSessionBadge.textContent = "LIVE";
    } else {
      liveSessionBadge.classList.add("hidden");
    }
  }

  // Update overall status pill
  if (liveMonitorStatus) {
    if (activeCount > 0) {
      liveMonitorStatus.textContent = `🟢 ${activeCount} Live`;
      liveMonitorStatus.className = "status-pill active";
    } else if (submittedCount > 0) {
      liveMonitorStatus.textContent = `${submittedCount} Submitted`;
      liveMonitorStatus.className = "status-pill submitted";
    } else {
      liveMonitorStatus.textContent = "Waiting...";
      liveMonitorStatus.className = "status-pill waiting";
    }
  }

  updateDashboardStats();
}

// ===== ACTIVITY LOG =====
function logActivity(msg, type = "info") {
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
  activityFeed.innerHTML = "";
});

// ===== AUDIT LOG (LIVE MONITOR) =====
function appendAuditLog(msg, type = "info") {
  const entry = document.createElement("div");
  const time = new Date().toLocaleTimeString();
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  adminAuditLog.appendChild(entry);
  adminAuditLog.scrollTop = adminAuditLog.scrollHeight;
}

// ===== STUDENT MANAGEMENT =====
addStudentBtn.addEventListener("click", () => {
  editingStudentId = null;
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
  editingStudentId = null;
  clearStudentForm();
});

function clearStudentForm() {
  sName.value = "";
  sId.value = "";
  sPin.value = "";
  sExam.value = "";
  studentFormError.classList.add("hidden");
  studentFormError.textContent = "";
  saveStudentBtn.textContent = "Save Student";
}

saveStudentBtn.addEventListener("click", saveStudent);

function saveStudent() {
  const name = sName.value.trim();
  const id   = sId.value.trim().toUpperCase();
  const pin  = sPin.value.trim();
  const exam = sExam.value.trim();

  // Validation
  if (!name) return showFormError("Full Name is required.");
  if (!id)   return showFormError("Student ID is required.");
  if (!pin || !/^\d{4,8}$/.test(pin)) return showFormError("PIN must be 4–8 digits.");

  // Duplicate check (skip for edits on same id)
  const duplicate = students.find(s => s.studentId === id && s.id !== editingStudentId);
  if (duplicate) return showFormError(`Student ID "${id}" is already taken.`);

  if (editingStudentId) {
    // Edit existing
    const idx = students.findIndex(s => s.id === editingStudentId);
    if (idx !== -1) {
      students[idx] = { ...students[idx], name, studentId: id, pin, exam };
      logActivity(`Student updated: ${name} (${id})`, "success");
    }
    editingStudentId = null;
  } else {
    // Add new
    const newStudent = {
      id: crypto.randomUUID(),
      name, studentId: id, pin, exam,
      status: "pending",
      createdAt: new Date().toLocaleString()
    };
    students.push(newStudent);
    logActivity(`New student registered: ${name} — ID: ${id}`, "success");

    // Show credential card
    showCredentialCard(newStudent);
  }

  saveStudentsToStorage();
  updateDashboardStats();
  renderStudentsTable();
  renderMultiGrid();   // refresh live grid to show new student tile

  studentFormBox.classList.add("hidden");
  addStudentBtn.textContent = "+ Add Student";
  clearStudentForm();
}

function showFormError(msg) {
  studentFormError.textContent = msg;
  studentFormError.classList.remove("hidden");
}

function renderStudentsTable() {
  if (students.length === 0) {
    studentsTableBody.innerHTML = `
      <tr class="no-data-row"><td colspan="7">No students added yet. Click "+ Add Student" to get started.</td></tr>
    `;
    return;
  }

  studentsTableBody.innerHTML = "";
  students.forEach((s, i) => {
    const statusClass = {
      pending:   "waiting",
      active:    "active",
      submitted: "submitted",
      finished:  "finished"
    }[s.status] || "waiting";

    const statusLabel = {
      pending:   "Pending",
      active:    "Active (Live)",
      submitted: "Submitted",
      finished:  "Finished"
    }[s.status] || "Pending";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td class="mono">${escHtml(s.studentId)}</td>
      <td>
        <span class="pin-masked" data-reveal="false" data-pin="${escHtml(s.pin)}">••••</span>
        <button class="reveal-pin-btn" data-sid="${escHtml(s.id)}">Show</button>
      </td>
      <td>${escHtml(s.exam || "—")}</td>
      <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-icon" title="View Credentials" data-action="cred" data-sid="${escHtml(s.id)}">🪪</button>
          <button class="btn-icon" title="Edit" data-action="edit" data-sid="${escHtml(s.id)}">✏️</button>
          <button class="btn-icon danger" title="Remove" data-action="delete" data-sid="${escHtml(s.id)}">🗑️</button>
        </div>
      </td>
    `;
    studentsTableBody.appendChild(tr);
  });

  // Reveal PIN toggle
  studentsTableBody.querySelectorAll(".reveal-pin-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const sid = btn.dataset.sid;
      const student = students.find(s => s.id === sid);
      if (!student) return;
      const pinSpan = btn.previousElementSibling;
      const revealed = pinSpan.dataset.reveal === "true";
      if (revealed) {
        pinSpan.textContent = "••••";
        pinSpan.dataset.reveal = "false";
        btn.textContent = "Show";
      } else {
        pinSpan.textContent = student.pin;
        pinSpan.dataset.reveal = "true";
        btn.textContent = "Hide";
      }
    });
  });

  // Action buttons
  studentsTableBody.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const sid = btn.dataset.sid;
      const student = students.find(s => s.id === sid);
      if (!student) return;

      if (action === "cred")   showCredentialCard(student);
      if (action === "edit")   startEditStudent(student);
      if (action === "delete") confirmDeleteStudent(sid);
    });
  });
}

function startEditStudent(student) {
  editingStudentId = student.id;
  sName.value = student.name;
  sId.value   = student.studentId;
  sPin.value  = student.pin;
  sExam.value = student.exam || "";
  studentFormBox.classList.remove("hidden");
  addStudentBtn.textContent = "✕ Cancel";
  saveStudentBtn.textContent = "Update Student";
  sName.focus();
}

// ===== CREDENTIAL MODAL =====
function showCredentialCard(student) {
  credName.textContent      = student.name;
  credStudentId.textContent = student.studentId;
  credPin.textContent       = student.pin;
  credExam.textContent      = student.exam || "—";
  credModalOverlay.classList.remove("hidden");
}

[closeCredModal, closeCredModal2].forEach(btn => {
  btn && btn.addEventListener("click", () => {
    credModalOverlay.classList.add("hidden");
  });
});

credModalOverlay.addEventListener("click", e => {
  if (e.target === credModalOverlay) credModalOverlay.classList.add("hidden");
});

copyCredBtn && copyCredBtn.addEventListener("click", () => {
  const text = `🎓 Student Credentials\nName: ${credName.textContent}\nStudent ID: ${credStudentId.textContent}\nPIN: ${credPin.textContent}\nExam: ${credExam.textContent}\n\nLogin at your exam URL and enter these credentials.`;
  navigator.clipboard.writeText(text).then(() => {
    copyCredBtn.textContent = "✓ Copied!";
    setTimeout(() => { copyCredBtn.textContent = "Copy Credentials"; }, 2000);
  });
});

// ===== DELETE MODAL =====
function confirmDeleteStudent(sid) {
  deleteTargetId = sid;
  deleteConfirmOverlay.classList.remove("hidden");
}

cancelDeleteBtn && cancelDeleteBtn.addEventListener("click", () => {
  deleteConfirmOverlay.classList.add("hidden");
  deleteTargetId = null;
});

deleteConfirmOverlay.addEventListener("click", e => {
  if (e.target === deleteConfirmOverlay) {
    deleteConfirmOverlay.classList.add("hidden");
    deleteTargetId = null;
  }
});

confirmDeleteBtn && confirmDeleteBtn.addEventListener("click", () => {
  if (!deleteTargetId) return;
  const student = students.find(s => s.id === deleteTargetId);
  students = students.filter(s => s.id !== deleteTargetId);
  // Clean up session map entry for removed student
  if (student && student.studentId) delete sessionMap[student.studentId];
  saveStudentsToStorage();
  updateDashboardStats();
  renderStudentsTable();
  renderMultiGrid();   // remove deleted student's tile from live grid
  if (student) logActivity(`Student removed: ${student.name} (${student.studentId})`, "error");
  deleteConfirmOverlay.classList.add("hidden");
  deleteTargetId = null;
});

// ===== SUBMISSIONS =====
function renderSubmissions() {
  submissionsGrid.innerHTML = "";
  updateDashboardStats();

  if (submissions.length === 0) {
    submissionsGrid.innerHTML = `<div class="no-data-msg" id="noSubmissionsMsg">No student assessments submitted yet.</div>`;
    return;
  }

  submissions.slice().reverse().forEach(sub => {
    const card = document.createElement("div");
    card.className = "submission-card";
    const hasSwitches = (sub.tabSwitches || 0) > 0;

    card.innerHTML = `
      ${sub.snapshot
        ? `<img class="sub-photo" src="${sub.snapshot}" alt="Verification Photo" />`
        : `<div class="sub-photo-placeholder">No Photo</div>`
      }
      <div class="sub-body">
        <div class="sub-name">${escHtml(sub.candidateName || "Unknown")}</div>
        ${sub.studentId ? `<div class="sub-detail"><strong>ID:</strong> ${escHtml(sub.studentId)}</div>` : ""}
        <div class="sub-detail"><strong>DOB:</strong> ${escHtml(sub.dob || "—")}</div>
        <div class="sub-detail"><strong>Location:</strong> ${escHtml([sub.city, sub.district, sub.state].filter(Boolean).join(", ") || "—")}</div>
        <div class="sub-badges">
          <span class="sub-badge info">⏱ ${escHtml(sub.duration || "—")}</span>
          <span class="sub-badge ${hasSwitches ? "warn" : "safe"}">${hasSwitches ? "⚠️" : "✓"} ${sub.tabSwitches || 0} switch${sub.tabSwitches !== 1 ? "es" : ""}</span>
        </div>
        <span class="sub-time">Submitted: ${escHtml(sub.submittedAt || "—")}</span>
      </div>
    `;
    submissionsGrid.appendChild(card);
  });
}

clearSubmissionsBtn && clearSubmissionsBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL submission records? This cannot be undone.")) return;
  submissions = [];
  saveSubmissionsToStorage();
  renderSubmissions();
  updateDashboardStats();
  logActivity("All submission records cleared by admin.", "warning");
});

// ===== WEBRTC (Admin receiver) =====
async function handleRTCOffer(offer) {
  try {
    if (adminPeer) { adminPeer.close(); adminPeer = null; }
    adminPeer = new RTCPeerConnection();

    adminPeer.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        adminLiveVideo.srcObject = event.streams[0];
        adminLiveVideo.classList.remove("hidden");
        adminLiveFrame.classList.add("hidden");
        adminNoFeedPlaceholder.classList.add("hidden");
        liveMonitorStatus.textContent = "🟢 Live (WebRTC)";
        liveMonitorStatus.className = "status-pill active";
      }
    };

    adminPeer.onicecandidate = (event) => {
      if (event.candidate) {
        proctorChannel.postMessage({ type: "RTC_ICE_ADMIN", candidate: event.candidate });
      }
    };

    await adminPeer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await adminPeer.createAnswer();
    await adminPeer.setLocalDescription(answer);
    proctorChannel.postMessage({ type: "RTC_ANSWER", answer: adminPeer.localDescription });
  } catch (err) {
    console.warn("WebRTC answer error:", err);
  }
}

// ===== BROADCAST LISTENER =====
function setupBroadcastListener() {
  proctorChannel.onmessage = async (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "SESSION_START": {
        if (msg.studentId) {
          const st = students.find(s => s.studentId === msg.studentId);
          if (st) {
            st.status = "active";
            saveStudentsToStorage();
            renderStudentsTable();
            // Initialise session state for this student
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
        proctorChannel.postMessage({ type: "ADMIN_READY" });
        break;
      }

      case "SESSION_STATE": {
        if (msg.sessionTimer && adminSessionTimer) adminSessionTimer.textContent = msg.sessionTimer;
        if (typeof msg.tabSwitches === "number" && statTabSwitches) statTabSwitches.textContent = msg.tabSwitches;
        break;
      }

      case "STREAM_FRAME": {
        // Route frame to the correct student tile using studentId
        if (msg.studentId && msg.frame) {
          // Ensure sessionMap entry exists
          if (!sessionMap[msg.studentId]) {
            sessionMap[msg.studentId] = { status: "active", tabSwitches: 0, duration: "00:00", lastFrame: null };
          }
          updateTileFrame(msg.studentId, msg.frame, msg.sessionTimer || "00:00");
        } else if (msg.frame) {
          // Fallback: no studentId — update first active tile (legacy)
          const firstActive = Object.keys(sessionMap).find(k => sessionMap[k].status === "active" || sessionMap[k].status === "warning");
          if (firstActive) updateTileFrame(firstActive, msg.frame, msg.sessionTimer || "00:00");
        }
        break;
      }

      case "RTC_OFFER": {
        if (msg.offer) await handleRTCOffer(msg.offer);
        break;
      }

      case "RTC_ICE_CANDIDATE": {
        if (adminPeer && msg.candidate) {
          try { await adminPeer.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch(e) {}
        }
        break;
      }

      case "TAB_SWITCH": {
        const swStudentId = msg.studentId || null;
        if (swStudentId && sessionMap[swStudentId]) {
          sessionMap[swStudentId].tabSwitches = msg.count;
          updateTileStatus(swStudentId, "warning", msg.count);
          // Revert tile to active after 4 seconds
          setTimeout(() => {
            if (sessionMap[swStudentId] && sessionMap[swStudentId].status === "warning") {
              updateTileStatus(swStudentId, "active");
            }
          }, 4000);
        }
        appendAuditLog(`⚠️ Focus lost — ${swStudentId || "?"} (Total: ${msg.count})`, "warning");
        logActivity(`Tab switch — ID: ${swStudentId || "?"}`, "warning");
        updateLiveSidebar();
        break;
      }

      case "SUBMISSION": {
        const d = msg.data || {};
        const newSub = {
          candidateName: [d.firstName, d.middleName, d.lastName].filter(Boolean).join(" "),
          studentId:  d.studentId || "",
          dob:        d.dob || "",
          state:      d.state || "",
          district:   d.district || "",
          city:       d.city || "",
          duration:   msg.duration || "—",
          tabSwitches: msg.tabSwitches || 0,
          snapshot:   msg.snapshot || "",
          submittedAt: new Date().toLocaleString()
        };

        submissions.push(newSub);
        saveSubmissionsToStorage();
        renderSubmissions();

        // Mark student tile as submitted
        if (d.studentId) {
          if (sessionMap[d.studentId]) {
            sessionMap[d.studentId].status = "submitted";
          }
          updateTileStatus(d.studentId, "submitted");
          const st = students.find(s => s.studentId === d.studentId);
          if (st) {
            st.status = "submitted";
            saveStudentsToStorage();
            renderStudentsTable();
          }
        }

        appendAuditLog(`✅ Submitted: ${newSub.candidateName} (${d.studentId || "?"})`, "success");
        logActivity(`Submission received — ${newSub.candidateName}${d.studentId ? ` (${d.studentId})` : ""}`, "success");
        updateLiveSidebar();
        break;
      }
    }
  };
}

// ===== UTILITY =====
function escHtml(str) {
  if (typeof str !== "string") return str ?? "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Expose student list to student login form via localStorage key for verification
// The student form page reads LS_STUDENTS to verify login
window.__updateStudentStore = () => saveStudentsToStorage();
