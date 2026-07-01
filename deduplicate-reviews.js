const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deduplicateReviews() {
  // Fetch all docs (no composite index needed)
  const snap = await db.collection("public_feedback").orderBy("createdAt", "asc").get();

  // Group by text content — keep the first (oldest), delete the rest
  const seenTexts = new Map(); // text -> docId
  let deleted = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    // Only deduplicate homeOnly reviews
    if (data.homeOnly !== true) continue;
    const text = (data.content || data.text || "").trim();

    if (!text) continue;

    if (seenTexts.has(text)) {
      console.log(`Deleting duplicate [${doc.id}] from "${data.name || data.from}" — "${text.slice(0, 60)}..."`);
      await doc.ref.delete();
      deleted++;
    } else {
      seenTexts.set(text, doc.id);
      console.log(`Keeping [${doc.id}] from "${data.name || data.from}" — "${text.slice(0, 60)}..."`);
    }
  }

  console.log(`\nDone. Deleted ${deleted} duplicate review(s). Kept ${seenTexts.size} unique review(s).`);
  process.exit(0);
}

deduplicateReviews().catch(e => { console.error(e); process.exit(1); });
