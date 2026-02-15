const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp({ databaseURL: 'https://maa-bhawani-catering-default-rtdb.firebaseio.com/' });
const db = admin.database();
const firestore = admin.firestore();

const MANAGER_EMAILS = new Set(['maabhawani2026@gmail.com']);

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

exports.dispatchAssignmentPush = functions.database
  .ref('/artifacts/{appId}/public/data/pushQueue/{pushId}')
  .onCreate(async (snapshot, context) => {
    const queue = snapshot.val() || {};
    const appId = context.params.appId;
    const pushId = context.params.pushId;

    const queueRef = db.ref(`/artifacts/${appId}/public/data/pushQueue/${pushId}`);

    try {
      const tokensSnap = await db.ref(`/artifacts/${appId}/public/data/fcmTokens`).once('value');
      const tokens = [];

      tokensSnap.forEach((child) => {
        const row = child.val() || {};
        if (!row.isActive || !row.token) return;

        const sameStaff = queue.staffId && row.staffId && String(queue.staffId) === String(row.staffId);
        const samePhone = queue.phone && row.phone && String(queue.phone) === String(row.phone);
        if (sameStaff || samePhone) {
          tokens.push({ id: child.key, token: row.token });
        }
      });

      if (tokens.length === 0) {
        await queueRef.update({
          status: 'failed',
          updatedAt: Date.now(),
          failedReason: 'No active FCM token for this staff/phone'
        });

        if (queue.notificationId) {
          await db.ref(`/artifacts/${appId}/public/data/notifications/${queue.notificationId}`).update({
            status: 'failed',
            updatedAt: Date.now(),
            failedReason: 'No active FCM token for this staff/phone'
          });
        }
        return;
      }

      const message = {
        notification: {
          title: queue.title || 'New Shift Assignment',
          body: queue.message || 'You have a new assignment.'
        },
        data: {
          bookingId: String(queue.bookingId || ''),
          eventType: String(queue?.eventDetails?.eventType || ''),
          eventDate: String(queue?.eventDetails?.eventDate || ''),
          eventTime: String(queue?.eventDetails?.eventTime || ''),
          eventShift: String(queue?.eventDetails?.eventShift || ''),
          location: String(queue?.eventDetails?.location || ''),
          managerContact: String(queue?.eventDetails?.managerContact || ''),
          role: String(queue?.eventDetails?.role || ''),
          url: '/'
        },
        tokens: tokens.map((t) => t.token)
      };

      const result = await admin.messaging().sendEachForMulticast(message);
      const invalidTokenRows = [];

      result.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
            invalidTokenRows.push(tokens[idx].id);
          }
        }
      });

      if (invalidTokenRows.length > 0) {
        await Promise.all(invalidTokenRows.map((id) => db.ref(`/artifacts/${appId}/public/data/fcmTokens/${id}`).update({ isActive: false, updatedAt: Date.now() })));
      }

      const status = result.successCount > 0 ? 'delivered' : 'failed';
      await queueRef.update({
        status,
        successCount: result.successCount,
        failureCount: result.failureCount,
        deliveredAt: result.successCount > 0 ? Date.now() : null,
        updatedAt: Date.now()
      });

      if (queue.notificationId) {
        await db.ref(`/artifacts/${appId}/public/data/notifications/${queue.notificationId}`).update({
          status,
          successCount: result.successCount,
          failureCount: result.failureCount,
          deliveredAt: result.successCount > 0 ? Date.now() : null,
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      await queueRef.update({
        status: 'failed',
        updatedAt: Date.now(),
        failedReason: err.message || 'Unknown function error'
      });

      if (queue.notificationId) {
        await db.ref(`/artifacts/${appId}/public/data/notifications/${queue.notificationId}`).update({
          status: 'failed',
          updatedAt: Date.now(),
          failedReason: err.message || 'Unknown function error'
        });
      }

      throw err;
    }
  });

exports.upsertStaffRoles = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerEmail = normalizeEmail(context.auth.token && context.auth.token.email);
  if (!MANAGER_EMAILS.has(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Only managers can assign staff roles.');
  }

  const uidByEmail = data && data.uidByEmail;
  if (!uidByEmail || typeof uidByEmail !== 'object') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'uidByEmail object is required. Example: { "adarsh.rajurkar@maabhawani.com": "<uid>" }'
    );
  }

  const batch = firestore.batch();
  const claimUpdates = [];
  const missing = [];

  for (const staff of STAFF_DIRECTORY) {
    const email = normalizeEmail(staff.email);
    const uid = String(uidByEmail[email] || staff.uid || '').trim();

    if (!uid) {
      missing.push(email);
      continue;
    }

    const userRef = firestore.collection('users').doc(uid);
    batch.set(
      userRef,
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

    claimUpdates.push(
      admin.auth().setCustomUserClaims(uid, {
        role: 'Staff',
        isContractor: staff.isContractor
      })
    );
  }

  await batch.commit();

  const claimResults = await Promise.allSettled(claimUpdates);
  const claimFailures = claimResults.filter((r) => r.status === 'rejected').length;

  return {
    updatedCount: STAFF_DIRECTORY.length - missing.length,
    missingEmails: missing,
    claimFailures
  };
});


