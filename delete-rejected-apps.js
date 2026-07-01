const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteRejected() {
  const snap = await db.collection("applications").where("status", "==", "rejected").get();
  
  let count = 0;
  for (const doc of snap.docs) {
    await doc.ref.delete();
    count++;
    console.log(`Deleted ${doc.id} (${doc.data().name})`);
  }
  
  console.log(`Done. Deleted ${count} rejected applications.`);
  process.exit(0);
}

deleteRejected().catch(e => { console.error(e); process.exit(1); });
