/**
 * migrate-banners-to-vercel.js
 * 
 * Downloads all banner images from Firebase Storage,
 * compresses them to WebP, saves to public/images/banners/,
 * and updates Firestore to use Vercel URLs.
 * 
 * Run: node migrate-banners-to-vercel.js
 */

const admin = require('firebase-admin');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Init Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Your Vercel domain
const VERCEL_BASE_URL = 'https://www.accompanyservices.in';

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'public', 'images', 'banners');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Created directory: public/images/banners/');
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function migrateBanners() {
  console.log('\n🚀 Starting banner migration...\n');

  const snapshot = await db.collection('banners').get();
  if (snapshot.empty) {
    console.log('No banners found in Firestore.');
    return;
  }

  console.log(`Found ${snapshot.size} banners to migrate.\n`);
  const batch = db.batch();
  let migratedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const oldUrl = data.url;

    // Skip if already migrated to Vercel
    if (!oldUrl || oldUrl.includes('accompanyservices.in') || oldUrl.includes('vercel.app')) {
      console.log(`⏭️  Skipping ${doc.id} — already on Vercel`);
      continue;
    }

    const filename = `banner_${doc.id}.webp`;
    const localPath = path.join(OUTPUT_DIR, filename);

    try {
      console.log(`⬇️  Downloading banner: ${doc.id}`);
      const rawBuffer = await downloadFile(oldUrl);

      console.log(`🗜️  Compressing to WebP...`);
      await sharp(rawBuffer)
        .webp({ quality: 82, effort: 5 })
        .toFile(localPath);

      const newUrl = `/images/banners/${filename}`;
      batch.update(doc.ref, { url: newUrl });
      migratedCount++;

      const stats = fs.statSync(localPath);
      console.log(`✅ Done: ${filename} (${(stats.size / 1024).toFixed(1)} KB)\n`);

    } catch (err) {
      console.error(`❌ Failed to migrate ${doc.id}:`, err.message, '\n');
    }
  }

  if (migratedCount > 0) {
    console.log(`💾 Updating ${migratedCount} Firestore documents...`);
    await batch.commit();
    console.log('✅ Firestore updated successfully!\n');
  }

  console.log(`\n🎉 Migration complete! ${migratedCount} banners moved to Vercel.`);
  console.log('📌 Next step: run  git add . && git commit && git push && npx vercel --prod\n');
  process.exit(0);
}

migrateBanners().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
