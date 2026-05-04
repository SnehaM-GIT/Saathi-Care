// ============================================================
//  SAATHI CARE — Firebase Cloud Functions
//  Handles: Caregiver application approval (account creation), email notifications
// ============================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
admin.initializeApp();

// Configure your email transport (use Gmail or any SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // Set in functions/.env (never commit!)
    pass: process.env.EMAIL_PASS   // Set in functions/.env (never commit!)
  }
});

const OWNER_EMAILS = [
  'snehatest29@gmail.com',
  'owner2@saathicare.in'
];

// Trigger: On application approval, create caregiver user and send email
exports.onApplicationApproved = functions.firestore
  .document('applications/{appId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== 'approved' && after.status === 'approved') {
      // Create caregiver user if not exists
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(after.email);
      } catch (e) {
        // User does not exist, create
        userRecord = await admin.auth().createUser({
          email: after.email,
          emailVerified: false,
          password: Math.random().toString(36).slice(-8), // temp password
          displayName: after.name
        });
      }
      // Add to caregivers collection
      await admin.firestore().collection('caregivers').doc(userRecord.uid).set({
        name: after.name,
        email: after.email,
        phone: after.phone,
        area: after.area,
        langs: after.langs,
        bio: after.bio,
        active: true,
        since: new Date().getFullYear(),
        rating: 5.0
      });
      // Send email to applicant
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'YOUR_GMAIL@gmail.com',
        to: after.email,
        subject: 'Your Saathi Care Application is Approved!',
        text: `Hi ${after.name},\n\nYour application has been approved! You can now log in as a caregiver.\n\nThanks,\nSaathi Care Team`
      });
      // Send notification to owner
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'YOUR_GMAIL@gmail.com',
        to: OWNER_EMAILS.join(','),
        subject: 'A Caregiver Application was Approved',
        text: `Application for ${after.name} (${after.email}) was approved and account created.`
      });
    }
    return null;
  });

// Trigger: On new application, notify owner
exports.onNewApplication = functions.firestore
  .document('applications/{appId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'YOUR_GMAIL@gmail.com',
      to: OWNER_EMAILS.join(','),
      subject: 'New Saathi Caregiver Application',
      text: `New application received:\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nArea: ${data.area}\nLangs: ${data.langs}\nBio: ${data.bio}`
    });
    return null;
  });
