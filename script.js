// List of States and Union Territories (India)
const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi (NCT)",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

// ===== STUDENT LOGIN GATE =====
const studentLoginGate  = document.getElementById("studentLoginGate");
const loginStudentIdEl  = document.getElementById("loginStudentId");
const loginPinEl        = document.getElementById("loginPin");
const loginErrorEl      = document.getElementById("loginError");
const studentLoginBtn   = document.getElementById("studentLoginBtn");
const mainContainerEl   = document.getElementById("mainContainer");
const formStudentWelcome = document.getElementById("formStudentWelcome");

let loggedInStudent = null; // Will hold student object after login

function getRegisteredStudents() {
  try {
    const raw = localStorage.getItem("proctor_students_v2");
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function handleStudentLogin() {
  const inputId  = (loginStudentIdEl.value || "").trim().toUpperCase();
  const inputPin = (loginPinEl.value || "").trim();

  if (!inputId || !inputPin) {
    loginErrorEl.textContent = "Please enter both Student ID and PIN.";
    loginErrorEl.classList.remove("hidden");
    return;
  }

  const students = getRegisteredStudents();
  const matched  = students.find(s => s.studentId === inputId && s.pin === inputPin);

  if (matched) {
    loggedInStudent = matched;
    studentLoginGate.style.display = "none";
    mainContainerEl.classList.remove("hidden");
    if (formStudentWelcome) {
      formStudentWelcome.textContent = `Welcome, ${matched.name}! Please complete all fields and capture your verification photo.`;
    }
    // Auto-start background proctoring camera after login click
    startProctoredSession();
  } else {
    loginErrorEl.textContent = "Invalid Student ID or PIN. Please contact your invigilator.";
    loginErrorEl.classList.remove("hidden");
    loginPinEl.value = "";
    loginPinEl.focus();
  }
}

if (studentLoginBtn) studentLoginBtn.addEventListener("click", handleStudentLogin);
if (loginPinEl) loginPinEl.addEventListener("keydown", e => { if (e.key === "Enter") handleStudentLogin(); });
if (loginStudentIdEl) loginStudentIdEl.addEventListener("keydown", e => { if (e.key === "Enter") loginPinEl && loginPinEl.focus(); });

// Hide main form initially until login
if (mainContainerEl) mainContainerEl.classList.add("hidden");

// Form & Dropdown Elements
const stateInput = document.getElementById("stateSearchInput");
const dropdownToggle = document.getElementById("dropdownToggle");
const stateOptionsList = document.getElementById("stateOptionsList");
const cityDistrictBox = document.getElementById("cityDistrictBox");
const selectedStateLabel = document.getElementById("selectedStateLabel");
const districtInput = document.getElementById("district");
const cityInput = document.getElementById("city");
const registrationForm = document.getElementById("registrationForm");
const mainContainer = document.getElementById("mainContainer");

// Proctoring Elements
const proctorHud = document.getElementById("proctorHud");
const proctorVideoFeed = document.getElementById("proctorVideoFeed");
const proctorSnapshotCanvas = document.getElementById("proctorSnapshotCanvas");
const hudCameraPending = document.getElementById("hudCameraPending");
const sessionTimer = document.getElementById("sessionTimer");
const tabSwitchCounter = document.getElementById("tabSwitchCounter");

// Result Modal
const resultModal = document.getElementById("resultModal");
const modalSummary = document.getElementById("modalSummary");
const closeModalBtn = document.getElementById("closeModalBtn");

// Dedicated Camera Screen Elements
const openCaptureScreenBtn = document.getElementById("openCaptureScreenBtn");
const openCaptureBtnText = document.getElementById("openCaptureBtnText");
const cameraCaptureScreen = document.getElementById("cameraCaptureScreen");
const closeCaptureScreenBtn = document.getElementById("closeCaptureScreenBtn");
const cameraScreenSubtitle = document.getElementById("cameraScreenSubtitle");
const modalCameraVideo = document.getElementById("modalCameraVideo");
const modalCapturedPreviewImg = document.getElementById("modalCapturedPreviewImg");
const modalCameraCanvas = document.getElementById("modalCameraCanvas");
const viewfinderGuide = document.getElementById("viewfinderGuide");
const cameraLiveControls = document.getElementById("cameraLiveControls");
const cameraPreviewControls = document.getElementById("cameraPreviewControls");
const takePhotoShutterBtn = document.getElementById("takePhotoShutterBtn");
const modalRetakeBtn = document.getElementById("modalRetakeBtn");
const modalConfirmBtn = document.getElementById("modalConfirmBtn");

// Form Thumbnail Preview Elements
const formPhotoImg = document.getElementById("formPhotoImg");
const formPhotoPlaceholder = document.getElementById("formPhotoPlaceholder");
const photoStatusBadge = document.getElementById("photoStatusBadge");
const formPhotoData = document.getElementById("formPhotoData");
let tempPhotoDataUrl = null;

// Proctoring Session State & BroadcastChannel
const proctorChannel = new BroadcastChannel("proctor_session_channel");
let proctorMediaStream = null;
let sessionSeconds = 0;
let timerInterval = null;
let streamInterval = null;
let tabSwitchCount = 0;
let isProctoringActive = false;

// --- State Searchable Dropdown ---
function populateStateList(filterText = "") {
  stateOptionsList.innerHTML = "";
  const query = filterText.trim().toLowerCase();

  const filtered = STATES.filter((state) =>
    state.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.textContent = "No matching states found";
    emptyLi.className = "no-match";
    stateOptionsList.appendChild(emptyLi);
  } else {
    filtered.forEach((state) => {
      const li = document.createElement("li");
      li.textContent = state;
      li.setAttribute("role", "option");
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectState(state);
      });
      stateOptionsList.appendChild(li);
    });
  }
}

function openDropdown() {
  populateStateList(stateInput.value);
  stateOptionsList.classList.add("show");
}

function closeDropdown() {
  stateOptionsList.classList.remove("show");
}

function selectState(stateName) {
  stateInput.value = stateName;
  closeDropdown();
  showConditionalBox(stateName);
}

function showConditionalBox(stateName) {
  selectedStateLabel.textContent = stateName;
  cityDistrictBox.classList.remove("hidden");
  districtInput.setAttribute("required", "required");
  cityInput.setAttribute("required", "required");
}

function hideConditionalBox() {
  cityDistrictBox.classList.add("hidden");
  districtInput.removeAttribute("required");
  cityInput.removeAttribute("required");
  districtInput.value = "";
  cityInput.value = "";
}

stateInput.addEventListener("focus", openDropdown);
stateInput.addEventListener("input", (e) => {
  populateStateList(e.target.value);
  stateOptionsList.classList.add("show");

  const match = STATES.find(
    (s) => s.toLowerCase() === e.target.value.trim().toLowerCase()
  );
  if (match) {
    showConditionalBox(match);
  } else {
    hideConditionalBox();
  }
});

stateInput.addEventListener("blur", () => {
  setTimeout(closeDropdown, 150);
});

dropdownToggle.addEventListener("click", () => {
  if (stateOptionsList.classList.contains("show")) {
    closeDropdown();
  } else {
    stateInput.focus();
    openDropdown();
  }
});

// --- Proctoring Session Logic ---
async function startProctoredSession() {
  if (isProctoringActive || proctorMediaStream) return;

  if (hudCameraPending) {
    hudCameraPending.textContent = "Requesting camera...";
    hudCameraPending.classList.remove("hidden");
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (hudCameraPending) hudCameraPending.textContent = "Camera unsupported";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    proctorMediaStream = stream;
    proctorVideoFeed.srcObject = stream;

    // Connect stream to modal camera screen
    if (modalCameraVideo) {
      modalCameraVideo.srcObject = stream;
    }

    // Enable session UI
    isProctoringActive = true;

    // Start Session Timer
    startSessionTimer();

    // Start Integrity Event Listeners
    setupAntiCheatingListeners();

    // Broadcast session start to Admin Dashboard
    proctorChannel.postMessage({
      type: "SESSION_START",
      timestamp: Date.now(),
      studentId: loggedInStudent ? loggedInStudent.studentId : null
    });

    // Establish direct high-speed WebRTC video stream to Admin Dashboard
    initiateWebRTCStream();

    // High-performance fallback frame streamer (120ms ~ 8.5 FPS)
    streamInterval = setInterval(() => {
      if (!isProctoringActive || !proctorVideoFeed.videoWidth) return;
      proctorSnapshotCanvas.width = 280;
      proctorSnapshotCanvas.height = 210;
      const ctx = proctorSnapshotCanvas.getContext("2d");
      ctx.drawImage(proctorVideoFeed, 0, 0, 280, 210);
      const frameData = proctorSnapshotCanvas.toDataURL("image/jpeg", 0.5);
      const mins = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
      const secs = String(sessionSeconds % 60).padStart(2, "0");
      proctorChannel.postMessage({
        type: "STREAM_FRAME",
        frame: frameData,
        sessionTimer: `${mins}:${secs}`,
        tabSwitches: tabSwitchCount,
        studentId: loggedInStudent ? loggedInStudent.studentId : null
      });
    }, 120);
  } catch (err) {
    console.error("Camera access failed:", err);
  }
}

// --- WebRTC Peer-to-Peer Streaming (30-60 FPS, Zero Latency) ---
let peerConnection = null;

async function initiateWebRTCStream() {
  if (!proctorMediaStream) return;
  try {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    peerConnection = new RTCPeerConnection();
    proctorMediaStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, proctorMediaStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        proctorChannel.postMessage({ type: "RTC_ICE_CANDIDATE", candidate: event.candidate });
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    proctorChannel.postMessage({ type: "RTC_OFFER", offer: peerConnection.localDescription });
  } catch (e) {
    console.warn("WebRTC setup notice:", e);
  }
}

// Handle signals from Admin Dashboard
proctorChannel.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (msg.type === "ADMIN_READY") {
    if (isProctoringActive && proctorMediaStream) {
      initiateWebRTCStream();
      const mins = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
      const secs = String(sessionSeconds % 60).padStart(2, "0");
      proctorChannel.postMessage({
        type: "SESSION_STATE",
        sessionTimer: `${mins}:${secs}`,
        tabSwitches: tabSwitchCount
      });
    }
  } else if (msg.type === "RTC_ANSWER") {
    if (peerConnection && msg.answer) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
      } catch (e) {
        console.warn("RTC answer error:", e);
      }
    }
  } else if (msg.type === "RTC_ICE_ADMIN") {
    if (peerConnection && msg.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (e) {
        console.warn("RTC candidate error:", e);
      }
    }
  }
};

function startSessionTimer() {
  sessionSeconds = 0;
  timerInterval = setInterval(() => {
    sessionSeconds++;
    const mins = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
    const secs = String(sessionSeconds % 60).padStart(2, "0");
    sessionTimer.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopSessionTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }
}

// Anti-Cheating & Integrity Event Listeners
function setupAntiCheatingListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isProctoringActive) {
      logIntegrityInfraction();
    }
  });

  window.addEventListener("blur", () => {
    if (isProctoringActive) {
      logIntegrityInfraction();
    }
  });
}

function logIntegrityInfraction() {
  tabSwitchCount++;
  tabSwitchCounter.textContent = tabSwitchCount;

  // Broadcast infraction silently to admin dashboard
  proctorChannel.postMessage({
    type: "TAB_SWITCH",
    count: tabSwitchCount,
    studentId: loggedInStudent ? loggedInStudent.studentId : null
  });
}

// Auto-start camera on page load is disabled — camera starts after student login
// (called inside handleStudentLogin)

// --- Dedicated Camera Screen & Snapshot Workflow ---
async function openDedicatedCameraScreen() {
  if (!isProctoringActive || !proctorMediaStream) {
    await startProctoredSession();
  }

  if (modalCameraVideo && proctorMediaStream) {
    modalCameraVideo.srcObject = proctorMediaStream;
  }

  // Reset viewfinder controls to live state
  modalCameraVideo.classList.remove("hidden");
  viewfinderGuide.classList.remove("hidden");
  modalCapturedPreviewImg.classList.add("hidden");
  cameraLiveControls.classList.remove("hidden");
  cameraPreviewControls.classList.add("hidden");
  cameraScreenSubtitle.textContent = "Position your face clearly in the frame and click to capture";

  // Show screen modal
  cameraCaptureScreen.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDedicatedCameraScreen() {
  cameraCaptureScreen.classList.add("hidden");
  document.body.style.overflow = "";
}

function takeModalSnapshot() {
  const sourceVideo = (modalCameraVideo && modalCameraVideo.videoWidth) 
    ? modalCameraVideo 
    : proctorVideoFeed;

  if (!sourceVideo || sourceVideo.videoWidth === 0) return;

  const width = sourceVideo.videoWidth || 640;
  const height = sourceVideo.videoHeight || 480;

  modalCameraCanvas.width = width;
  modalCameraCanvas.height = height;

  const ctx = modalCameraCanvas.getContext("2d");
  // Mirror for natural selfie orientation
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sourceVideo, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  tempPhotoDataUrl = modalCameraCanvas.toDataURL("image/jpeg", 0.92);

  // Switch viewfinder to frozen photo preview
  modalCapturedPreviewImg.src = tempPhotoDataUrl;
  modalCapturedPreviewImg.classList.remove("hidden");
  modalCameraVideo.classList.add("hidden");
  viewfinderGuide.classList.add("hidden");

  // Show review & confirm controls
  cameraLiveControls.classList.add("hidden");
  cameraPreviewControls.classList.remove("hidden");
  cameraScreenSubtitle.textContent = "Review your captured photo. Click 'Use This Photo' to attach, or 'Retake'.";
}

function retakeModalSnapshot() {
  tempPhotoDataUrl = null;
  modalCapturedPreviewImg.classList.add("hidden");
  modalCameraVideo.classList.remove("hidden");
  viewfinderGuide.classList.remove("hidden");
  cameraPreviewControls.classList.add("hidden");
  cameraLiveControls.classList.remove("hidden");
  cameraScreenSubtitle.textContent = "Position your face clearly in the frame and click to capture";
}

function confirmModalPhoto() {
  if (!tempPhotoDataUrl) return;

  // Set form photo data
  formPhotoData.value = tempPhotoDataUrl;
  formPhotoImg.src = tempPhotoDataUrl;
  formPhotoImg.classList.remove("hidden");
  formPhotoPlaceholder.classList.add("hidden");
  photoStatusBadge.classList.remove("hidden");
  openCaptureBtnText.textContent = "Retake / Change Photo";

  closeDedicatedCameraScreen();
}

// Event Listeners for Dedicated Camera Screen
if (openCaptureScreenBtn) openCaptureScreenBtn.addEventListener("click", openDedicatedCameraScreen);
if (closeCaptureScreenBtn) closeCaptureScreenBtn.addEventListener("click", closeDedicatedCameraScreen);
if (takePhotoShutterBtn) takePhotoShutterBtn.addEventListener("click", takeModalSnapshot);
if (modalRetakeBtn) modalRetakeBtn.addEventListener("click", retakeModalSnapshot);
if (modalConfirmBtn) modalConfirmBtn.addEventListener("click", confirmModalPhoto);

// --- Form Submission & Snapshot Capture ---
registrationForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value.trim();
  const middleName = document.getElementById("middleName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const dob = document.getElementById("dob").value;
  const state = stateInput.value.trim();
  const district = districtInput.value.trim();
  const city = cityInput.value.trim();
  const photo = formPhotoData.value;

  if (!firstName || !lastName || !dob) {
    alert("Please fill in all mandatory personal details (First Name, Last Name, Date of Birth).");
    return;
  }

  if (!state || (!cityDistrictBox.classList.contains("hidden") && (!district || !city))) {
    if (!state) {
      alert("Please select your State.");
      stateInput.focus();
      return;
    }
    if (!district || !city) {
      alert("Please fill in District and City.");
      return;
    }
  }

  if (!photo) {
    alert("Please click your verification photo before submitting.");
    openCaptureScreenBtn.focus();
    return;
  }

  // Stop Proctoring
  isProctoringActive = false;
  stopSessionTimer();

  const mins = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
  const secs = String(sessionSeconds % 60).padStart(2, "0");
  const durationStr = `${mins}:${secs}`;

  // Broadcast submission to Admin Dashboard
  proctorChannel.postMessage({
    type: "SUBMISSION",
    data: {
      firstName, middleName, lastName, dob, state, district, city,
      studentId: loggedInStudent ? loggedInStudent.studentId : ""
    },
    duration: durationStr,
    tabSwitches: tabSwitchCount,
    snapshot: photo
  });

  // Display audit summary
  modalSummary.innerHTML = `
    <div class="audit-badge">Session Verified &bull; Proctoring Audit Passed</div>
    <p><strong>Candidate:</strong> ${firstName} ${middleName ? middleName + " " : ""}${lastName}</p>
    <p><strong>Date of Birth:</strong> ${dob}</p>
    <p><strong>Location:</strong> ${city}, ${district}, ${state}</p>
    <hr style="margin: 0.75rem 0; border: none; border-top: 1px solid var(--card-border);" />
    <p><strong>Proctoring Duration:</strong> ${durationStr}</p>
    <p><strong>Tab Switch Infractions:</strong> <span style="color: ${tabSwitchCount > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 700;">${tabSwitchCount}</span></p>
    <p style="margin-top: 0.75rem;"><strong>Uploaded Verification Photo:</strong></p>
    <img src="${photo}" alt="Uploaded Candidate Photo" />
  `;

  resultModal.classList.remove("hidden");

  // Release camera tracks
  if (proctorMediaStream) {
    proctorMediaStream.getTracks().forEach((t) => t.stop());
    proctorMediaStream = null;
  }
});

closeModalBtn.addEventListener("click", () => {
  resultModal.classList.add("hidden");
});
