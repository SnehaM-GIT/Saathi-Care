// ============================================================
//  SAATHI CARE — Firebase Configuration & App Initialization
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAURBIygEw2YUM7Z2Dr6aMiko-P2oOvVRk",
  authDomain: "saathi-care-a8525.firebaseapp.com",
  projectId: "saathi-care-a8525",
  storageBucket: "saathi-care-a8525.firebasestorage.app",
  messagingSenderId: "69481248715",
  appId: "1:69481248715:web:dc439edebd06d95a6d284e"
};

// Initialize Firebase using the compat SDK (loaded in index.html)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const COLLECTIONS = {
  CAREGIVERS: "caregivers",
  BOOKINGS: "bookings",
  MEDIA: "media",
  BLOCKED: "blocked_slots"
};

// ============================================================
//  SAATHI CARE — Main Application Logic v2 (Unified)
// ============================================================

const State = {
  currentUser      : null,
  caregiverProfile : null,
  caregivers       : [],
  selectedServices : [],
  selectedCaregiver: null,
  selectedSlot     : null,
  bookingDuration  : 2,
  blockedSlots     : {}, // {cgId: [times]}
  bookedSlots      : {},  // {cgId: [times]}
  currentBookingStep: 1,
  elderDetails     : {
    name   : "",
    phone  : "",
    age    : "",
    address: "",
    notes  : ""
  },
  bookerType       : "Son/Daughter (abroad)",
  bookings         : [],
  myBlockedSlots   : [],
  galleryItems     : [],
  isOwner          : false
};

const OWNER_EMAILS = [
  "snehatest29@gmail.com",
  "snehstest29@gmail.com", // Handle common typo
  "owner2@saathicare.in"
];

function isOwner(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}

let _recaptchaVerifier  = null;
let _confirmationResult = null;

// ─────────────────────────────────────────────
//  SCREEN ROUTER
// ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) { el.classList.add("active"); window.scrollTo(0, 0); }
}

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast toast-${type} active`;
  setTimeout(() => t.classList.remove("active"), 4000);
}

// ─────────────────────────────────────────────
//  AUTHENTICATION — Caregiver Login
// ─────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById("login-id").value.trim();
  const password = document.getElementById("login-pw").value.trim();

  if (!email || !password) { showToast("Enter email and password", "error"); return; }
  const btn = document.getElementById("login-btn");
  btn.textContent = "Logging in…"; btn.disabled = true;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    State.currentUser = cred.user;
    await loadCaregiverProfile(cred.user.uid);
    showScreen("screen-caregiver-dashboard");
    showToast("Welcome back! 👋", "success");
    await loadDashboardData();

    if (isOwner(cred.user.email)) {
      State.isOwner = true;
      injectOwnerTab();
      await loadOwnerPanelData();
    }
  } catch (err) {
    showToast(authErrorMessage(err.code), "error");
  } finally {
    btn.textContent = "Login to Dashboard"; btn.disabled = false;
  }
}

function doLogout() {
  auth.signOut().then(() => {
    State.currentUser      = null;
    State.caregiverProfile = null;
    State.isOwner          = false;
    const ownerBtn = document.getElementById("tab-owner-btn");
    if (ownerBtn) ownerBtn.remove();
    const ownerPanel = document.getElementById("tab-owner");
    if (ownerPanel) ownerPanel.remove();
    showScreen("screen-home");
    showToast("Logged out successfully");
  });
}

auth.onAuthStateChanged(async user => {
  if (user) {
    State.currentUser = user;
    if (user.phoneNumber && !user.email) return;
    await loadCaregiverProfile(user.uid);
    if (document.getElementById("screen-caregiver-dashboard").classList.contains("active")) {
      await loadDashboardData();
      if (isOwner(user.email)) {
        State.isOwner = true;
        injectOwnerTab();
        await loadOwnerPanelData();
      }
    }
  }
});

function authErrorMessage(code) {
  const map = {
    "auth/user-not-found"   : "No account found with that email.",
    "auth/wrong-password"   : "Incorrect password.",
    "auth/invalid-email"    : "Invalid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later."
  };
  return map[code] || "Login failed. Please try again.";
}

function injectOwnerTab() {
  const tabsEl = document.querySelector("#screen-caregiver-dashboard .tabs");
  if (tabsEl && !document.getElementById("tab-owner-btn")) {
    const ownerTabBtn = document.createElement("button");
    ownerTabBtn.className  = "tab";
    ownerTabBtn.id         = "tab-owner-btn";
    ownerTabBtn.innerHTML  = "👑 Applications";
    ownerTabBtn.onclick    = () => setDashTab("owner");
    tabsEl.appendChild(ownerTabBtn);
  }

  const dashBody = document.querySelector("#screen-caregiver-dashboard .dash-body");
  if (dashBody && !document.getElementById("tab-owner")) {
    const ownerPanel = document.createElement("div");
    ownerPanel.id = "tab-owner";
    ownerPanel.style.display = "none";
    ownerPanel.innerHTML = `
      <div style="margin-bottom:32px">
        <div style="font-weight:700;font-size:20px;margin-bottom:4px;color:var(--text)">Caregiver Applications</div>
        <div style="color:var(--text2);font-size:14px;margin-bottom:20px">People who applied to become a Saathi. Approve or reject below.</div>
        <div id="owner-applications-list2"><div class="loading-spinner">Loading applications…</div></div>
      </div>
    `;
    dashBody.appendChild(ownerPanel);
  }
}

async function loadOwnerPanelData() {
  const appList  = document.getElementById("owner-applications-list2");
  if (!appList) return;
  try {
    const appSnap = await db.collection("applications").orderBy("createdAt", "desc").limit(50).get();
    const apps    = appSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    appList.innerHTML = apps.length === 0
      ? `<div class="empty-state">No applications yet.</div>`
      : apps.map(a => `
        <div class="request-card" style="margin-bottom:14px">
          <div class="req-icon">👤</div>
          <div class="req-body">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div class="req-title">${escHtml(a.name)}</div>
              <span class="status-badge ${a.status==="approved"?"status-confirmed":a.status==="rejected"?"status-cancelled":"status-new"}">
                ${a.status || "pending"}
              </span>
            </div>
            <div class="req-meta">📧 ${escHtml(a.email)} · 📞 ${escHtml(a.phone)}</div>
            <div class="req-actions">
              ${a.status !== "approved" ? `<button class="btn btn-teal btn-sm" onclick="approveApplication('${a.id}',true)">✓ Approve</button>` : ""}
              ${a.status !== "rejected" ? `<button class="btn btn-ghost btn-sm" onclick="rejectApplication('${a.id}',true)">✗ Reject</button>`  : ""}
            </div>
          </div>
        </div>`).join("");
  } catch (e) {
    appList.innerHTML = `<div class="error-msg">Error loading applications.</div>`;
  }
}

async function loadCaregiverProfile(uid) {
  try {
    const doc = await db.collection(COLLECTIONS.CAREGIVERS).doc(uid).get();
    if (doc.exists) {
      State.caregiverProfile = { id: doc.id, ...doc.data() };
      renderCaregiverHeader();
    }
  } catch (e) { console.error("Profile load error:", e); }
}

function renderCaregiverHeader() {
  const p = State.caregiverProfile;
  if (!p) return;
  const el = document.getElementById("dash-caregiver-name");
  if (el) el.textContent = p.name + " 👋";
  const av = document.getElementById("dash-avatar");
  if (av) { av.textContent = initials(p.name); av.style.background = p.avatarColor || "#2A7F7F"; }
}

function initRecaptcha() {
  if (_recaptchaVerifier) return;
  _recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
    size    : "invisible",
    callback: () => {}
  });
}

async function sendOTP() {
  const raw   = document.getElementById("otp-phone").value.trim();
  if (!raw) { showToast("Enter your phone number", "error"); return; }
  let phone = raw;
  if (!phone.startsWith("+")) phone = "+91" + phone.replace(/^0/, "");
  phone = phone.replace(/\s/g, "");
  const btn = document.getElementById("otp-send-btn");
  btn.textContent = "Sending…"; btn.disabled = true;
  try {
    initRecaptcha();
    _confirmationResult = await auth.signInWithPhoneNumber(phone, _recaptchaVerifier);
    document.getElementById("otp-step1").style.display = "none";
    document.getElementById("otp-step2").style.display = "block";
    document.getElementById("otp-display-number").textContent = phone;
    showToast("OTP sent ✓", "success");
  } catch (e) {
    showToast("Failed to send OTP. " + e.message, "error");
    console.error("sendOTP error:", e);
  } finally {
    btn.textContent = "Send OTP Code"; btn.disabled = false;
  }
}

async function verifyOTP() {
  const code = document.getElementById("otp-code").value.trim();
  if (!code) { showToast("Enter the 6-digit code", "error"); return; }
  const btn = document.getElementById("otp-verify-btn");
  btn.textContent = "Verifying…"; btn.disabled = true;
  try {
    const res = await _confirmationResult.confirm(code);
    State.currentUser = res.user;
    showToast("Verified! Welcome to Saathi Care.", "success");
    goStep(1);
    loadCaregivers();
    renderFamilyPastBookings();
  } catch (e) {
    showToast("Invalid code. Try again.", "error");
  } finally {
    btn.textContent = "Verify & Continue"; btn.disabled = false;
  }
}

function resendOTP() {
  document.getElementById("otp-step2").style.display = "none";
  document.getElementById("otp-step1").style.display = "block";
}

function skipOTPAndBook() {
  showScreen("screen-book");
  loadCaregivers();
}

async function renderFamilyPastBookings() {
  const wrap = document.getElementById("booking-step1");
  if (!wrap || !State.currentUser) return;
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where("elder.phone", "==", State.currentUser.phoneNumber)
      .limit(5).get();
    if (snap.empty) return;
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const statusLabels = { pending: "Pending", confirmed: "Confirmed", done: "Completed", cancelled: "Cancelled" };
    const panel = document.createElement("div");
    panel.id = "past-visits-panel";
    panel.style.cssText = "margin-top:28px";
    panel.innerHTML = `
      <div style="background:var(--teal-light);border:1.5px solid rgba(42,127,127,0.3);border-radius:var(--radius-lg);padding:20px 22px">
        <div style="font-weight:700;font-size:16px;color:var(--teal);margin-bottom:14px">📋 Your Past Visits</div>
        ${bookings.map(b => `
          <div style="background:white;border-radius:10px;padding:12px 14px;margin-bottom:10px;border:1.5px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
              <div style="font-weight:700;font-size:14px;color:var(--text)">${escHtml(b.services?.join(", ") || "Visit")}</div>
              <span class="status-badge status-${b.status || "new"}">${statusLabels[b.status] || "Pending"}</span>
            </div>
            <div style="font-size:13px;color:var(--text2)">${formatDate(b.slot?.date)} · ${b.slot?.time || ""}</div>
            <div style="font-size:13px;color:var(--text2)">with <strong>${escHtml(b.caregiverName || "—")}</strong></div>
          </div>
        `).join("")}
      </div>
    `;
    wrap.appendChild(panel);
  } catch (e) { console.error("Past bookings error:", e); }
}

// ─────────────────────────────────────────────
//  BOOKING FLOW — Public Side
// ─────────────────────────────────────────────
async function loadCaregivers(dateStr) {
  const container = document.getElementById("caregiver-grid");
  if (!container) return;
  container.innerHTML = `<div class="loading-spinner">Loading caregivers…</div>`;
  const targetDate = dateStr || todayStr();
  const dateInput = document.getElementById("book-date");
  if (dateInput && dateStr && dateInput.value !== dateStr) dateInput.value = dateStr;

  try {
    const snap = await db.collection(COLLECTIONS.CAREGIVERS).where("active", "==", true).get();
    State.caregivers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (State.caregivers.length === 0) {
      container.innerHTML = `<div class="empty-state">No caregivers available yet.</div>`;
      return;
    }
    const blockSnap = await db.collection(COLLECTIONS.BLOCKED).where("date", "==", targetDate).get();
    State.blockedSlots = {};
    blockSnap.docs.forEach(d => {
      const data = d.data();
      if (!State.blockedSlots[data.caregiverId]) State.blockedSlots[data.caregiverId] = [];
      State.blockedSlots[data.caregiverId].push(data.time);
    });
    const bookSnap = await db.collection(COLLECTIONS.BOOKINGS).where("slot.date", "==", targetDate).get();
    State.bookedSlots = {};
    bookSnap.docs.forEach(d => {
      const data = d.data();
      const cgId = data.caregiverId;
      if (!State.bookedSlots[cgId]) State.bookedSlots[cgId] = [];
      if (data.slotTimes && Array.isArray(data.slotTimes)) {
        data.slotTimes.forEach(t => { if (!State.bookedSlots[cgId].includes(t)) State.bookedSlots[cgId].push(t); });
      } else if (data.slot?.time && data.slot.time !== "TBD") {
        if (!State.bookedSlots[cgId].includes(data.slot.time)) State.bookedSlots[cgId].push(data.slot.time);
      }
    });
    renderCaregiverCards(container, targetDate);
  } catch (e) {
    container.innerHTML = `<div class="error-msg">Could not load caregivers. Please refresh.</div>`;
    console.error("loadCaregivers error:", e);
  }
}

function renderCaregiverCards(container, targetDate) {
  if (State.caregivers.length === 0) return;
  const TIME_SLOTS = ["9:00 AM","11:00 AM","1:00 PM","3:00 PM","5:00 PM","7:00 PM"];
  container.innerHTML = "";
  State.caregivers.forEach(cg => {
    const blocked = State.blockedSlots[cg.id] || [];
    const booked  = State.bookedSlots[cg.id]  || [];
    const card = document.createElement("div");
    card.className = "caregiver-card" + (State.selectedCaregiver?.id === cg.id ? " selected" : "");
    card.id = `cg-card-${cg.id}`;
    card.innerHTML = `
      <div class="cg-header" style="display:flex; align-items:center; gap:12px; margin-bottom:12px">
        <div class="avatar" style="background:${cg.avatarColor || "#2A7F7F"}; width:36px; height:36px; font-size:13px; flex-shrink:0">${initials(cg.name)}</div>
        <div class="cg-name" style="font-size:16px; font-weight:700; color:var(--text)">${escHtml(cg.name)}</div>
      </div>
      <div class="cg-slots" style="margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:16px">
        ${TIME_SLOTS.map(time => {
          const isTaken = blocked.includes(time) || blocked.includes("All Day") || booked.includes(time);
          const isSel   = State.selectedCaregiver?.id === cg.id && State.selectedSlot?.time === time;
          return `<button class="slot ${isTaken ? "taken" : ""} ${isSel ? "selected" : ""}" 
            ${isTaken ? "disabled" : ""} 
            data-time="${time}"
            onclick="selectSlot(event, this, '${time}', '${cg.id}', '${targetDate}')">${time}</button>`;
        }).join("")}
      </div>
      <div class="cg-details" style="padding-top:4px">
        <div class="cg-bio" style="font-size:12px; color:var(--text3); line-height:1.4">${escHtml(cg.bio || "Saathi Companion")}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleService(el, name) {
  if (State.selectedServices.includes(name)) {
    State.selectedServices = State.selectedServices.filter(s => s !== name);
    el.classList.remove("selected");
  } else {
    State.selectedServices.push(name);
    el.classList.add("selected");
  }
  document.getElementById("other-desc-wrap").style.display = State.selectedServices.includes("Other") ? "block" : "none";
}

function selectSlot(e, el, time, caregiverId, dateStr) {
  e.stopPropagation();
  const TIME_SLOTS = ["9:00 AM","11:00 AM","1:00 PM","3:00 PM","5:00 PM","7:00 PM"];
  const date = dateStr || document.getElementById("book-date")?.value || todayStr();
  const slotsNeeded = Math.max(1, Math.floor(State.bookingDuration / 2));
  const startIdx = TIME_SLOTS.indexOf(time);

  if (State.selectedSlot && State.selectedSlot.time === time && State.selectedCaregiver && State.selectedCaregiver.id === caregiverId) {
    document.querySelectorAll(".slot.selected").forEach(s => s.classList.remove("selected"));
    document.querySelectorAll(".caregiver-card.selected").forEach(c => c.classList.remove("selected"));
    State.selectedSlot = null; State.selectedCaregiver = null; return;
  }

  const blocked = State.blockedSlots[caregiverId] || [];
  const booked  = State.bookedSlots[caregiverId]  || [];
  for (let i = 0; i < slotsNeeded; i++) {
    const idx = startIdx + i;
    if (idx >= TIME_SLOTS.length) { showToast(`Not enough time slots left`, "error"); return; }
    const slotTime = TIME_SLOTS[idx];
    if (blocked.includes(slotTime) || blocked.includes("All Day") || booked.includes(slotTime)) {
      showToast(`Slot ${slotTime} is not available`, "error"); return;
    }
  }

  document.querySelectorAll(".slot.selected").forEach(s => s.classList.remove("selected"));
  document.querySelectorAll(".caregiver-card.selected").forEach(c => c.classList.remove("selected"));
  const card = document.getElementById(`cg-card-${caregiverId}`);
  if (card) {
    for (let i = 0; i < slotsNeeded; i++) {
      const slotTime = TIME_SLOTS[startIdx + i];
      const slotEl = card.querySelector(`.slot[data-time="${slotTime}"]`);
      if (slotEl) slotEl.classList.add("selected");
    }
    card.classList.add("selected");
  }
  State.selectedSlot = { date, time };
  const cg = State.caregivers.find(c => c.id === caregiverId);
  if (cg) State.selectedCaregiver = { id: cg.id, name: cg.name };
}

function onDurationChange() {
  const sel = document.getElementById("book-duration");
  State.bookingDuration = parseInt(sel.value) || 2;
  document.querySelectorAll(".slot.selected").forEach(s => s.classList.remove("selected"));
  document.querySelectorAll(".caregiver-card.selected").forEach(c => c.classList.remove("selected"));
  State.selectedSlot = null; State.selectedCaregiver = null;
}

function setBooker(el, type) {
  document.querySelectorAll(".radio-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  State.bookerType = type;
}

function goStep(n) {
  if (n === 2 && State.selectedServices.length === 0) { showToast("Please select at least one service", "error"); return; }
  if (n === 3 && !State.selectedSlot) { showToast("Please select a time slot", "error"); return; }
  if (n === 4) {
    State.elderDetails = {
      name   : document.getElementById("elder-name").value.trim(),
      phone  : document.getElementById("elder-phone").value.trim(),
      age    : document.getElementById("elder-age").value.trim(),
      address: document.getElementById("elder-address").value.trim(),
      notes  : document.getElementById("elder-notes").value.trim()
    };
    if (!State.elderDetails.name || !State.elderDetails.phone) { showToast("Elder's name and phone are required", "error"); return; }
    renderBookingSummary();
  }
  State.currentBookingStep = n;
  updateStepUI(n);
}

function updateStepUI(n) {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`booking-step${i}`);
    if (step) step.style.display = i === n ? "block" : "none";
    const num = document.getElementById(`step${i}-num`);
    const lbl = document.getElementById(`step${i}-lbl`);
    if (num) num.className = "step-num" + (i === n ? " active" : i < n ? " done" : "");
    if (lbl) lbl.className = "step-label" + (i === n ? " active" : i < n ? " done" : "");
  }
}

function renderBookingSummary() {
  const TIME_SLOTS = ["9:00 AM","11:00 AM","1:00 PM","3:00 PM","5:00 PM","7:00 PM"];
  let slotDisplay = "-";
  if (State.selectedSlot) {
    const slotsNeeded = Math.max(1, Math.floor(State.bookingDuration / 2));
    const startIdx = TIME_SLOTS.indexOf(State.selectedSlot.time);
    const endIdx = Math.min(startIdx + slotsNeeded - 1, TIME_SLOTS.length - 1);
    slotDisplay = `${State.selectedSlot.time} — ${TIME_SLOTS[endIdx]} (${State.bookingDuration}h) · ${formatDate(State.selectedSlot.date)}`;
  }
  setText("sum-service",   State.selectedServices.join(", ") || "—");
  setText("sum-caregiver", State.selectedCaregiver?.name || "Auto-assigned");
  setText("sum-slot",      slotDisplay);
  setText("sum-elder",     State.elderDetails.name);
  setText("sum-phone",     State.elderDetails.phone);
  setText("sum-age",       State.elderDetails.age || "—");
  setText("sum-address",   State.elderDetails.address || "—");
  setText("sum-notes",     State.elderDetails.notes || "None");
  setText("sum-booker",    State.bookerType);
}

async function confirmBooking() {
  const btn = document.getElementById("confirm-btn");
  btn.textContent = "Confirming…"; btn.disabled = true;
  try {
    const TIME_SLOTS = ["9:00 AM","11:00 AM","1:00 PM","3:00 PM","5:00 PM","7:00 PM"];
    const slotsNeeded = Math.max(1, Math.floor(State.bookingDuration / 2));
    const startIdx = State.selectedSlot ? TIME_SLOTS.indexOf(State.selectedSlot.time) : 0;
    const slotTimes = [];
    for (let i = 0; i < slotsNeeded && (startIdx + i) < TIME_SLOTS.length; i++) slotTimes.push(TIME_SLOTS[startIdx + i]);

    const booking = {
      services     : State.selectedServices,
      caregiverId  : State.selectedCaregiver?.id || "auto",
      caregiverName: State.selectedCaregiver?.name || "Saathi Care",
      slot         : State.selectedSlot || { date: todayStr(), time: "TBD" },
      slotTimes    : slotTimes,
      duration     : State.bookingDuration,
      elder        : State.elderDetails,
      status       : "pending",
      createdAt    : firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection(COLLECTIONS.BOOKINGS).add(booking);
    setText("success-caregiver",  booking.caregiverName);
    setText("success-booking-id", ref.id.slice(0, 8).toUpperCase());
    showScreen("screen-success");
  } catch (err) {
    showToast("Booking failed", "error");
  } finally {
    btn.textContent = "Confirm Booking ✓"; btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
//  DASHBOARD — Caregiver Side
// ─────────────────────────────────────────────
async function loadDashboardData() {
  if (!State.currentUser) return;
  await Promise.all([loadBookings(), loadBlockedSlots(), loadGallery()]);
  renderCalendar();
}

async function loadBookings() {
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS).where("caregiverId", "==", State.currentUser.uid).get();
    State.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
    renderBookingsList();
    renderDashStats();
  } catch (e) { console.error(e); }
}

function renderDashStats() {
  const pending = State.bookings.filter(b => b.status === "pending").length;
  setText("stat-new", pending);
  setText("stat-week", State.bookings.length);
  setText("stat-done", State.bookings.filter(b => b.status === "done").length);
}

function renderBookingsList() {
  const container = document.getElementById("bookings-list");
  if (!container) return;
  if (State.bookings.length === 0) { container.innerHTML = `<div class="empty-state">No bookings yet.</div>`; return; }
  container.innerHTML = State.bookings.map(b => `
    <div class="request-card">
      <div class="req-body">
        <div class="req-title">${escHtml(b.services?.join(", "))}</div>
        <div class="req-meta">📅 ${b.slot?.time} · ${formatDate(b.slot?.date)}</div>
        <div class="req-meta">👤 ${escHtml(b.elder?.name)}</div>
        <div class="req-actions">
          ${b.status === "pending" ? `<button class="btn btn-teal btn-sm" onclick="updateBookingStatus('${b.id}','confirmed')">Accept</button>` : ""}
        </div>
      </div>
    </div>`).join("");
}

async function updateBookingStatus(id, status) {
  try {
    await db.collection(COLLECTIONS.BOOKINGS).doc(id).update({ status });
    showToast("Status updated ✓", "success");
    loadBookings();
  } catch (e) { showToast("Failed", "error"); }
}

async function loadBlockedSlots() {
  const snap = await db.collection(COLLECTIONS.BLOCKED).where("caregiverId", "==", State.currentUser.uid).get();
  State.myBlockedSlots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderCalendar(y, m) {
  const grid = document.getElementById("cal-days-grid");
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3)">Calendar rendering...</div>`;
}

async function loadGallery() {
  const snap = await db.collection(COLLECTIONS.MEDIA).limit(20).get();
  State.galleryItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;
  grid.innerHTML = State.galleryItems.map(item => `
    <div class="media-item">
      <img src="${item.url}" style="width:100%;height:100%;object-fit:cover">
    </div>`).join("") + `<div class="upload-btn" onclick="triggerUpload()">+ Add</div>`;
}

function triggerUpload() { document.getElementById("media-upload-input").click(); }

async function handleMediaUpload(input) {
  const file = input.files[0];
  if (!file) return;
  showToast("Uploading...");
  // Cloudinary logic omitted for brevity in unified script
  showToast("Upload feature needs backend setup", "info");
}

async function submitApplication() {
  const name = document.getElementById("app-name").value.trim();
  if (!name) { showToast("Name is required", "error"); return; }
  try {
    await db.collection("applications").add({ name, status: "pending", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    showScreen("screen-apply-success");
  } catch (e) { showToast("Failed", "error"); }
}

async function loadOwnerDashboard() { loadOwnerPanelData(); }
async function approveApplication(id) { await db.collection("applications").doc(id).update({ status: "approved" }); loadOwnerPanelData(); }
async function rejectApplication(id) { await db.collection("applications").doc(id).update({ status: "rejected" }); loadOwnerPanelData(); }

function setDashTab(tab) {
  ["requests","calendar","gallery","owner"].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
}

function setOwnerTab(tab) {
  const el = document.getElementById(`owner-tab-${tab}`);
  if (el) el.style.display = "block";
}

// ── UTILS ─────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0]; }
function formatDate(s) { return s || "—"; }
function initials(n) { return (n || "?").split(" ").map(w => w[0]).join(""); }
function escHtml(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function scrollToHow() { document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); }

async function loadPublicGallery() {
  const container = document.getElementById("home-gallery-preview");
  if (!container) return;
  try {
    const snap = await db.collection(COLLECTIONS.MEDIA).limit(6).get();
    if (snap.empty) { container.innerHTML = "No moments yet"; return; }
    container.innerHTML = "";
    snap.forEach(doc => {
      const img = document.createElement("img");
      img.src = doc.data().url;
      img.style = "width:100%;height:100%;object-fit:cover;border-radius:12px";
      container.appendChild(img);
    });
  } catch (e) { container.innerHTML = "Gallery failed to load"; }
}

// ── EXPOSE TO WINDOW ───────────────────────────
const GlobalActions = {
  showScreen, showToast, doLogin, doLogout, sendOTP, verifyOTP, resendOTP, skipOTPAndBook,
  toggleService, selectCaregiver: (id) => loadCaregivers(), selectSlot, onDurationChange,
  setBooker, goStep, confirmBooking, loadCaregivers, updateBookingStatus,
  triggerUpload, handleMediaUpload, submitApplication, loadOwnerDashboard, approveApplication, rejectApplication,
  setDashTab, setOwnerTab, scrollToHow, loadPublicGallery
};
for (const [k, v] of Object.entries(GlobalActions)) window[k] = v;

document.addEventListener("DOMContentLoaded", () => {
  loadPublicGallery();
  console.log("Saathi Unified App v3 Loaded");
});