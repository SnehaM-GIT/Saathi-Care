const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrateRavishankarMama() {
  // Check if already exists
  const snap = await db.collection("public_feedback")
    .where("from", "==", "Ravishankar Mama").limit(1).get();

  if (!snap.empty) {
    console.log("Ravishankar Mama testimonial already exists in Firestore. Skipping.");
    process.exit(0);
  }

  await db.collection("public_feedback").add({
    from: "Ravishankar Mama",
    name: "Ravishankar Mama",
    content: "Mantralayam is a pilgrim town in Kurnool district, Andhra Pradesh, situated on the banks of Tungabhadra River, also bordering with Karnataka State.  Mantralayam is built around the Jeeva Samadhi of Saint Sri Ragavendra Swamy (17th Century).  We had an opportunity to visit the pilgrim centre during the New Year of 2022 (Jan 1st Week) along with our family members including our family friend Sri. Venkataraghavan.  My visit was a long due after my providential blessings of Sri Ragavendra to cure my illness.  It was made possible by Sr. Venkat through a meticulous travel plan that covered a few other places around Mantralayam.  He had booked train tickets, accommodation, and local transport for the trip lasting 3 to 4 days.  We had a nice dharshan of Sri Ragavendra, Panchamuka Anjaneyar, and a Shakti Peeth.  Thanks to Sri Venkat for organizing it nicely.  We wish all the very best to you and Sow. Suhasini to conduct many such tours of pilgrimage for Senior Citizens and others in a personalized and a professional way.",
    images: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log("✅ Ravishankar Mama testimonial saved to Firestore successfully!");
  process.exit(0);
}

migrateRavishankarMama().catch(e => { console.error(e); process.exit(1); });
