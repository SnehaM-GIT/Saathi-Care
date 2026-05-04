// ============================================================
//  SAATHI CARE — Firebase Configuration
//  Replace these values with your own Firebase project config.
//  Get them from: Firebase Console → Project Settings → Your Apps
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

// Expose global db handles used throughout the app
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ── Firestore collection helpers ──────────────────────────
const COLLECTIONS = {
  CAREGIVERS: "caregivers",   // caregiver profiles + timetables
  BOOKINGS: "bookings",     // all bookings made by families/elders
  MEDIA: "media",        // gallery posts by caregivers
  BLOCKED: "blocked_slots" // slots blocked by caregivers
};

export { auth, db, storage, COLLECTIONS };