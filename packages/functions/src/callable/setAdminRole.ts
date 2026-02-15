import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_EMAILS = ['admin@brickquest.dev'];

export const setAdminRole = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const auth = getAuth();
  const user = await auth.getUser(uid);

  if (!ADMIN_EMAILS.includes(user.email ?? '')) {
    throw new HttpsError('permission-denied', 'Not an authorized admin email');
  }

  await auth.setCustomUserClaims(uid, { admin: true });
  return { success: true };
});
