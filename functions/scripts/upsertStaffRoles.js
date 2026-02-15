/* eslint-disable no-console */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

const STAFF_DIRECTORY = [
  { uid: 'mNhVk8AihfgkLAbN0Fn0R7UnDsp1', name: 'Adarsh Rajurkar', email: 'adarsh.rajurkar@maabhawani.com', isContractor: true },
  { uid: 'qCyREVrytYhScQevPyzJuagteJ82', name: 'Prajwal Hawge', email: 'prajwal.hawge@maabhawani.com', isContractor: false },
  { uid: 'C81QWUNpYWa3WKFzf4gnBTJPm8p2', name: 'Nikhil Shende', email: 'nikhil.shende@maabhawani.com', isContractor: false },
  { uid: 'agtz3Bca6ZUgTTryHONtoqS3TB43', name: 'Amit Kavre', email: 'amit.kavre@maabhawani.com', isContractor: false },
  { uid: '7z31mMJIrEbSPIEwTE2fpAPE7793', name: 'Manish Raut', email: 'manish.raut@maabhawani.com', isContractor: false },
  { uid: 'pSbvzbqberVZ60mSzlWzkoHTe233', name: 'Shrawan Salankar', email: 'shrawan.salankar@maabhawani.com', isContractor: false },
  { uid: 'QSPtVGbaqUP7GMMp6MD7jqKuiZ83', name: 'Harsh Chole', email: 'harsh.chole@maabhawani.com', isContractor: false },
  { uid: 'CAg6f2CWovUmm0YbhvU358TCEKf1', name: 'Yash Bhopale', email: 'yash.bhopale@maabhawani.com', isContractor: false },
  { uid: 'ITipwk0usWTsOQ5aXaCw64OZT4E3', name: 'Om Chatarkar', email: 'om.chatarkar@maabhawani.com', isContractor: false },
  { uid: 'npbWnwv020cTFzMfcANn0jFMo032', name: 'Mayur Bhange', email: 'mayur.bhange@maabhawani.com', isContractor: false },
  { uid: '7IaxABBmCXOmPVMz2fsuDN7ZzNG2', name: 'Navnit Wanjari', email: 'navnit.wanjari@maabhawani.com', isContractor: false },
  { uid: 'pfdTSTQiCihFfGKMONCE3DpvXEd2', name: 'Sarthak Mohekar', email: 'sarthak.mohekar@maabhawani.com', isContractor: false },
  { uid: 'mgjtee8WbbVpc6mSnJJj3CV2hzl2', name: 'Himanshu Dhange', email: 'himanshu.dhange@maabhawani.com', isContractor: false },
  { uid: 'LgRiEkoKfTbxEXHyY8IdYy5xiQD2', name: 'Karan Aatram', email: 'karan.aatram@maabhawani.com', isContractor: false },
  { uid: 'VR893mi6zqUK3tSvfg9wy2d7bBc2', name: 'Mayur Aatram', email: 'mayur.aatram@maabhawani.com', isContractor: false }
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function main() {
  const raw = process.argv[2];
  let uidByEmail = {};
  if (raw) {
    try {
      uidByEmail = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON argument: ${err.message}`);
    }
  }

  const batch = firestore.batch();
  let assigned = 0;
  const missing = [];

  for (const staff of STAFF_DIRECTORY) {
    const email = normalizeEmail(staff.email);
    const uid = String(uidByEmail[email] || staff.uid || '').trim();
    if (!uid) {
      missing.push(email);
      continue;
    }

    const ref = firestore.collection('users').doc(uid);
    batch.set(
      ref,
      {
        uid,
        name: staff.name,
        email,
        role: 'Staff',
        isContractor: staff.isContractor,
        isPermanent: !staff.isContractor,
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await admin.auth().setCustomUserClaims(uid, {
      role: 'Staff',
      isContractor: staff.isContractor
    });
    assigned += 1;
  }

  await batch.commit();
  console.log(`Staff role docs upserted: ${assigned}`);
  if (missing.length) {
    console.log(`Missing UID for ${missing.length} email(s):`);
    missing.forEach((email) => console.log(`- ${email}`));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
