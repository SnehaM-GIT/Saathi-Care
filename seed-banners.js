const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function seedBanners() {
  const banners = db.collection("banners");
  
  // Clear existing banners if any for a clean slate
  const snap = await banners.get();
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  console.log("Adding sample banners...");
  
  await banners.add({
    url: "images/lotus.png",
    caption: "Spiritual Yatras & Personalized Temple Visits",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await banners.add({
    url: "images/care.png",
    caption: "Trusted Companions for Health & Leisure",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await banners.add({
    url: "images/hybiscus.png",
    caption: "Ensuring Peace of Mind for Families Far Away",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log("✅ Added 3 sample banners to Firestore. You can now refresh the home page!");
  process.exit(0);
}

seedBanners().catch(console.error);
