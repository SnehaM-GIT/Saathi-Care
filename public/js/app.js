// ============================================================
//  ACCOMPANY — Firebase Configuration & App Initialization
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

// Initialize a secondary app instance to allow creating accounts for others without logging out the owner
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");

const auth = firebase.auth();
const secondaryAuth = secondaryApp.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const COLLECTIONS = {
  CAREGIVERS: "caregivers",
  BOOKINGS: "bookings",
  MEDIA: "media",
  BLOCKED: "blocked_slots",
  GROUP_TRIPS: "group_trips",
  TRIP_INTERESTS: "trip_interests",
  PUBLIC_FEEDBACK: "public_feedback",
  TRIP_REPORTS: "trip_reports"
};

// ============================================================
//  ACCOMPANY — Main Application Logic v2 (Unified)
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
  calDate          : new Date(),
  isOwner          : false
};

const OWNER_EMAILS = [
  "snehatest29@gmail.com",
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
  // Close drawer whenever we navigate to a new screen
  closeDrawer();
}

// ─────────────────────────────────────────────
//  HAMBURGER DRAWER
// ─────────────────────────────────────────────
function openDrawer() {
  document.getElementById("drawer-nav").classList.add("open");
  document.getElementById("drawer-overlay").classList.add("open");
  document.getElementById("hamburger-btn").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  const nav = document.getElementById("drawer-nav");
  const overlay = document.getElementById("drawer-overlay");
  const btn = document.getElementById("hamburger-btn");
  if (nav) nav.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
  if (btn) btn.classList.remove("open");
  document.body.style.overflow = "";
}

function toggleDrawerGroup(headerEl) {
  headerEl.classList.toggle("expanded");
  const sub = headerEl.nextElementSibling;
  if (sub && sub.classList.contains("drawer-sub-menu")) {
    sub.classList.toggle("open");
  }
}

function navigateDrawer(view) {
  closeDrawer();
  showScreen("screen-home");
  // Small delay so drawer close animation completes before content switches
  setTimeout(() => switchHomeView(view, null), 50);
  // Highlight active drawer item
  document.querySelectorAll(".drawer-item").forEach(el => el.classList.remove("active"));
  const activeItem = document.getElementById("dnav-home");
  if (view === "main" && activeItem) activeItem.classList.add("active");
}

function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove("show"), 4000);
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
    ownerTabBtn.onclick    = () => { setDashTab("owner"); const menu = document.getElementById('dash-nav-menu'); if(menu) menu.classList.remove('open'); };
    tabsEl.appendChild(ownerTabBtn);
    
    // Also re-render the gallery now that we know they are the owner
    // so the delete buttons show up.
    if (State.galleryItems && State.galleryItems.length > 0) {
      renderGallery();
    }
    
    const feedbackTabBtn = document.createElement("button");
    feedbackTabBtn.className  = "tab";
    feedbackTabBtn.id         = "tab-feedback-btn";
    feedbackTabBtn.innerHTML  = "📝 Reports & Feedback";
    feedbackTabBtn.onclick    = () => { setDashTab("feedback-reports"); loadOwnerFeedbackData(); const menu = document.getElementById('dash-nav-menu'); if(menu) menu.classList.remove('open'); };
    tabsEl.appendChild(feedbackTabBtn);
  }

  const dashBody = document.querySelector("#screen-caregiver-dashboard .dash-body");
  if (dashBody && !document.getElementById("tab-owner")) {
    const ownerPanel = document.createElement("div");
    ownerPanel.id = "tab-owner";
    ownerPanel.style.display = "none";
    ownerPanel.innerHTML = `
      <div style="margin-bottom:32px">
        <div style="font-weight:700;font-size:20px;margin-bottom:4px;color:var(--text)">Caregiver Applications</div>
        <div style="color:var(--text2);font-size:14px;margin-bottom:20px">People who applied to become a Companion. Approve or reject below.</div>
        <div id="owner-applications-list2"><div class="loading-spinner">Loading applications…</div></div>
      </div>
    `;
    dashBody.appendChild(ownerPanel);
    
    const feedbackPanel = document.createElement("div");
    feedbackPanel.id = "tab-feedback-reports";
    feedbackPanel.style.display = "none";
    feedbackPanel.innerHTML = `
      <div style="margin-bottom:32px">
        <div style="font-weight:700;font-size:20px;margin-bottom:4px;color:var(--text)">Public Feedback</div>
        <div id="owner-public-feedback-list"><div class="loading-spinner">Loading...</div></div>
      </div>
      <div style="margin-bottom:32px">
        <div style="font-weight:700;font-size:20px;margin-bottom:4px;color:var(--text)">Caregiver Post-Trip Reports</div>
        <div id="owner-trip-reports-list"><div class="loading-spinner">Loading...</div></div>
      </div>
    `;
    dashBody.appendChild(feedbackPanel);
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
            <div class="req-meta">📧 ${a.email ? escHtml(a.email) : '<span style="color:red">Missing</span>'} · 📞 ${a.phone ? escHtml(a.phone) : '<span style="color:red">Missing</span>'}</div>
            <div class="req-actions">
              ${a.status !== "approved" ? `<button class="btn btn-teal btn-sm" onclick="approveApplication('${a.id}', this)">✓ Approve</button>` : ""}
              ${a.status !== "rejected" ? `<button class="btn btn-ghost btn-sm" onclick="rejectApplication('${a.id}', this)">✗ Reject</button>`  : ""}
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
    showToast("Verified! Welcome to Accompany.", "success");
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
        <div class="cg-bio" style="font-size:12px; color:var(--text); line-height:1.4"><strong>About:</strong> ${escHtml(cg.bio || "Companion")}</div>
        ${cg.langs ? `<div style="font-size:11px; color:var(--text3); margin-top:2px;"><strong>Languages:</strong> ${escHtml(cg.langs)}</div>` : ''}
        ${cg.interest ? `<div style="font-size:11px; color:var(--text3); margin-top:2px;"><strong>Interests:</strong> ${escHtml(cg.interest)}</div>` : ''}
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
      caregiverName: State.selectedCaregiver?.name || "Accompany",
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
  await Promise.all([loadBookings(), loadBlockedSlots(), loadGallery(), loadGroupTrips()]);
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
          ${b.status === "confirmed" ? `<button class="btn btn-outline btn-sm" onclick="openReportModal('${b.id}')">Finish & Report</button>` : ""}
          ${b.status === "done" ? `<span class="status-badge status-confirmed" style="font-size:12px;">Completed</span>` : ""}
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

function renderCalendar() {
  const grid = document.getElementById("cal-days-grid");
  if (!grid) return;
  
  const d = State.calDate || new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  setText("cal-month-title", `${monthNames[month]} ${year}`);
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  
  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day empty"></div>`;
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isToday = isCurrentMonth && today.getDate() === i;
    
    // Check bookings and blocks
    const dayBookings = State.bookings.filter(b => b.slot?.date === dateStr);
    const hasBooking = dayBookings.length > 0;
    const dayBlocks = State.myBlockedSlots.filter(b => b.date === dateStr);
    const hasBlock = dayBlocks.length > 0;
    
    let indicatorHtml = "";
    if (isToday) indicatorHtml += `<div style="width:6px;height:6px;border-radius:50%;background:var(--teal);margin-bottom:2px"></div>`;
    if (hasBooking) indicatorHtml += `<div style="width:6px;height:6px;border-radius:50%;background:var(--orange);margin-bottom:2px"></div>`;
    if (hasBlock) indicatorHtml += `<div style="width:6px;height:6px;border-radius:50%;background:var(--red)"></div>`;
    
    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${hasBooking ? 'has-booking' : ''}" 
           onclick="showDayDetail('${dateStr}')" style="cursor:pointer;position:relative;display:flex;flex-direction:column;align-items:center;padding-top:10px;height:60px;border-bottom:1px solid var(--border);border-right:1px solid var(--border)">
        <div class="cal-date-num" style="font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--teal)' : 'var(--text)'}">${i}</div>
        <div style="display:flex;gap:3px;position:absolute;bottom:8px">${indicatorHtml}</div>
      </div>
    `;
  }
  
  grid.innerHTML = html;
}

function calNav(dir) {
  if (!State.calDate) State.calDate = new Date();
  State.calDate.setMonth(State.calDate.getMonth() + dir);
  renderCalendar();
}

function showDayDetail(dateStr) {
  const panel = document.getElementById("day-detail-panel");
  if (!panel) return;
  
  const blockInput = document.getElementById("block-date");
  if (blockInput) blockInput.value = dateStr;
  
  const dayBookings = State.bookings.filter(b => b.slot?.date === dateStr);
  const dayBlocks = State.myBlockedSlots.filter(b => b.date === dateStr);
  
  if (dayBookings.length === 0 && dayBlocks.length === 0) {
    panel.innerHTML = `<div style="padding:16px;background:var(--white);border-radius:var(--radius);border:1.5px solid var(--border);margin-bottom:20px;text-align:center;color:var(--text2)">No schedule for ${formatDate(dateStr)}</div>`;
    return;
  }
  
  let html = `<div style="padding:16px;background:var(--white);border-radius:var(--radius);border:1.5px solid var(--border);margin-bottom:20px">`;
  html += `<div style="font-weight:700;margin-bottom:12px;font-size:16px">Schedule for ${formatDate(dateStr)}</div>`;
  
  dayBookings.forEach(b => {
    html += `
      <div style="background:var(--teal-light);padding:10px 14px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(42,127,127,0.2)">
        <div style="font-size:14px;font-weight:700;color:var(--teal);margin-bottom:2px">${b.slot?.time} · ${escHtml(b.services?.join(", "))}</div>
        <div style="font-size:13px;color:var(--text2)">👤 ${escHtml(b.elder?.name)}</div>
      </div>
    `;
  });
  
  dayBlocks.forEach(b => {
    html += `
      <div style="background:#FFEBEE;padding:10px 14px;border-radius:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(220,53,69,0.2)">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--red);margin-bottom:2px">🚫 ${b.time} (Blocked)</div>
          ${b.reason ? `<div style="font-size:13px;color:var(--text2)">${escHtml(b.reason)}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:4px 8px;font-size:12px" onclick="unblockSlot('${b.id}')">Remove</button>
      </div>
    `;
  });
  
  html += `</div>`;
  panel.innerHTML = html;
}

async function blockSlot() {
  const date = document.getElementById("block-date").value;
  const time = document.getElementById("block-time").value;
  const reason = document.getElementById("block-reason").value.trim();
  
  if (!date || !time) {
    showToast("Select date and time to block", "error");
    return;
  }
  
  const btn = document.getElementById("block-btn");
  btn.disabled = true;
  btn.textContent = "Blocking...";
  
  try {
    await db.collection(COLLECTIONS.BLOCKED).add({
      caregiverId: State.currentUser.uid,
      date,
      time,
      reason,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showToast("Slot blocked", "success");
    document.getElementById("block-reason").value = "";
    await loadBlockedSlots();
    renderCalendar();
    showDayDetail(date);
  } catch (e) {
    console.error(e);
    showToast("Failed to block slot", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🚫 Block This Slot";
  }
}

async function unblockSlot(id) {
  try {
    await db.collection(COLLECTIONS.BLOCKED).doc(id).delete();
    showToast("Block removed", "success");
    await loadBlockedSlots();
    renderCalendar();
    const currentViewDate = document.getElementById("block-date").value;
    if (currentViewDate) showDayDetail(currentViewDate);
  } catch (e) {
    console.error(e);
    showToast("Failed to remove block", "error");
  }
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
    <div class="media-item" style="position:relative;">
      <img src="${item.url}" style="width:100%;height:100%;object-fit:cover">
      ${State.isOwner ? `<button onclick="deleteMedia('${item.id}')" style="position:absolute;top:4px;right:4px;background:red;color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:12px;z-index:10;" title="Delete image">✕</button>` : ''}
    </div>`).join("") + `<div class="upload-btn" onclick="triggerUpload()">+ Add</div>`;
}

async function deleteMedia(id) {
  if (!confirm("Are you sure you want to delete this image?")) return;
  try {
    await db.collection(COLLECTIONS.MEDIA).doc(id).delete();
    showToast("Image deleted", "success");
    await loadGallery();
  } catch (e) {
    console.error(e);
    showToast("Failed to delete image", "error");
  }
}

function triggerUpload() { document.getElementById("media-upload-input").click(); }

async function handleMediaUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (!State.currentUser) {
    showToast("You must be logged in to upload", "error");
    return;
  }

  showToast("Uploading to Firebase Storage...");

  try {
    const ext = file.name.split('.').pop() || "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const storageRef = firebase.storage().ref(`gallery/${State.currentUser.uid}/${fileName}`);
    
    await storageRef.put(file);
    const url = await storageRef.getDownloadURL();

    // Save media record in Firestore so gallery reads from the same collection
    await db.collection(COLLECTIONS.MEDIA).add({
      url,
      uploadedBy: State.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Uploaded successfully", "success");
    // Refresh gallery
    await loadGallery();
  } catch (e) {
    console.error('Upload error', e);
    showToast("Upload failed", "error");
  }
}

async function submitApplication() {
  const name     = document.getElementById("app-name")?.value.trim();
  const age      = document.getElementById("app-age")?.value.trim();
  const phone    = document.getElementById("app-phone")?.value.trim();
  const email    = document.getElementById("app-email")?.value.trim();
  const area     = document.getElementById("app-area")?.value.trim();
  const occ      = document.getElementById("app-occ")?.value.trim();
  const time     = document.getElementById("app-avail-time")?.value.trim();
  const freq     = document.getElementById("app-avail-freq")?.value.trim();
  const langs    = document.getElementById("app-langs")?.value.trim();
  const interest = document.getElementById("app-interest")?.value.trim();
  const skills   = document.getElementById("app-skills")?.value.trim();
  const bio      = document.getElementById("app-bio")?.value.trim();

  if (!name || !email || !phone) { showToast("Name, Email and Phone are required", "error"); return; }
  
  const btn = document.getElementById("app-submit-btn");
  if(btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  try {
    await db.collection("applications").add({
      name, age, phone, email, area, occ, time, freq, langs, interest, skills, bio,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showScreen("screen-apply-success");
  } catch (e) { 
    showToast("Submission failed", "error"); 
  } finally {
    if(btn) { btn.textContent = "Become a Volunteer Sakha/Sakhi 🙏"; btn.disabled = false; }
  }
}

async function doChangePassword() {
  const newPw = document.getElementById("new-pw").value;
  const confirmPw = document.getElementById("confirm-pw").value;

  if (newPw !== confirmPw) { showToast("Passwords don't match", "error"); return; }
  if (newPw.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }

  const btn = document.getElementById("change-pw-btn");
  btn.textContent = "Updating..."; btn.disabled = true;

  try {
    await State.currentUser.updatePassword(newPw);
    showToast("Password updated successfully!", "success");
    document.getElementById("new-pw").value = "";
    document.getElementById("confirm-pw").value = "";
  } catch (e) {
    showToast("Failed to update password. You may need to login again.", "error");
  } finally {
    btn.textContent = "Update Password"; btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
//  FEEDBACK & REPORTS SYSTEM
// ─────────────────────────────────────────────

function setStarRating(val) {
  document.getElementById("feedback-rating").value = val;
  const stars = document.querySelectorAll("#star-rating span");
  stars.forEach((s, idx) => {
    s.style.color = idx < val ? "#E8722A" : "#A08C7A";
    s.innerHTML = idx < val ? "★" : "☆";
  });
  document.getElementById("star-rating-label").innerText = val + " Star" + (val > 1 ? "s" : "");
}

async function submitPublicFeedback() {
  const name = document.getElementById("feedback-name").value.trim();
  const rating = parseInt(document.getElementById("feedback-rating").value, 10);
  const text = document.getElementById("feedback-text").value.trim();
  
  if (!name || !text) { showToast("Name and Review are required.", "error"); return; }
  if (rating === 0 || isNaN(rating)) { showToast("Please select a star rating.", "error"); return; }
  
  try {
    await db.collection(COLLECTIONS.PUBLIC_FEEDBACK).add({
      name, rating, text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("Thank you for your feedback!", "success");
    // Reset form
    document.getElementById("feedback-name").value = "";
    document.getElementById("feedback-text").value = "";
    document.getElementById("feedback-rating").value = "0";
    document.querySelectorAll("#star-rating span").forEach(s => s.innerHTML = "☆");
    document.getElementById("star-rating-label").innerText = "Click a star to rate";
    loadPublicFeedback();
  } catch (e) {
    showToast("Error submitting feedback.", "error");
  }
}

async function loadPublicFeedback() {
  const list = document.getElementById("public-feedback-list-home");
  if (!list) return;
  try {
    const snap = await db.collection(COLLECTIONS.PUBLIC_FEEDBACK).orderBy("createdAt", "desc").limit(20).get();
    const reviews = snap.docs.map(d => d.data());
    if (reviews.length === 0) {
      list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text2);">No reviews yet. Be the first to share your experience!</div>`;
      return;
    }
    list.innerHTML = reviews.map(r => `
      <div style="background:white; padding:20px; border-radius:8px; border:1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: transform 0.2s ease;">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
          <strong style="color:var(--text); font-size:16px;">${escHtml(r.name)}</strong>
          <span style="font-size:16px; letter-spacing: 2px;">${"⭐".repeat(r.rating || 5)}</span>
        </div>
        <p style="color:var(--text2); font-size:14px; margin:0; line-height:1.6; font-style: italic;">"${escHtml(r.text)}"</p>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<div class="error-msg" style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text2);">Could not load reviews.</div>`;
  }
}

function openReportModal(bookingId) {
  document.getElementById("report-booking-id").value = bookingId;
  document.getElementById("report-summary").value = "";
  document.getElementById("report-notes").value = "";
  document.getElementById("caregiver-report-modal").style.display = "flex";
}

function closeReportModal() {
  document.getElementById("caregiver-report-modal").style.display = "none";
}

async function submitTripReport() {
  const bookingId = document.getElementById("report-booking-id").value;
  const summary = document.getElementById("report-summary").value.trim();
  const notes = document.getElementById("report-notes").value.trim();
  
  if (!summary) { showToast("Trip summary is required.", "error"); return; }
  
  const btn = document.getElementById("report-submit-btn");
  btn.textContent = "Submitting..."; btn.disabled = true;
  
  try {
    await db.collection(COLLECTIONS.TRIP_REPORTS).add({
      bookingId,
      caregiverId: State.currentUser.uid,
      caregiverName: State.caregiverProfile?.name || "Unknown",
      summary,
      notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Mark booking as done
    await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).update({ status: "done" });
    
    showToast("Report submitted successfully!", "success");
    closeReportModal();
    loadBookings();
  } catch (e) {
    showToast("Failed to submit report.", "error");
  } finally {
    btn.textContent = "Submit Report"; btn.disabled = false;
  }
}

async function loadOwnerFeedbackData() {
  const pubList = document.getElementById("owner-public-feedback-list");
  const repList = document.getElementById("owner-trip-reports-list");
  if (!pubList || !repList) return;
  
  try {
    // Load Public
    const pSnap = await db.collection(COLLECTIONS.PUBLIC_FEEDBACK).orderBy("createdAt", "desc").limit(20).get();
    const pReviews = pSnap.docs.map(d => d.data());
    pubList.innerHTML = pReviews.length === 0 ? `<div class="empty-state">No public reviews.</div>` : pReviews.map(r => `
      <div class="request-card" style="margin-bottom:10px;">
        <div class="req-body">
          <div style="font-weight:700;">${escHtml(r.name)} - ${"⭐".repeat(r.rating || 5)}</div>
          <div style="font-size:14px; color:var(--text2); margin-top:4px;">"${escHtml(r.text)}"</div>
        </div>
      </div>
    `).join("");

    // Load Trip Reports
    const rSnap = await db.collection(COLLECTIONS.TRIP_REPORTS).orderBy("createdAt", "desc").limit(20).get();
    const rReports = rSnap.docs.map(d => d.data());
    repList.innerHTML = rReports.length === 0 ? `<div class="empty-state">No trip reports.</div>` : rReports.map(r => `
      <div class="request-card" style="margin-bottom:10px;">
        <div class="req-body">
          <div style="font-weight:700;">Sakha/Sakhi: ${escHtml(r.caregiverName)}</div>
          <div style="font-size:14px; color:var(--text2); margin-top:4px;"><strong>Summary:</strong> ${escHtml(r.summary)}</div>
          <div style="font-size:14px; color:var(--text2); margin-top:4px;"><strong>Notes for Family:</strong> ${escHtml(r.notes || "None")}</div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    pubList.innerHTML = `<div class="error-msg">Error loading feedback.</div>`;
    repList.innerHTML = `<div class="error-msg">Error loading reports.</div>`;
  }
}


async function loadOwnerDashboard() { loadOwnerPanelData(); }

// ── Credentials modal ─────────────────────────────────────
function showCredentialsModal(name, email, password, phone) {
  // Remove any existing modal
  const existing = document.getElementById("credentials-modal");
  if (existing) existing.remove();

  const waPhone = (phone || "").replace(/\D/g, "");
  const fullMsg =
    `🙏 Hi ${name},\n\nYour Saathi Care Companion account has been approved!\n\n` +
    `📧 Email: ${email}\n🔑 Password: ${password}\n\n` +
    `Please log in at https://saathi-care-a8525.web.app and change your password in Settings after your first login.\n\nWelcome to the Saathi family! 💚`;
  const waUrl = waPhone
    ? `https://wa.me/91${waPhone}?text=${encodeURIComponent(fullMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(fullMsg)}`;

  const modal = document.createElement("div");
  modal.id = "credentials-modal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:18px;padding:32px 28px;max-width:460px;width:100%;
      box-shadow:0 24px 60px rgba(0,0,0,0.22);position:relative;font-family:var(--font-sans,sans-serif);
    ">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:44px;margin-bottom:8px;">✅</div>
        <div style="font-size:20px;font-weight:800;color:#1a2e2a;margin-bottom:4px;">Account Created!</div>
        <div style="font-size:14px;color:#6b7280;">Share these login details with <strong>${name}</strong></div>
      </div>

      <div style="background:#F0FDF9;border:1.5px solid #A7F3D0;border-radius:12px;padding:18px;margin-bottom:16px;">
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">📧 Email</div>
          <div style="font-size:15px;font-weight:600;color:#1a2e2a;word-break:break-all;user-select:all;">${email}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">🔑 Temporary Password</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:18px;font-weight:800;color:#1a2e2a;letter-spacing:2px;font-family:monospace;user-select:all;">${password}</div>
            <button onclick="
              navigator.clipboard.writeText('${password}');
              this.textContent='✓ Copied';
              setTimeout(()=>this.textContent='Copy',1500);
            " style="
              background:#047857;color:#fff;border:none;border-radius:8px;
              padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;
            ">Copy</button>
          </div>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">💬 Full Message — Tap to select all, or copy below</div>
        <textarea id="cred-full-msg" readonly onclick="this.select()" style="
          width:100%;box-sizing:border-box;height:150px;
          background:#F9FAFB;border:1.5px solid #D1FAE5;border-radius:10px;
          padding:12px;font-size:13px;color:#1a2e2a;line-height:1.6;
          resize:none;font-family:inherit;outline:none;cursor:text;user-select:all;
        ">${fullMsg.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</textarea>
        <button id="copy-full-msg-btn" onclick="
          const ta = document.getElementById('cred-full-msg');
          ta.select();
          navigator.clipboard.writeText(ta.value).then(() => {
            const b = document.getElementById('copy-full-msg-btn');
            b.innerHTML = '✓ Copied!';
            b.style.background = '#047857';
            setTimeout(() => { b.innerHTML = '📋 Copy Full Message'; b.style.background = '#1f2937'; }, 2000);
          });
        " style="
          margin-top:8px;width:100%;background:#1f2937;color:#fff;border:none;
          border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;
        ">📋 Copy Full Message</button>
      </div>

      <div style="font-size:12px;color:#6b7280;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:10px 14px;margin-bottom:20px;">
        ⚠️ Ask <strong>${name}</strong> to change this password after their first login in <em>Settings → Change Password</em>.
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="${waUrl}" target="_blank" style="
          display:flex;align-items:center;justify-content:center;gap:10px;
          background:#25D366;color:#fff;text-decoration:none;
          border-radius:12px;padding:14px;font-size:15px;font-weight:700;
          box-shadow:0 4px 14px rgba(37,211,102,0.35);
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Open WhatsApp & Send
        </a>
        <button onclick="document.getElementById('credentials-modal').remove()" style="
          background:#F3F4F6;color:#374151;border:none;border-radius:12px;
          padding:13px;font-size:14px;font-weight:600;cursor:pointer;
        ">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

async function approveApplication(id, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Processing...";
  }
  
  try {
    const appRef = db.collection("applications").doc(id);
    const snap = await appRef.get();
    const appData = snap.data();

    if (!appData || !appData.email) {
      showToast("Cannot approve: Missing application data.", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = "✓ Approve"; }
      return;
    }

    // Generate a memorable random password
    const randomPassword = Math.random().toString(36).slice(-8).toUpperCase() +
                           Math.floor(10 + Math.random() * 90) + "!";
    let uid = id;

    showToast("Creating account...", "info");

    try {
      // Use secondary auth instance so owner stays logged in
      const userCred = await secondaryAuth.createUserWithEmailAndPassword(appData.email, randomPassword);
      uid = userCred.user.uid;
      await secondaryAuth.signOut();
    } catch (authErr) {
      if (authErr.code === "auth/email-already-in-use") {
        showToast("Account already exists for this email — updating profile only.", "info");
      } else {
        throw new Error("Auth Error: " + authErr.message);
      }
    }

    // Mark application as approved
    await appRef.update({ status: "approved" });

    // Create / update caregiver profile in Firestore
    // (Firestore rules now allow owners to write caregivers docs)
    await db.collection(COLLECTIONS.CAREGIVERS).doc(uid).set({
      name     : appData.name     || "",
      email    : appData.email    || "",
      phone    : appData.phone    || "",
      age      : appData.age      || "",
      area     : appData.area     || "",
      occ      : appData.occ      || "",
      langs    : appData.langs    || "",
      interest : appData.interest || "",
      skills   : appData.skills   || "",
      bio      : appData.bio      || "Companion",
      active   : true,
      since    : new Date().getFullYear(),
      rating   : 5.0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast("Application Approved! ✅", "success");

    // Show styled modal with credentials + WhatsApp share
    showCredentialsModal(appData.name, appData.email, randomPassword, appData.phone);

    loadOwnerPanelData();
  } catch (e) {
    console.error("Approval failure:", e);
    showToast("Error: " + (e.message || "Unknown failure"), "error");
    if (btn) { btn.disabled = false; btn.innerHTML = "✓ Approve"; }
  }
}
async function rejectApplication(id) { await db.collection("applications").doc(id).update({ status: "rejected" }); loadOwnerPanelData(); }

function setDashTab(tab) {
  ["requests","calendar","gallery","owner","settings", "group-trips"].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
  // Update active tab style
  document.querySelectorAll(".tabs .tab").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick").includes(`'${tab}'`) || btn.getAttribute("onclick").includes(`"${tab}"`)) {
      btn.classList.add("active");
    }
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

// ============================================================
//  PROACTIVE GROUP YATRAS — Caregiver & Public Signups
// ============================================================
async function loadGroupTrips() {
  const container = document.getElementById("dashboard-group-trips-list");
  if (!container) return;
  container.innerHTML = `<div class="loading-spinner">Loading group trips…</div>`;
  
  try {
    const snap = await db.collection(COLLECTIONS.GROUP_TRIPS).orderBy("date", "asc").get();
    const trips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (trips.length === 0) {
      container.innerHTML = `<div class="empty-state">No upcoming trips are scheduled yet. Check back soon!</div>`;
      return;
    }

    const tripsWithCounts = await Promise.all(trips.map(async trip => {
      const interestsSnap = await db.collection(COLLECTIONS.TRIP_INTERESTS).where("tripId", "==", trip.id).get();
      return {
        ...trip,
        interestCount: interestsSnap.size
      };
    }));

    container.innerHTML = tripsWithCounts.map(t => {
      const isMyTrip = State.currentUser && t.createdBy === State.currentUser.uid;
      return `
        <div class="request-card" style="margin-bottom:14px; border-left:4px solid var(--teal)">
          <div class="req-body">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px">
              <div class="req-title" style="font-size:17px; font-weight:700; color:var(--text)">${escHtml(t.title)}</div>
              <span class="status-badge status-confirmed" style="background:var(--teal-light); color:var(--teal)">
                👥 ${t.interestCount || 0} Interested
              </span>
            </div>
            <div class="req-meta" style="margin-top:6px; color:var(--text2)">
              📅 <strong>${formatDate(t.date)}${t.endDate && t.endDate !== t.date ? ' to ' + formatDate(t.endDate) : ''}</strong>
            </div>
            <div class="req-meta" style="margin-top:6px; font-size:14px; color:var(--text2); line-height:1.5;">
              ${escHtml(t.description || "")}
            </div>
            <div class="req-actions" style="margin-top:12px; display:flex; gap:8px;">
              <button class="btn btn-teal btn-sm" onclick="loadTripInterests('${t.id}', '${escHtml(t.title)}')">🔍 View Interest Details</button>
              ${isMyTrip ? `<button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:rgba(192,57,43,0.3)" onclick="deleteGroupTrip('${t.id}')">🗑️ Delete</button>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error("loadGroupTrips error:", e);
    container.innerHTML = `<div class="error-msg">Error loading group trips.</div>`;
  }
}

async function proposeGroupTrip() {
  const title = document.getElementById("trip-title").value.trim();
  const date = document.getElementById("trip-date").value;
  const endDate = document.getElementById("trip-end-date").value || date;
  const description = document.getElementById("trip-desc").value.trim();

  if (!title || !date || !description) {
    showToast("Please fill all fields to propose a trip", "error");
    return;
  }

  if (new Date(endDate) < new Date(date)) {
    showToast("End date cannot be before start date", "error");
    return;
  }

  const btn = document.getElementById("propose-trip-btn");
  btn.textContent = "Proposing...";
  btn.disabled = true;

  try {
    const trip = {
      title,
      date,
      endDate,
      description,
      createdBy: State.currentUser ? State.currentUser.uid : "auto",
      createdByName: State.caregiverProfile ? State.caregiverProfile.name : "Companion",
      status: "active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const tripRef = await db.collection(COLLECTIONS.GROUP_TRIPS).add(trip);

    // Block the caregiver's schedule for the duration of the trip
    let currentDate = new Date(date);
    let stopDate = new Date(endDate);
    
    // Safety check against infinite loops
    if (currentDate <= stopDate) {
      const batch = db.batch();
      while (currentDate <= stopDate) {
        let isoDate = currentDate.toISOString().split('T')[0];
        const newBlockRef = db.collection(COLLECTIONS.BLOCKED).doc();
        batch.set(newBlockRef, {
          caregiverId: State.currentUser.uid,
          date: isoDate,
          time: "All Day",
          reason: `Group Yatra: ${title}`,
          tripId: tripRef.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      await batch.commit();
    }
    showToast("Upcoming Group Yatra proposed & schedule blocked! 🎉", "success");
    
    document.getElementById("trip-title").value = "";
    document.getElementById("trip-date").value = "";
    document.getElementById("trip-end-date").value = "";
    document.getElementById("trip-desc").value = "";
    
    await loadGroupTrips();
    await loadPublicGroupTrips();
  } catch (e) {
    console.error("proposeGroupTrip error:", e);
    showToast("Failed to propose group trip", "error");
  } finally {
    btn.textContent = "🛫 Propose Group Yatra";
    btn.disabled = false;
  }
}

async function deleteGroupTrip(tripId) {
  if (!confirm("Are you sure you want to delete this proposed group trip?")) return;
  try {
    await db.collection(COLLECTIONS.GROUP_TRIPS).doc(tripId).delete();
    
    const interestsSnap = await db.collection(COLLECTIONS.TRIP_INTERESTS).where("tripId", "==", tripId).get();
    const blocksSnap = await db.collection(COLLECTIONS.BLOCKED).where("tripId", "==", tripId).get();
    
    const batch = db.batch();
    interestsSnap.docs.forEach(doc => batch.delete(doc.ref));
    blocksSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    showToast("Trip deleted", "success");
    await loadGroupTrips();
    await loadPublicGroupTrips();
  } catch (e) {
    showToast("Failed to delete trip", "error");
  }
}

async function loadTripInterests(tripId, tripTitle) {
  const container = document.getElementById("trip-interests-details");
  if (!container) return;
  container.style.display = "block";
  container.innerHTML = `<div class="loading-spinner">Loading interest list…</div>`;
  
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const snap = await db.collection(COLLECTIONS.TRIP_INTERESTS).where("tripId", "==", tripId).get();
    const interests = snap.docs.map(d => d.data());

    let html = `
      <div style="background:var(--white); border:1.5px solid var(--border); border-radius:var(--radius-lg); padding:24px; margin-bottom:28px; box-shadow:var(--shadow);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1.5px solid var(--border); padding-bottom:12px;">
          <h4 style="font-family:var(--font-serif); font-size:18px; color:var(--text);">Signups for: <span style="color:var(--teal-dark)">${escHtml(tripTitle)}</span></h4>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('trip-interests-details').style.display='none'" style="padding:4px 10px;">Close ✗</button>
        </div>
    `;

    if (interests.length === 0) {
      html += `<div class="empty-state" style="padding:16px;">Nobody has registered interest yet.</div>`;
    } else {
      html += `
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${interests.map((int, idx) => `
            <div style="background:var(--warm); border-radius:10px; padding:16px; border:1px solid var(--border)">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-weight:700; color:var(--text); font-size:16px;">${escHtml(int.name)}</div>
                <div class="status-badge status-confirmed">👪 Joining: ${int.passengersCount || 1} people</div>
              </div>
              <div style="font-size:14px; margin-top:6px; font-weight:600; color:var(--teal)">📞 Phone: <a href="tel:${int.phone}" style="text-decoration:none;">${escHtml(int.phone)}</a></div>
              ${int.notes ? `<div style="font-size:13px; margin-top:8px; background:white; padding:8px 12px; border-radius:6px; border:1.5px dashed var(--border); color:var(--text2);"><strong style="color:var(--orange-dark)">Preferences/Notes:</strong> ${escHtml(int.notes)}</div>` : ""}
            </div>
          `).join("")}
        </div>
      `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
  } catch (e) {
    console.error("loadTripInterests error:", e);
    container.innerHTML = `<div class="error-msg">Error loading interest details.</div>`;
  }
}

async function loadPublicGroupTrips() {
  const container = document.getElementById("public-group-trips-container");
  if (!container) return;
  
  const today = todayStr();

  try {
    const snap = await db.collection(COLLECTIONS.GROUP_TRIPS)
      .where("date", ">=", today)
      .get();
      
    const trips = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.status === "active")
      .sort((a,b) => a.date.localeCompare(b.date));
    
    if (trips.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; background:var(--white); border:1.5px solid var(--border); border-radius:var(--radius-lg); padding:32px; text-align:center; color:var(--text2);">
          👵 Currently, no upcoming trips are scheduled. Check back soon — Team Accompany will publish new yatras soon!
        </div>
      `;
      return;
    }

    container.innerHTML = trips.map(t => `
      <div class="service-card" style="text-align:left; cursor:default; padding:24px; display:flex; flex-direction:column; justify-content:space-between; height:100%; border-color:var(--teal); background:linear-gradient(145deg, #ffffff, #F4FBFB); box-shadow:var(--shadow);">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="background:var(--teal-light); color:var(--teal-dark); font-weight:700; font-size:12px; padding:4px 12px; border-radius:100px;">🙏 Accompany Yatra</div>
            <div style="font-size:13px; color:var(--text3); font-weight:600;">📅 ${formatDate(t.date)}${t.endDate && t.endDate !== t.date ? ' - ' + formatDate(t.endDate) : ''}</div>
          </div>
          <h4 style="font-family:var(--font-serif); font-size:18px; color:var(--text); font-weight:600; margin-bottom:8px;">${escHtml(t.title)}</h4>
          <p style="font-size:13px; color:var(--text2); line-height:1.5; margin-bottom:14px; min-height:60px;">${escHtml(t.description)}</p>
        </div>
          <div style="border-top:1px solid var(--border); padding-top:14px; display:flex; justify-content:flex-end; align-items:center; flex-wrap:wrap; gap:8px;">
          <button class="btn btn-teal btn-sm" onclick="window.open('https://wa.me/917339339323?text=Hello, I am interested in registering for the Upcoming Yatra: ' + encodeURIComponent('${t.title.replace(/'/g, "\\'")}'), '_blank')">Register Interest</button>
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error("loadPublicGroupTrips error:", e);
    container.innerHTML = `<div class="error-msg" style="grid-column: 1 / -1;">Upcoming group trips failed to load.</div>`;
  }
}

function openInterestModal(tripId, tripTitle) {
  State.activeTripId = tripId;
  const modal = document.getElementById("interest-modal");
  const titleEl = document.getElementById("interest-trip-title");
  
  if (modal && titleEl) {
    titleEl.textContent = tripTitle;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
}

function closeInterestModal() {
  const modal = document.getElementById("interest-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
    document.getElementById("interest-name").value = "";
    document.getElementById("interest-phone").value = "";
    document.getElementById("interest-passengers").value = "1";
    document.getElementById("interest-notes").value = "";
  }
}

async function submitTripInterest() {
  const tripId = State.activeTripId;
  const name = document.getElementById("interest-name").value.trim();
  const phone = document.getElementById("interest-phone").value.trim();
  const passengersCount = parseInt(document.getElementById("interest-passengers").value) || 1;
  const notes = document.getElementById("interest-notes").value.trim();

  if (!tripId || !name || !phone) {
    showToast("Your Name and Phone Number are required to register interest", "error");
    return;
  }

  const btn = document.getElementById("interest-submit-btn");
  btn.textContent = "Submitting...";
  btn.disabled = true;

  try {
    await db.collection(COLLECTIONS.TRIP_INTERESTS).add({
      tripId,
      name,
      phone,
      passengersCount,
      notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Interest registered successfully! We will coordinate with you. ✓", "success");
    closeInterestModal();
    await loadPublicGroupTrips();
  } catch (e) {
    console.error("submitTripInterest error:", e);
    showToast("Failed to register interest", "error");
  } finally {
    btn.textContent = "Confirm & Register Interest ✓";
    btn.disabled = false;
  }
}

// ── EXPOSE TO WINDOW ───────────────────────────
const GlobalActions = {
  showScreen, showToast, doLogin, doLogout, sendOTP, verifyOTP, resendOTP, skipOTPAndBook,
  toggleService, selectCaregiver: (id) => loadCaregivers(), selectSlot, onDurationChange,
  setBooker, goStep, confirmBooking, loadCaregivers, updateBookingStatus,
  triggerUpload, handleMediaUpload, submitApplication, loadOwnerDashboard, approveApplication, rejectApplication,
  setDashTab, setOwnerTab, scrollToHow, loadPublicGallery, doChangePassword,
  
  // Group Yatras
  loadGroupTrips, proposeGroupTrip, deleteGroupTrip, loadTripInterests, loadPublicGroupTrips,
  openInterestModal, closeInterestModal, submitTripInterest,

  // Hamburger Drawer
  openDrawer, closeDrawer, toggleDrawerGroup, navigateDrawer
};
for (const [k, v] of Object.entries(GlobalActions)) window[k] = v;

document.addEventListener("DOMContentLoaded", () => {
  loadPublicGallery();
  loadPublicGroupTrips();
  loadPublicFeedback();
  console.log("Saathi Unified App v3 Loaded");
});