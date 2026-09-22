/**
 * script.js — Student Form + Proctoring Logic
 * Calls the REST API (/api) instead of localStorage.
 */

"use strict";

// ===== API HELPER =====
const API = {
  base: "",   // same-origin; will be /api/*
  token: null,

  /** Fetch wrapper with automatic Bearer token and error normalisation */
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

  post: (path, body) => API.request("POST", path, body),
  get:  (path)       => API.request("GET", path),
};

// ===== STATES LIST =====
const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi (NCT)",
  "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

// ===== DOM REFS =====
const studentLoginGate     = document.getElementById("studentLoginGate");
const loginStudentIdEl     = document.getElementById("loginStudentId");
const loginPinEl           = document.getElementById("loginPin");
const loginErrorEl         = document.getElementById("loginError");
const studentLoginBtn      = document.getElementById("studentLoginBtn");
const mainContainerEl      = document.getElementById("mainContainer");
const formStudentWelcome   = document.getElementById("formStudentWelcome");
const formStudentBadge     = document.getElementById("formStudentBadge");

const stateInput           = document.getElementById("stateSearchInput");
const dropdownToggle       = document.getElementById("dropdownToggle");
const stateOptionsList     = document.getElementById("stateOptionsList");
const cityDistrictBox      = document.getElementById("cityDistrictBox");
const selectedStateLabel   = document.getElementById("selectedStateLabel");
const districtInput        = document.getElementById("district");
const cityInput            = document.getElementById("city");
const registrationForm     = document.getElementById("registrationForm");

const proctorVideoFeed     = document.getElementById("proctorVideoFeed");
const proctorSnapshotCanvas= document.getElementById("proctorSnapshotCanvas");
const sessionTimerEl       = document.getElementById("sessionTimer");
const tabSwitchCounterEl   = document.getElementById("tabSwitchCounter");

const resultModal          = document.getElementById("resultModal");
const modalSummary         = document.getElementById("modalSummary");
const closeModalBtn        = document.getElementById("closeModalBtn");

const openCaptureScreenBtn = document.getElementById("openCaptureScreenBtn");
const cameraCaptureScreen  = document.getElementById("cameraCaptureScreen");
const closeCaptureScreenBtn= document.getElementById("closeCaptureScreenBtn");
const modalCameraVideo     = document.getElementById("modalCameraVideo");
const modalCapturedPreviewImg = document.getElementById("modalCapturedPreviewImg");
const modalCameraCanvas    = document.getElementById("modalCameraCanvas");
const viewfinderGuide      = document.getElementById("viewfinderGuide");
const takePhotoShutterBtn  = document.getElementById("takePhotoShutterBtn");
const modalRetakeBtn       = document.getElementById("modalRetakeBtn");
const modalConfirmBtn      = document.getElementById("modalConfirmBtn");
const cameraLiveControls   = document.getElementById("cameraLiveControls");
const cameraPreviewControls= document.getElementById("cameraPreviewControls");

const formPhotoData        = document.getElementById("formPhotoData");
const formPhotoImg         = document.getElementById("formPhotoImg");
const formPhotoPlaceholder = document.getElementById("formPhotoPlaceholder");
const photoStatusBadge     = document.getElementById("photoStatusBadge");
const cameraScreenSubtitle = document.getElementById("cameraScreenSubtitle");
const submitBtn            = document.getElementById("submitBtn");

// ===== SESSION STATE =====
const proctorChannel = new BroadcastChannel("proctor_session_channel");
let loggedInStudent  = null;
let proctorStream    = null;
let sessionSeconds   = 0;
let timerInterval    = null;
let streamInterval   = null;
let tabSwitchCount   = 0;
let isProctoringActive = false;
let selectedState    = "";

// ===== STUDENT LOGIN =====
function showLoginError(msg) {
  loginErrorEl.textContent = `ERROR: ${msg}`;
  loginErrorEl.classList.remove("hidden");
}
function hideLoginError() { loginErrorEl.classList.add("hidden"); }

studentLoginBtn.addEventListener("click", handleStudentLogin);
loginPinEl.addEventListener("keydown", e => { if (e.key === "Enter") handleStudentLogin(); });
loginStudentIdEl.addEventListener("keydown", e => { if (e.key === "Enter") loginPinEl.focus(); });

async function handleStudentLogin() {
  hideLoginError();
  const studentId = (loginStudentIdEl.value || "").trim();
  const pin       = (loginPinEl.value || "").trim();

  if (!studentId || !pin) {
    showLoginError("Both Candidate ID and PIN are required.");
    return;
  }

  studentLoginBtn.textContent = "VERIFYING...";
  studentLoginBtn.disabled = true;

  try {
    const resp = await API.post("/auth/student", { studentId, pin });
    API.token = resp.token;
    loggedInStudent = resp.student;
    sessionStorage.setItem("examToken", resp.token);
    sessionStorage.setItem("examStudent", JSON.stringify(resp.student));

    // Show form
    studentLoginGate.style.display = "none";
    mainContainerEl.classList.remove("hidden");

    if (formStudentWelcome) {
      formStudentWelcome.textContent =
        `Welcome, ${loggedInStudent.name}. Candidate ID: ${loggedInStudent.studentId}. ` +
        `Examination: ${loggedInStudent.exam || "General"}. Please complete all mandatory fields (*).`;
    }
    if (formStudentBadge) {
      formStudentBadge.textContent = loggedInStudent.studentId;
    }

    // Start proctoring (camera starts only after user click — this IS a click event)
    startProctoredSession();

  } catch (err) {
    showLoginError(err.message || "Invalid Candidate ID or PIN. Contact your invigilator.");
    loginPinEl.value = "";
    loginPinEl.focus();
  } finally {
    studentLoginBtn.textContent = "PROCEED TO EXAMINATION »";
    studentLoginBtn.disabled = false;
  }
}

// ===== PROCTORING SESSION =====
async function startProctoredSession() {
  if (isProctoringActive) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    proctorStream = stream;
    proctorVideoFeed.srcObject = stream;
    if (modalCameraVideo) modalCameraVideo.srcObject = stream;

    isProctoringActive = true;
    startSessionTimer();
    setupAntiCheatingListeners();
    beginFrameStreaming();

    proctorChannel.postMessage({
      type: "SESSION_START",
      timestamp: Date.now(),
      studentId: loggedInStudent ? loggedInStudent.studentId : null,
    });

  } catch (err) {
    console.warn("Camera access failed:", err.name);
  }
}

function startSessionTimer() {
  timerInterval = setInterval(() => {
    sessionSeconds++;
    const m = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
    const s = String(sessionSeconds % 60).padStart(2, "0");
    if (sessionTimerEl) sessionTimerEl.textContent = `${m}:${s}`;
  }, 1000);
}

function beginFrameStreaming() {
  const ctx = proctorSnapshotCanvas.getContext("2d");
  proctorSnapshotCanvas.width  = 280;
  proctorSnapshotCanvas.height = 210;

  streamInterval = setInterval(() => {
    if (!proctorStream || !proctorVideoFeed.readyState) return;
    ctx.drawImage(proctorVideoFeed, 0, 0, 280, 210);
    const frameData = proctorSnapshotCanvas.toDataURL("image/jpeg", 0.45);
    const m = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
    const s = String(sessionSeconds % 60).padStart(2, "0");
    proctorChannel.postMessage({
      type: "STREAM_FRAME",
      frame: frameData,
      sessionTimer: `${m}:${s}`,
      tabSwitches: tabSwitchCount,
      studentId: loggedInStudent ? loggedInStudent.studentId : null,
    });
  }, 150);
}

function stopProctoredSession() {
  clearInterval(timerInterval);
  clearInterval(streamInterval);
  if (proctorStream) {
    proctorStream.getTracks().forEach(t => t.stop());
    proctorStream = null;
  }
  isProctoringActive = false;
}

// ===== ANTI-CHEATING LISTENERS =====
function setupAntiCheatingListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) recordTabSwitch();
  });
  window.addEventListener("blur", recordTabSwitch);
}

function recordTabSwitch() {
  tabSwitchCount++;
  if (tabSwitchCounterEl) tabSwitchCounterEl.textContent = tabSwitchCount;
  proctorChannel.postMessage({
    type: "TAB_SWITCH",
    count: tabSwitchCount,
    studentId: loggedInStudent ? loggedInStudent.studentId : null,
  });
}

// ===== STATE SEARCHABLE DROPDOWN =====
let stateDropdownOpen = false;

function populateStateList(filter = "") {
  stateOptionsList.innerHTML = "";
  const filtered = STATES.filter(s => s.toLowerCase().includes(filter.toLowerCase()));

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "no-match";
    li.textContent = "No matching state/UT found";
    stateOptionsList.appendChild(li);
    return;
  }

  filtered.forEach(state => {
    const li = document.createElement("li");
    li.textContent = state;
    li.setAttribute("role", "option");
    li.addEventListener("click", () => selectState(state));
    stateOptionsList.appendChild(li);
  });
}

function openStateDropdown() {
  populateStateList(stateInput.value);
  stateOptionsList.classList.add("show");
  stateDropdownOpen = true;
}

function closeStateDropdown() {
  stateOptionsList.classList.remove("show");
  stateDropdownOpen = false;
}

function selectState(state) {
  selectedState = state;
  stateInput.value = state;
  selectedStateLabel.textContent = state;
  cityDistrictBox.classList.remove("hidden");
  closeStateDropdown();
  districtInput.focus();
}

stateInput.addEventListener("input", () => {
  openStateDropdown();
  if (!stateInput.value) {
    selectedState = "";
    cityDistrictBox.classList.add("hidden");
  }
});

stateInput.addEventListener("focus", openStateDropdown);
dropdownToggle.addEventListener("click", () => {
  stateDropdownOpen ? closeStateDropdown() : openStateDropdown();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#stateDropdown")) closeStateDropdown();
});

populateStateList();

// ===== CAMERA CAPTURE SCREEN =====
openCaptureScreenBtn.addEventListener("click", openDedicatedCameraScreen);
closeCaptureScreenBtn.addEventListener("click", closeDedicatedCameraScreen);

async function openDedicatedCameraScreen() {
  cameraCaptureScreen.classList.remove("hidden");
  cameraLiveControls.classList.remove("hidden");
  cameraPreviewControls.classList.add("hidden");
  modalCapturedPreviewImg.classList.add("hidden");
  viewfinderGuide && (viewfinderGuide.style.display = "");

  if (!proctorStream) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      proctorStream = stream;
      modalCameraVideo.srcObject = stream;
    } catch (err) {
      cameraScreenSubtitle.textContent = "ERROR: Camera access denied. Please allow camera in browser settings.";
      return;
    }
  } else {
    modalCameraVideo.srcObject = proctorStream;
  }

  modalCameraVideo.classList.remove("hidden");
  cameraScreenSubtitle.textContent = "Position your face clearly inside the oval guide. Click [CAPTURE PHOTOGRAPH] when ready.";
}

function closeDedicatedCameraScreen() {
  cameraCaptureScreen.classList.add("hidden");
}

takePhotoShutterBtn.addEventListener("click", capturePhoto);

function capturePhoto() {
  if (!modalCameraVideo.srcObject) return;

  modalCameraCanvas.width  = 480;
  modalCameraCanvas.height = 360;
  const ctx = modalCameraCanvas.getContext("2d");
  ctx.drawImage(modalCameraVideo, 0, 0, 480, 360);

  const dataUrl = modalCameraCanvas.toDataURL("image/jpeg", 0.85);
  modalCapturedPreviewImg.src = dataUrl;

  // Switch to preview
  modalCameraVideo.classList.add("hidden");
  modalCapturedPreviewImg.classList.remove("hidden");
  viewfinderGuide && (viewfinderGuide.style.display = "none");
  cameraLiveControls.classList.add("hidden");
  cameraPreviewControls.classList.remove("hidden");
  cameraScreenSubtitle.textContent = "Review your photograph. Click [ACCEPT] to use or [RETAKE] to try again.";
}

modalRetakeBtn.addEventListener("click", () => {
  modalCapturedPreviewImg.classList.add("hidden");
  modalCameraVideo.classList.remove("hidden");
  viewfinderGuide && (viewfinderGuide.style.display = "");
  cameraPreviewControls.classList.add("hidden");
  cameraLiveControls.classList.remove("hidden");
  cameraScreenSubtitle.textContent = "Position your face clearly inside the oval guide.";
});

modalConfirmBtn.addEventListener("click", () => {
  const dataUrl = modalCapturedPreviewImg.src;
  if (!dataUrl || !dataUrl.startsWith("data:image")) return;

  formPhotoData.value = dataUrl;
  formPhotoImg.src = dataUrl;
  formPhotoImg.classList.remove("hidden");
  formPhotoPlaceholder && (formPhotoPlaceholder.style.display = "none");
  photoStatusBadge && photoStatusBadge.classList.remove("hidden");
  openCaptureScreenBtn.textContent = "↺ RETAKE PHOTOGRAPH";
  closeDedicatedCameraScreen();
});

// ===== FORM VALIDATION & SUBMISSION =====
registrationForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName  = document.getElementById("firstName").value.trim();
  const middleName = document.getElementById("middleName").value.trim();
  const lastName   = document.getElementById("lastName").value.trim();
  const dob        = document.getElementById("dob").value;
  const gender     = document.getElementById("gender").value;
  const district   = districtInput.value.trim();
  const city       = cityInput.value.trim();
  const photo      = formPhotoData.value;

  // Validation
  const errors = [];
  if (!firstName)   errors.push("First Name is required.");
  if (!lastName)    errors.push("Last Name is required.");
  if (!dob)         errors.push("Date of Birth is required.");
  if (!selectedState) errors.push("State / U.T. is required.");
  if (selectedState && !district) errors.push("District is required.");
  if (selectedState && !city)     errors.push("City / Town is required.");
  if (!photo)       errors.push("Live photograph is mandatory. Please capture your photo.");

  if (errors.length) {
    alert("FORM ERRORS:\n\n" + errors.map((e, i) => `${i + 1}. ${e}`).join("\n"));
    return;
  }

  const m = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
  const s = String(sessionSeconds % 60).padStart(2, "0");
  const durationStr = `${m}:${s}`;

  submitBtn.textContent = "SUBMITTING...";
  submitBtn.disabled = true;

  try {
    await API.post("/submissions", {
      firstName, middleName, lastName,
      dob, gender,
      state: selectedState,
      district, city,
      snapshot: photo,
      duration: durationStr,
      tabSwitches: tabSwitchCount,
    });

    // Broadcast to admin
    proctorChannel.postMessage({
      type: "SUBMISSION",
      data: { firstName, middleName, lastName, dob, state: selectedState, district, city,
              studentId: loggedInStudent ? loggedInStudent.studentId : "" },
      duration: durationStr,
      tabSwitches: tabSwitchCount,
      snapshot: photo,
    });

    stopProctoredSession();

    // Show acknowledgement
    modalSummary.innerHTML = `
      <p><strong>Candidate Name :</strong> ${firstName} ${middleName} ${lastName}</p>
      <p><strong>Candidate ID   :</strong> ${loggedInStudent ? loggedInStudent.studentId : "-"}</p>
      <p><strong>Date of Birth  :</strong> ${dob}</p>
      <p><strong>State / U.T.   :</strong> ${selectedState}</p>
      <p><strong>District       :</strong> ${district}</p>
      <p><strong>City           :</strong> ${city}</p>
      <p><strong>Session Time   :</strong> ${durationStr}</p>
      <p><strong>Status         :</strong> SUBMITTED SUCCESSFULLY</p>
    `;
    resultModal.classList.remove("hidden");

  } catch (err) {
    alert("SUBMISSION ERROR:\n\n" + (err.message || "Failed to submit. Please try again."));
  } finally {
    submitBtn.textContent = "SUBMIT EXAMINATION FORM »";
    submitBtn.disabled = false;
  }
});

closeModalBtn.addEventListener("click", () => {
  resultModal.classList.add("hidden");
  registrationForm.reset();
  formPhotoData.value = "";
  formPhotoImg.classList.add("hidden");
  if (formPhotoPlaceholder) formPhotoPlaceholder.style.display = "";
  if (photoStatusBadge) photoStatusBadge.classList.add("hidden");
  selectedState = "";
  cityDistrictBox.classList.add("hidden");
});

// ===== BROADCAST CHANNEL: receive messages from admin =====
proctorChannel.onmessage = (e) => {
  if (e.data && e.data.type === "ADMIN_READY") {
    // Admin is online — re-broadcast session start if already active
    if (isProctoringActive && loggedInStudent) {
      proctorChannel.postMessage({
        type: "SESSION_START",
        studentId: loggedInStudent.studentId,
        timestamp: Date.now(),
      });
    }
  }
};

// ===== RESTORE SESSION if page reloaded =====
(function restoreSession() {
  const token = sessionStorage.getItem("examToken");
  const student = sessionStorage.getItem("examStudent");
  if (token && student) {
    try {
      API.token = token;
      loggedInStudent = JSON.parse(student);
      studentLoginGate.style.display = "none";
      mainContainerEl.classList.remove("hidden");
      if (formStudentWelcome) {
        formStudentWelcome.textContent =
          `Welcome back, ${loggedInStudent.name}. Candidate ID: ${loggedInStudent.studentId}.`;
      }
      if (formStudentBadge) formStudentBadge.textContent = loggedInStudent.studentId;
    } catch (err) {
      sessionStorage.removeItem("examToken");
      sessionStorage.removeItem("examStudent");
    }
  }
})();
