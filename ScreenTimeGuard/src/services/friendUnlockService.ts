import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import auth from '@react-native-firebase/auth';

/**
 * Friend-unlock flow:
 * 1. User taps "Ask a friend to unlock" -> createUnlockRequest()
 * 2. A Firestore doc is created; a Cloud Function (functions/index.js)
 *    triggers on creation and sends an FCM push to the friend.
 * 3. Friend approves/denies from a notification action or in-app screen
 *    -> respondToUnlockRequest()
 * 4. This device listens for the status change via subscribeToRequest()
 *    and calls ScreenTime.grantTemporaryUnlock() when approved.
 */

export interface UnlockRequest {
  id: string;
  requesterId: string;
  friendId: string;
  packageName: string;
  appLabel: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
  respondedAt: number | null;
}

const REQUESTS_COLLECTION = 'unlockRequests';

export async function createUnlockRequest(
  friendId: string,
  packageName: string,
  appLabel: string
): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error('Must be signed in to request an unlock.');

  const doc = await firestore()
    .collection(REQUESTS_COLLECTION)
    .add({
      requesterId: user.uid,
      requesterName: user.displayName ?? 'Your friend',
      friendId,
      packageName,
      appLabel,
      status: 'pending',
      createdAt: firestore.FieldValue.serverTimestamp(),
      respondedAt: null,
    });

  return doc.id;
}

export async function respondToUnlockRequest(
  requestId: string,
  approve: boolean
): Promise<void> {
  await firestore()
    .collection(REQUESTS_COLLECTION)
    .doc(requestId)
    .update({
      status: approve ? 'approved' : 'denied',
      respondedAt: firestore.FieldValue.serverTimestamp(),
    });
}

/** Live-listens to a single request so the requester's device can react instantly. */
export function subscribeToRequest(
  requestId: string,
  onChange: (request: UnlockRequest) => void
) {
  return firestore()
    .collection(REQUESTS_COLLECTION)
    .doc(requestId)
    .onSnapshot((snap) => {
      if (!snap.exists) return;
      onChange({ id: snap.id, ...(snap.data() as any) });
    });
}

/** Requester's list of friends who can grant unlocks (simple mutual-approval model). */
export async function getFriendsList(userId: string): Promise<{ id: string; name: string }[]> {
  const snap = await firestore()
    .collection('users')
    .doc(userId)
    .collection('friends')
    .get();
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
}

export async function registerPushToken(userId: string) {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!enabled) return;

  const token = await messaging().getToken();
  await firestore().collection('users').doc(userId).set(
    { fcmToken: token },
    { merge: true }
  );
}
