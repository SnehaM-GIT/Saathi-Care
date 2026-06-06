const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteTestReviews() {
  const snap = await db.collection("public_feedback").get();
  let deleted = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const name = (data.name || data.from || "").toLowerCase();
    const text = (data.text || data.content || "").toLowerCase();
    // Delete if name contains "sneha" or text contains "test"
    if (name.includes("sneha") || text.includes("test review") || text.includes("testing")) {
      console.log(`Deleting: [${doc.id}] name="${data.name || data.from}" text="${(data.text || data.content || "").slice(0,60)}"`);
      await doc.ref.delete();
      deleted++;
    }
  }
  console.log(`\nDone. Deleted ${deleted} review(s).`);
  process.exit(0);
}

deleteTestReviews().catch(e => { console.error(e); process.exit(1); });
