# 🙏 Saathi Care — Deployment Guide

A complete companion care platform for elderly parents.  
**Tech stack:** HTML/CSS/JS (no framework) · Firebase Auth · Firestore · Firebase Storage · Firebase Hosting  
**Cost:** $0 — Firebase Spark (free) plan is more than sufficient for this app.

---

## Firebase Free Plan Limits (Spark Plan)

| Feature | Free Limit | Saathi Usage |
|---|---|---|
| Authentication | Unlimited users | ✅ Plenty |
| Firestore reads | 50,000 / day | ✅ Fine for hundreds of users |
| Firestore writes | 20,000 / day | ✅ Fine |
| Firestore storage | 1 GB | ✅ Fine |
| Firebase Storage | 5 GB | ✅ Photos |
| Firebase Hosting | 10 GB / month | ✅ Fine |
| Custom domain | Free | ✅ |

---

## Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it `saathi-care` (or anything you like)
4. Disable Google Analytics (not needed) → **Create project**

---

## Step 2 — Enable Firebase Services

### A. Authentication
1. In Firebase Console → **Authentication** → **Get started**
2. Click **Email/Password** → Enable → **Save**

### B. Firestore Database
1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **"Start in production mode"** (we'll add rules next)
3. Choose region: **asia-south1 (Mumbai)** for India
4. Click **Enable**

### C. Firebase Storage
1. Firebase Console → **Storage** → **Get started**
2. Accept defaults → choose same region → **Done**

---

## Step 3 — Add Firestore Security Rules

1. Firebase Console → **Firestore** → **Rules** tab
2. Replace all content with the contents of `firestore.rules`
3. Click **Publish**

---

## Step 4 — Add Storage Security Rules

1. Firebase Console → **Storage** → **Rules** tab
2. Replace content with the contents of `storage.rules`
3. Click **Publish**

---

## Step 5 — Get Your Firebase Config

1. Firebase Console → **Project Settings** (gear icon) → **General**
2. Scroll to **"Your apps"** → Click **"</>"** (Web app)
3. Register the app with any name (e.g. `saathi-web`)
4. Copy the `firebaseConfig` object shown — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "saathi-care.firebaseapp.com",
  projectId: "saathi-care",
  storageBucket: "saathi-care.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abcdef"
};
```

5. Open `public/js/firebase-config.js`
6. Replace the placeholder values with your real config values

---

## Step 6 — Create Caregiver Accounts

This only needs to be done once to set up the initial caregivers.

```bash
# In the project root (saathi/ folder)
npm install firebase-admin

# Download your service account key:
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# Save as: saathi/serviceAccountKey.json

# Edit seed-caregivers.js — change names, emails, passwords!
# Then run:
node seed-caregivers.js
```

After this, caregivers can log in at your website with their email and password.  
**Keep serviceAccountKey.json private — never commit it to git.**

---

## Step 7 — Deploy to Firebase Hosting

```bash
# Install Firebase CLI (one time)
npm install -g firebase-tools

# Log in
firebase login

# In your project folder
cd saathi

# Initialize (if first time)
firebase init hosting
# Choose: Use existing project → saathi-care
# Public directory: public
# Single-page app: Yes
# Don't overwrite index.html

# Deploy!
firebase deploy

# Your site will be live at:
# https://saathi-care.web.app  (or your project ID)
```

---

## Step 8 — Custom Domain (Optional, Free)

1. Firebase Console → **Hosting** → **Add custom domain**
2. Enter `saathicare.in` (or your domain)
3. Follow DNS setup instructions (add TXT + A records at your domain registrar)
4. Firebase provides free SSL automatically

---

## Adding New Caregivers Later

Option 1 — Add to `seed-caregivers.js` and run it again.

Option 2 — Firebase Console → Authentication → Add user manually,  
then add a Firestore document manually under `caregivers/{uid}` with fields:

```json
{
  "name": "New Saathi Name",
  "email": "new@saathicare.in",
  "phone": "+91 9876500000",
  "bio": "Short bio here",
  "since": "2025",
  "rating": "5.0",
  "avatarBg": "#E8F5E9",
  "avatarColor": "#2E7D32",
  "active": true
}
```

---

## Firestore Data Structure

```
caregivers/
  {uid}/
    name, email, phone, bio, since, rating, avatarBg, avatarColor, active

bookings/
  {auto-id}/
    services[]         — ["Temple Visit", "Hospital Visit"]
    caregiverId        — uid of assigned caregiver
    caregiverName      — name string
    slot/
      date             — "2025-05-20"
      time             — "11:00 AM"
    elder/
      name, phone, age, address, notes, bookerType
    status             — "pending" | "confirmed" | "done" | "cancelled"
    createdAt, updatedAt

blocked_slots/
  {auto-id}/
    caregiverId, date, time, reason, createdAt

media/
  {auto-id}/
    caregiverId, caregiverName, url, fileName, caption, type, createdAt
```

---

## Testing on Mobile

After deploying, simply open `https://your-project.web.app` on your phone browser.  
The site is fully responsive and works on all screen sizes.  
For a native app feel, users can **"Add to Home Screen"** from their browser.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Caregivers not loading | Check Firestore rules are published; check `active: true` in docs |
| Login fails | Verify email/password match what was created in seed script |
| Photos not uploading | Check Storage rules are published; check file is < 5MB |
| Bookings not saving | Check Firestore rules; check browser console for errors |
| Site not loading | Run `firebase deploy` again; check `public/js/firebase-config.js` has real values |

---

*Built with love for elders everywhere. 🙏*
