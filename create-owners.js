// ============================================================
//  SAATHI CARE — Create Owner Accounts Script
//  Run ONCE to create both owner Firebase Auth accounts.
//  Usage: node create-owners.js
// ============================================================

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const owners = [
  { name: "Accompany Owner 1", email: "accompanysakha@gmail.com", password: "Owner1@" },
  { name: "Accompany Owner 2", email: "accompanysakhi@gmail.com", password: "Owner2@" }
];

async function createOwners() {
  console.log("\n🔐 Creating Owner Accounts in Firebase...\n");

  for (const owner of owners) {
    try {
      // Try to get existing user first
      const existing = await admin.auth().getUserByEmail(owner.email);
      // If exists, update password
      await admin.auth().updateUser(existing.uid, { password: owner.password, displayName: owner.name });
      console.log(`✅ [UPDATED] ${owner.name} (${owner.email}) — password set/reset`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Create fresh account
        const user = await admin.auth().createUser({
          email        : owner.email,
          password     : owner.password,
          displayName  : owner.name,
          emailVerified: true
        });
        console.log(`✅ [CREATED] ${owner.name} (${owner.email}) — uid: ${user.uid}`);
      } else {
        console.error(`❌ Error for ${owner.email}:`, err.message);
      }
    }
  }

  console.log("\n🎉 Done! Both owner accounts are ready.");
  console.log("   Owner 1: accompanysakha@gmail.com  |  Password: Owner1@");
  console.log("   Owner 2: accompanysakhi@gmail.com  |  Password: Owner2@\n");
  process.exit(0);
}

createOwners();
