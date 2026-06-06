// ============================================================
//  SAATHI CARE — Caregiver Seed Script
//
//  Run this ONCE from your computer using Node.js to create
//  caregiver accounts in Firebase Auth + Firestore.
//
//  Prerequisites:
//    npm install firebase-admin
//    Download your service account key from:
//      Firebase Console → Project Settings → Service Accounts
//      → Generate new private key → save as serviceAccountKey.json
//
//  Usage:
//    node seed-caregivers.js
// ============================================================

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db   = admin.firestore();

// ── Define your caregivers here ──────────────────────────────
// Change names, emails, passwords before running!
const caregivers = [
  {
    name       : "Saathi Owner",
    email      : "accompanysakha@gmail.com",
    password   : "Owner1@",   // Default owner1 password
    phone      : "+91 90000 00000",
    bio        : "Platform Owner & Administrator",
    since      : "2025",
    rating     : "5.0",
    avatarBg   : "#FFF3E0",
    avatarColor: "#E8722A",
    active     : true
  },
  {
    name       : "Priya Nair",
    email      : "priya@saathicare.in",
    password   : "Saathi@2025!",
    phone      : "+91 98765 00001",
    bio        : "I love spending time with elders. I speak Kannada, Tamil, and Hindi.",
    since      : "2023",
    rating     : "4.9",
    avatarBg   : "#FBE9D9",
    avatarColor: "#E8722A",
    active     : true
  },
  {
    name       : "Arjun Sharma",
    email      : "arjun@saathicare.in",
    password   : "Saathi@2025!",
    phone      : "+91 98765 00002",
    bio        : "Patient, caring, and always on time. Happy to help with hospital visits and errands.",
    since      : "2024",
    rating     : "4.8",
    avatarBg   : "#E0F0F0",
    avatarColor: "#2A7F7F",
    active     : true
  },
  {
    name       : "Meera Krishnan",
    email      : "meera@saathicare.in",
    password   : "Saathi@2025!",
    phone      : "+91 98765 00003",
    bio        : "Retired teacher with a warm heart. Loves conversations, bhajans, and temple visits.",
    since      : "2023",
    rating     : "5.0",
    avatarBg   : "#F3E5F5",
    avatarColor: "#8E44AD",
    active     : true
  }
];

async function seed() {
  console.log("🌱 Starting caregiver seed...\n");

  for (const cg of caregivers) {
    try {
      // Create Auth account
      const userRecord = await auth.createUser({
        email      : cg.email,
        password   : cg.password,
        displayName: cg.name,
        phoneNumber: cg.phone.replace(/\s/g, "")
      });

      console.log(`✅ Auth account created/verified: ${cg.name} (${userRecord.uid})`);

      // ALWAYS Create/Update Firestore profile to ensure 'active: true' and other fields are correct
      const { password, ...profileData } = cg;
      await db.collection("caregivers").doc(userRecord.uid).set({
        ...profileData,
        uid      : userRecord.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`   📄 Firestore profile updated for ${cg.name}\n`);

    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        // If user exists, update their password and sync Firestore
        const userRecord = await auth.getUserByEmail(cg.email);
        await auth.updateUser(userRecord.uid, {
          password: cg.password
        });
        
        const { password, ...profileData } = cg;
        await db.collection("caregivers").doc(userRecord.uid).set({
          ...profileData,
          uid      : userRecord.uid,
        }, { merge: true });
        console.log(`⚠️  ${cg.name} already exists — Password updated & Firestore profile synced.\n`);
      } else {
        console.error(`❌ Error creating ${cg.name}:`, err.message, "\n");
      }
    }
  }

  console.log("✅ Seed complete! Caregivers can now log in.");
  process.exit(0);
}

seed();
