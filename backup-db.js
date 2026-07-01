const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COLLECTIONS = [
  "caregivers",
  "bookings",
  "media",
  "blocked_slots",
  "group_trips",
  "trip_interests",
  "public_feedback",
  "trip_reports",
  "blogs",
  "banners",
  "applications"
];

async function backup() {
  const backupDir = path.join(__dirname, "db_backup");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  console.log("Starting full database backup...");

  let totalDocs = 0;

  for (const collectionName of COLLECTIONS) {
    console.log(`Fetching collection: ${collectionName}...`);
    try {
      const snap = await db.collection(collectionName).get();
      const docs = [];
      snap.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() });
      });

      const filePath = path.join(backupDir, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
      
      console.log(`Saved ${docs.length} documents from ${collectionName} to ${filePath}`);
      totalDocs += docs.length;
    } catch (error) {
      console.error(`Error backing up collection ${collectionName}:`, error);
    }
  }

  console.log(`\nBackup complete! Backed up a total of ${totalDocs} documents across ${COLLECTIONS.length} collections.`);
  process.exit(0);
}

backup().catch(e => {
  console.error(e);
  process.exit(1);
});
