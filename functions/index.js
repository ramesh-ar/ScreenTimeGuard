const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Fires whenever a new unlock request is created. Looks up the friend's
 * FCM token and pushes a notification with Approve/Deny actions.
 */
exports.onUnlockRequestCreated = functions.firestore
  .document('unlockRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const friendDoc = await admin
      .firestore()
      .collection('users')
      .doc(request.friendId)
      .get();

    const fcmToken = friendDoc.data()?.fcmToken;
    if (!fcmToken) {
      console.log(`Friend ${request.friendId} has no FCM token registered.`);
      return null;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: `${request.requesterName} wants to unlock ${request.appLabel}`,
        body: 'Tap to review this unlock request.',
      },
      data: {
        type: 'UNLOCK_REQUEST',
        requestId: context.params.requestId,
        packageName: request.packageName,
      },
      android: {
        priority: 'high',
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK', // adjust for RN deep link handling
          channelId: 'unlock_requests',
        },
      },
    };

    await admin.messaging().send(message);
    return null;
  });

/**
 * Optional: auto-expire pending requests older than 30 minutes so friends
 * aren't asked to act on stale requests.
 */
exports.expireStaleRequests = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);
    const stale = await admin
      .firestore()
      .collection('unlockRequests')
      .where('status', '==', 'pending')
      .where('createdAt', '<', cutoff)
      .get();

    const batch = admin.firestore().batch();
    stale.forEach((doc) => batch.update(doc.ref, { status: 'denied' }));
    await batch.commit();
    return null;
  });
