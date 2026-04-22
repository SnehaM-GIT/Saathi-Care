// ============================================================
//  SAATHI CARE — Firebase Configuration
//  Replace these values with your own Firebase project config.
//  Get them from: Firebase Console → Project Settings → Your Apps
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose global db handles used throughout the app
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// ── Firestore collection helpers ──────────────────────────
const COLLECTIONS = {
  CAREGIVERS : "caregivers",   // caregiver profiles + timetables
  BOOKINGS   : "bookings",     // all bookings made by families/elders
  MEDIA      : "media",        // gallery posts by caregivers
  BLOCKED    : "blocked_slots" // slots blocked by caregivers
};

export { auth, db, storage, COLLECTIONS };
