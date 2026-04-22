// ============================================================
//  SAATHI CARE — Main Application Logic
//  All Firebase reads/writes + UI state management
// ============================================================

import { auth, db, storage, COLLECTIONS } from "./firebase-config.js";

// ─────────────────────────────────────────────
//  APP STATE
// ─────────────────────────────────────────────
const State = {
  currentUser      : null,      // Firebase Auth user
  caregiverProfile : null,      // Firestore caregiver doc
  selectedServices : [],
  selectedCaregiver: null,      // { id, name, avatarColor }
  selectedSlot     : null,      // { date, time }
  bookerType       : "Son / Daughter (abroad)",
  elderDetails     : {},
  currentBookingStep: 1,
  caregivers       : [],        // loaded from Firestore
  blockedSlots     : {},        // { caregiverId: [{ date, time }] }
  bookings         : [],        // dashboard bookings for caregiver
  galleryItems     : [],        // loaded gallery posts
};

// ─────────────────────────────────────────────
//  SCREEN ROUTER
// ─────────────────────────────────────────────
export function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) { el.classList.add("active"); window.scrollTo(0, 0); }
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
export function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast show toast-${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}

// ─────────────────────────────────────────────
//  AUTH — Caregiver Login
// ─────────────────────────────────────────────
export async function doLogin() {
  const email    = document.getElementById("login-id").value.trim();
  const password = document.getElementById("login-pw").value;
  if (!email || !password) { showToast("Please enter credentials", "error"); return; }

  const btn = document.getElementById("login-btn");
  btn.textContent = "Logging in…"; btn.disabled = true;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    State.currentUser = cred.user;
    await loadCaregiverProfile(cred.user.uid);
    showScreen("screen-caregiver-dashboard");
    showToast("Welcome back! 👋", "success");
    await loadDashboardData();
  } catch (err) {
    showToast(authErrorMessage(err.code), "error");
  } finally {
    btn.textContent = "Login to Dashboard"; btn.disabled = false;
  }
}

export function doLogout() {
  auth.signOut().then(() => {
    State.currentUser = null;
    State.caregiverProfile = null;
    showScreen("screen-home");
    showToast("Logged out successfully");
  });
}

// Watch auth state on page load
auth.onAuthStateChanged(async user => {
  if (user) {
    State.currentUser = user;
    await loadCaregiverProfile(user.uid);
    // If the user lands on dashboard directly, load data
    if (document.getElementById("screen-caregiver-dashboard").classList.contains("active")) {
      await loadDashboardData();
    }
  }
});

function authErrorMessage(code) {
  const map = {
    "auth/user-not-found"  : "No account found with that email.",
    "auth/wrong-password"  : "Incorrect password.",
    "auth/invalid-email"   : "Invalid email address.",
    "auth/too-many-requests": "Too many attempts. Try again later."
  };
  return map[code] || "Login failed. Please try again.";
}

// ─────────────────────────────────────────────
//  CAREGIVER PROFILE
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  BOOKING FLOW — Public Side
// ─────────────────────────────────────────────

// Load caregivers for the booking screen
export async function loadCaregivers() {
  const container = document.getElementById("caregiver-grid");
  if (!container) return;
  container.innerHTML = `<div class="loading-spinner">Loading caregivers…</div>`;

  try {
    const snap = await db.collection(COLLECTIONS.CAREGIVERS)
      .where("active", "==", true).get();

    State.caregivers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Load blocked slots for today
    const today = todayStr();
    const blockSnap = await db.collection(COLLECTIONS.BLOCKED)
      .where("date", "==", today).get();

    State.blockedSlots = {};
    blockSnap.docs.forEach(d => {
      const data = d.data();
      if (!State.blockedSlots[data.caregiverId]) State.blockedSlots[data.caregiverId] = [];
      State.blockedSlots[data.caregiverId].push(data.time);
    });

    renderCaregiverCards(container);
  } catch (e) {
    container.innerHTML = `<div class="error-msg">Could not load caregivers. Please refresh.</div>`;
    console.error(e);
  }
}

function renderCaregiverCards(container) {
  if (State.caregivers.length === 0) {
    container.innerHTML = `<div class="empty-state">No caregivers available right now. Please try again later.</div>`;
    return;
  }

  const TIME_SLOTS = ["9:00 AM","11:00 AM","1:00 PM","3:00 PM","5:00 PM","7:00 PM"];
  container.innerHTML = "";

  State.caregivers.forEach(cg => {
    const blocked = State.blockedSlots[cg.id] || [];
    const isAvailableToday = blocked.length < TIME_SLOTS.length;

    const slotsHtml = TIME_SLOTS.map(t => {
      const isBlocked = blocked.includes(t);
      return `<div class="slot ${isBlocked ? "blocked" : ""}" 
        ${!isBlocked ? `onclick="selectSlot(event, this, '${t}', '${cg.id}')"` : ""}
        data-time="${t}">${t}</div>`;
    }).join("");

    const card = document.createElement("div");
    card.className = "caregiver-card";
    card.id = `cg-card-${cg.id}`;
    card.innerHTML = `
      <div class="cv-top">
        <div class="avatar" style="background:${cg.avatarBg||"#E0F0F0"};color:${cg.avatarColor||"#2A7F7F"}">${initials(cg.name)}</div>
        <div>
          <div class="cv-name">${escHtml(cg.name)}</div>
          <div class="cv-role">Saathi since ${cg.since||"2024"} · ⭐ ${cg.rating||"5.0"}</div>
        </div>
      </div>
      <span class="avail-badge ${isAvailableToday ? "avail-yes" : "avail-no"}">
        ${isAvailableToday ? "Available Today" : "Busy Today"}
      </span>
      <div style="font-size:13px;color:var(--text3);margin:8px 0 4px;font-weight:600">Today's Slots</div>
      <div class="slot-grid">${slotsHtml}</div>
      ${cg.bio ? `<div style="font-size:13px;color:var(--text2);margin-top:10px;line-height:1.5">${escHtml(cg.bio)}</div>` : ""}
    `;
    card.addEventListener("click", e => {
      if (!e.target.classList.contains("slot")) selectCaregiver(cg.id, cg.name);
    });
    container.appendChild(card);
  });
}

export function selectCaregiver(id, name) {
  document.querySelectorAll(".caregiver-card").forEach(c => c.classList.remove("selected"));
  const card = document.getElementById(`cg-card-${id}`);
  if (card) card.classList.add("selected");
  State.selectedCaregiver = { id, name };
}

export function selectSlot(e, el, time, caregiverId) {
  e.stopPropagation();
  const card = el.closest(".caregiver-card");
  card.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
  State.selectedSlot = { date: todayStr(), time };
  // Also select this caregiver
  const cg = State.caregivers.find(c => c.id === caregiverId);
  if (cg) selectCaregiver(cg.id, cg.name);
}

export function toggleService(el, name) {
  el.classList.toggle("selected");
  if (el.classList.contains("selected")) {
    if (!State.selectedServices.includes(name)) State.selectedServices.push(name);
  } else {
    State.selectedServices = State.selectedServices.filter(s => s !== name);
  }
  const otherWrap = document.getElementById("other-desc-wrap");
  if (otherWrap) otherWrap.style.display = State.selectedServices.includes("Other") ? "block" : "none";
}

export function setBooker(el, type) {
  document.querySelectorAll(".radio-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  State.bookerType = type;
}

export function goStep(n) {
  if (n === 2 && State.selectedServices.length === 0) {
    showToast("Please select at least one service", "error"); return;
  }
  if (n === 3 && (!State.selectedCaregiver || !State.selectedSlot)) {
    showToast("Please choose a Saathi and a time slot", "error"); return;
  }
  if (n === 4) {
    const name  = document.getElementById("elder-name").value.trim();
    const phone = document.getElementById("elder-phone").value.trim();
    const age   = document.getElementById("elder-age").value.trim();
    const addr  = document.getElementById("elder-address").value.trim();
    if (!name || !phone) { showToast("Name and phone number are required", "error"); return; }

    State.elderDetails = {
      name, phone, age,
      address: addr,
      notes  : document.getElementById("elder-notes").value.trim(),
      bookerType: State.bookerType
    };
    renderBookingSummary();
  }
  State.currentBookingStep = n;
  updateStepUI(n);
}

function updateStepUI(n) {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`booking-step${i}`);
    if (step) step.style.display = i === n ? "block" : "none";
    const num  = document.getElementById(`step${i}-num`);
    const lbl  = document.getElementById(`step${i}-lbl`);
    if (num) num.className = "step-num" + (i === n ? " active" : i < n ? " done" : "");
    if (lbl) lbl.className = "step-label" + (i === n ? " active" : i < n ? " done" : "");
    if (i < 4) {
      const line = document.getElementById(`line${i}`);
      if (line) line.className = "step-line" + (i < n ? " done" : "");
    }
  }
}

function renderBookingSummary() {
  setText("sum-service",   State.selectedServices.join(", ") || "—");
  setText("sum-caregiver", State.selectedCaregiver?.name || "Auto-assigned");
  setText("sum-slot",      State.selectedSlot ? `${State.selectedSlot.time} — ${formatDate(State.selectedSlot.date)}` : "—");
  setText("sum-elder",     State.elderDetails.name);
  setText("sum-phone",     State.elderDetails.phone);
  setText("sum-age",       State.elderDetails.age || "Not provided");
  setText("sum-address",   State.elderDetails.address || "Not provided");
  setText("sum-notes",     State.elderDetails.notes || "None");
  setText("sum-booker",    State.bookerType);
}

export async function confirmBooking() {
  const btn = document.getElementById("confirm-btn");
  btn.textContent = "Confirming…"; btn.disabled = true;

  try {
    // Auto-assign if no caregiver selected
    if (!State.selectedCaregiver) {
      const available = State.caregivers.filter(cg => {
        const blocked = State.blockedSlots[cg.id] || [];
        return blocked.length < 6;
      });
      if (available.length === 0) throw new Error("No caregivers available");
      const pick = available[Math.floor(Math.random() * available.length)];
      State.selectedCaregiver = { id: pick.id, name: pick.name };
    }

    const booking = {
      services      : State.selectedServices,
      caregiverId   : State.selectedCaregiver.id,
      caregiverName : State.selectedCaregiver.name,
      slot          : State.selectedSlot || { date: todayStr(), time: "TBD" },
      elder         : State.elderDetails,
      status        : "pending",
      createdAt     : firebase.firestore.FieldValue.serverTimestamp(),
      otherDesc     : document.getElementById("other-desc")?.value || ""
    };

    const ref = await db.collection(COLLECTIONS.BOOKINGS).add(booking);

    // Show success
    setText("success-caregiver", State.selectedCaregiver.name);
    setText("success-booking-id", ref.id.slice(0, 8).toUpperCase());
    showScreen("screen-success");

    // Reset state
    State.selectedServices  = [];
    State.selectedCaregiver = null;
    State.selectedSlot      = null;
    State.elderDetails      = {};
    State.currentBookingStep = 1;
    document.querySelectorAll(".service-card.selected").forEach(c => c.classList.remove("selected"));
    updateStepUI(1);

  } catch (err) {
    showToast("Booking failed: " + err.message, "error");
  } finally {
    btn.textContent = "Confirm Booking ✓"; btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
//  DASHBOARD — Caregiver Side
// ─────────────────────────────────────────────
export async function loadDashboardData() {
  if (!State.currentUser) return;
  await Promise.all([loadBookings(), loadBlockedSlots(), loadGallery()]);
  renderCalendar();
}

async function loadBookings() {
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS)
      .where("caregiverId", "==", State.currentUser.uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    State.bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBookingsList();
    renderDashStats();
  } catch (e) { console.error("Bookings load error:", e); }
}

function renderDashStats() {
  const bookings = State.bookings;
  const today    = todayStr();
  const pending  = bookings.filter(b => b.status === "pending").length;
  const thisWeek = bookings.filter(b => {
    if (!b.slot?.date) return false;
    return isThisWeek(b.slot.date);
  }).length;
  const done = bookings.filter(b => b.status === "done").length;

  setText("stat-new",    pending);
  setText("stat-week",   thisWeek);
  setText("stat-done",   done);
}

function renderBookingsList() {
  const container = document.getElementById("bookings-list");
  if (!container) return;

  if (State.bookings.length === 0) {
    container.innerHTML = `<div class="empty-state">No bookings yet. They'll appear here when families book a visit.</div>`;
    return;
  }

  const statusMap = {
    pending   : { label: "New",       cls: "status-new"       },
    confirmed : { label: "Confirmed", cls: "status-confirmed"  },
    done      : { label: "Completed", cls: "status-done"       },
    cancelled : { label: "Cancelled", cls: "status-cancelled"  }
  };

  const serviceIcons = {
    "Temple Visit"  : "🛕",
    "Outing & Meal" : "🍽️",
    "Hospital Visit": "🏥",
    "Shopping Help" : "🛍️",
    "Companionship" : "💬",
    "Other"         : "✨"
  };

  container.innerHTML = State.bookings.map(b => {
    const st  = statusMap[b.status] || statusMap.pending;
    const svc = b.services?.[0] || "Other";
    const icon = serviceIcons[svc] || "✨";
    const slotDisplay = b.slot ? `${b.slot.time} · ${formatDate(b.slot.date)}` : "TBD";
    const addr = b.elder?.address ? ` · ${escHtml(b.elder.address)}` : "";

    return `
    <div class="request-card" id="req-${b.id}">
      <div class="req-icon">${icon}</div>
      <div class="req-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div class="req-title">${escHtml(b.services?.join(", ") || "Other")}</div>
          <span class="status-badge ${st.cls}">${st.label}</span>
        </div>
        <div class="req-meta">📅 ${slotDisplay}${addr}</div>
        <div class="req-meta"><strong>${escHtml(b.elder?.name || "—")}</strong> · Age ${b.elder?.age || "—"}</div>
        <div class="req-contact">📞 <a href="tel:${escHtml(b.elder?.phone || "")}" style="color:var(--teal);text-decoration:none;font-weight:700">${escHtml(b.elder?.phone || "—")}</a></div>
        ${b.elder?.notes ? `<div style="font-size:13px;color:var(--text2);margin-top:6px;font-style:italic">"${escHtml(b.elder.notes)}"</div>` : ""}
        ${b.otherDesc ? `<div style="font-size:13px;color:var(--text2);margin-top:4px">Request: ${escHtml(b.otherDesc)}</div>` : ""}
        <div class="req-actions" id="actions-${b.id}">
          ${b.status === "pending" ? `
            <button class="btn btn-teal btn-sm" onclick="updateBookingStatus('${b.id}','confirmed')">✓ Accept</button>
            <button class="btn btn-ghost btn-sm" onclick="updateBookingStatus('${b.id}','cancelled')">✗ Decline</button>` : ""}
          ${b.status === "confirmed" ? `
            <button class="btn btn-primary btn-sm" onclick="updateBookingStatus('${b.id}','done')">Mark as Done</button>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}

export async function updateBookingStatus(bookingId, newStatus) {
  try {
    await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Update local state
    const b = State.bookings.find(x => x.id === bookingId);
    if (b) b.status = newStatus;
    renderBookingsList();
    renderDashStats();
    const msgs = { confirmed: "Booking accepted ✓", done: "Marked as completed ✓", cancelled: "Booking declined" };
    showToast(msgs[newStatus] || "Updated", newStatus === "cancelled" ? "error" : "success");
  } catch (e) {
    showToast("Update failed. Try again.", "error");
  }
}

// ─────────────────────────────────────────────
//  CALENDAR & BLOCKED SLOTS
// ─────────────────────────────────────────────
async function loadBlockedSlots() {
  if (!State.currentUser) return;
  try {
    const snap = await db.collection(COLLECTIONS.BLOCKED)
      .where("caregiverId", "==", State.currentUser.uid)
      .get();
    State.myBlockedSlots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("Blocked slots load:", e); }
}

export function renderCalendar(year, month) {
  const now   = new Date();
  year  = year  || now.getFullYear();
  month = month || now.getMonth();

  const calTitle = document.getElementById("cal-month-title");
  if (calTitle) calTitle.textContent = new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const grid = document.getElementById("cal-days-grid");
  if (!grid) return;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  // Collect all dates with activity
  const bookedDates = new Set((State.bookings || [])
    .map(b => b.slot?.date).filter(Boolean));
  const blockedDates = new Set((State.myBlockedSlots || [])
    .map(b => b.date).filter(Boolean));

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday   = isThisMonth && d === today;
    const hasBook   = bookedDates.has(dateStr);
    const isBlocked = blockedDates.has(dateStr);
    const cls = isToday ? "today" : isBlocked ? "blocked" : hasBook ? "has-booking" : "";
    html += `<button class="cal-day ${cls}" onclick="showDayDetail('${dateStr}')">${d}${(hasBook||isBlocked) ? '<div class="day-dot"></div>' : ""}</button>`;
  }
  grid.innerHTML = html;

  // store for prev/next nav
  window._calYear  = year;
  window._calMonth = month;
}

export function calNav(dir) {
  let m = (window._calMonth || new Date().getMonth()) + dir;
  let y = window._calYear  || new Date().getFullYear();
  if (m > 11) { m = 0;  y++; }
  if (m < 0)  { m = 11; y--; }
  renderCalendar(y, m);
}

export function showDayDetail(dateStr) {
  const dayBookings = State.bookings.filter(b => b.slot?.date === dateStr);
  const dayBlocked  = (State.myBlockedSlots || []).filter(b => b.date === dateStr);

  const panel = document.getElementById("day-detail-panel");
  if (!panel) return;

  const friendlyDate = formatDate(dateStr);
  let html = `<div style="font-weight:700;font-size:15px;margin-bottom:12px;color:var(--text)">📅 ${friendlyDate}</div>`;

  if (dayBookings.length > 0) {
    html += `<div style="font-weight:700;font-size:13px;color:var(--text2);margin-bottom:8px">BOOKINGS</div>`;
    dayBookings.forEach(b => {
      html += `<div style="background:var(--orange-light);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px">
        <div style="font-weight:700">${escHtml(b.services?.join(", "))}</div>
        <div style="color:var(--text2)">${b.slot?.time} · ${escHtml(b.elder?.name)}</div>
        <div style="color:var(--teal);font-weight:600">${escHtml(b.elder?.phone)}</div>
      </div>`;
    });
  }

  if (dayBlocked.length > 0) {
    html += `<div style="font-weight:700;font-size:13px;color:var(--text2);margin:10px 0 8px">BLOCKED SLOTS</div>`;
    dayBlocked.forEach(b => {
      html += `<div style="background:#FFEBEE;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;color:var(--red)">${b.time}</div>
          ${b.reason ? `<div style="color:var(--text2)">${escHtml(b.reason)}</div>` : ""}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="unblockSlot('${b.id}')">Unblock</button>
      </div>`;
    });
  }

  if (dayBookings.length === 0 && dayBlocked.length === 0) {
    html += `<div style="color:var(--text3);font-size:14px">No bookings or blocks on this day.</div>`;
  }

  panel.innerHTML = html;
  panel.style.display = "block";
}

export async function blockSlot() {
  if (!State.currentUser) { showToast("Please log in", "error"); return; }
  const date   = document.getElementById("block-date").value;
  const time   = document.getElementById("block-time").value;
  const reason = document.getElementById("block-reason").value.trim();
  if (!date) { showToast("Please select a date", "error"); return; }

  const btn = document.getElementById("block-btn");
  btn.textContent = "Blocking…"; btn.disabled = true;

  try {
    const ref = await db.collection(COLLECTIONS.BLOCKED).add({
      caregiverId: State.currentUser.uid,
      date, time, reason,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (!State.myBlockedSlots) State.myBlockedSlots = [];
    State.myBlockedSlots.push({ id: ref.id, caregiverId: State.currentUser.uid, date, time, reason });
    renderCalendar(window._calYear, window._calMonth);
    showDayDetail(date);
    showToast(`${time} on ${formatDate(date)} blocked ✓`, "success");
    document.getElementById("block-date").value   = "";
    document.getElementById("block-reason").value = "";
  } catch (e) {
    showToast("Failed to block slot. Try again.", "error");
  } finally {
    btn.textContent = "Block This Slot"; btn.disabled = false;
  }
}

export async function unblockSlot(slotId) {
  try {
    await db.collection(COLLECTIONS.BLOCKED).doc(slotId).delete();
    State.myBlockedSlots = State.myBlockedSlots.filter(b => b.id !== slotId);
    renderCalendar(window._calYear, window._calMonth);
    document.getElementById("day-detail-panel").style.display = "none";
    showToast("Slot unblocked ✓", "success");
  } catch (e) {
    showToast("Failed to unblock. Try again.", "error");
  }
}

// ─────────────────────────────────────────────
//  GALLERY
// ─────────────────────────────────────────────
async function loadGallery() {
  try {
    const snap = await db.collection(COLLECTIONS.MEDIA)
      .orderBy("createdAt", "desc").limit(20).get();
    State.galleryItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGallery();
  } catch (e) { console.error("Gallery load error:", e); }
}

function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  const itemsHtml = State.galleryItems.map(item => `
    <div class="media-item">
      ${item.type === "image" && item.url
        ? `<img src="${escHtml(item.url)}" alt="${escHtml(item.caption||"")}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius)">`
        : `<div style="font-size:40px">${item.emoji || "📸"}</div>`}
      <div class="media-overlay">
        <div>
          <div class="media-caption">${escHtml(item.caption || "")}</div>
          ${State.currentUser && item.caregiverId === State.currentUser.uid
            ? `<button class="btn btn-sm" style="margin-top:6px;padding:4px 10px;font-size:11px;background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4)" onclick="deleteMedia('${item.id}')">Delete</button>`
            : ""}
        </div>
      </div>
    </div>`).join("");

  grid.innerHTML = itemsHtml + `
    <div class="upload-btn" onclick="triggerUpload()">
      <div style="font-size:28px">+</div>
      <div>Add Photo</div>
    </div>`;
}

export function triggerUpload() {
  document.getElementById("media-upload-input").click();
}

export async function handleMediaUpload(input) {
  if (!State.currentUser) { showToast("Please log in", "error"); return; }
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Only images supported", "error"); return; }
  if (file.size > 5 * 1024 * 1024) { showToast("Max file size is 5MB", "error"); return; }

  const caption = prompt("Add a caption for this photo (optional):") || "";
  showToast("Uploading photo…");

  try {
    const fileName = `gallery/${State.currentUser.uid}/${Date.now()}_${file.name}`;
    const ref = storage.ref(fileName);
    await ref.put(file);
    const url = await ref.getDownloadURL();

    const docRef = await db.collection(COLLECTIONS.MEDIA).add({
      caregiverId: State.currentUser.uid,
      caregiverName: State.caregiverProfile?.name || "Saathi",
      url, caption,
      type: "image",
      fileName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    State.galleryItems.unshift({ id: docRef.id, caregiverId: State.currentUser.uid, url, caption, type: "image" });
    renderGallery();
    showToast("Photo uploaded ✓", "success");
  } catch (e) {
    showToast("Upload failed. Try again.", "error");
    console.error(e);
  }
  input.value = "";
}

export async function deleteMedia(mediaId) {
  if (!confirm("Delete this photo?")) return;
  try {
    const item = State.galleryItems.find(i => i.id === mediaId);
    if (item?.fileName) {
      await storage.ref(item.fileName).delete().catch(() => {}); // ignore if already gone
    }
    await db.collection(COLLECTIONS.MEDIA).doc(mediaId).delete();
    State.galleryItems = State.galleryItems.filter(i => i.id !== mediaId);
    renderGallery();
    showToast("Photo deleted", "success");
  } catch (e) {
    showToast("Delete failed.", "error");
  }
}

// ─────────────────────────────────────────────
//  DASHBOARD TAB SWITCHER
// ─────────────────────────────────────────────
export function setDashTab(tab) {
  ["requests", "calendar", "gallery"].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === tab ? "block" : "none";
  });
  document.querySelectorAll(".tab").forEach((t, i) => {
    const tabs = ["requests", "calendar", "gallery"];
    t.className = "tab" + (tabs[i] === tab ? " active" : "");
  });
  if (tab === "calendar") renderCalendar();
  if (tab === "gallery")  renderGallery();
}

// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return d >= startOfWeek && d <= endOfWeek;
}

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
}

function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Expose to window for inline onclick handlers in HTML
Object.assign(window, {
  showScreen, showToast, doLogin, doLogout,
  toggleService, selectCaregiver, selectSlot,
  setBooker, goStep, confirmBooking, loadCaregivers,
  updateBookingStatus, blockSlot, unblockSlot,
  setDashTab, renderCalendar, calNav, showDayDetail,
  triggerUpload, handleMediaUpload, deleteMedia,
  scrollToHow: () => document.getElementById("how-it-works")?.scrollIntoView({ behavior:"smooth" })
});
