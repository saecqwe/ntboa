const { logger } = require("firebase-functions");
const https = require("firebase-functions/v1").https;
const firestore = require("firebase-functions/v1").firestore;
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const {
  calculateTier,
  normalizeTier,
  extractAffectedUserIds,
  hasRelevantEvaluationChange,
  computeRefereeRollup,
} = require("./statsHelpers");

initializeApp();

const db = getFirestore();
const auth = getAuth();

exports.createNewUser = https.onCall(async (data, context) => {
  // Security: Require Admin caller
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be authenticated to create a user.');
  }

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new https.HttpsError('permission-denied', 'Only administrators can create new users.');
  }

  const { email, password, displayName, role } = data || {};

  // --- Input Validation ---
  if (!email || !password || !displayName || !role) {
    throw new https.HttpsError('invalid-argument', 'Missing required user data (email, password, displayName, role).');
  }

  const validRoles = ['admin', 'evaluator', 'referee'];
  if (!validRoles.includes(role)) {
    throw new https.HttpsError('invalid-argument', `Invalid role "${role}". Must be one of ${validRoles.join(', ')}.`);
  }

  try {
    logger.info(`Creating user: ${email} with role: ${role}`);
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });
    const uid = userRecord.uid;

    await auth.setCustomUserClaims(uid, { role });

    const createdAt = FieldValue.serverTimestamp();
    const newUserDocument = {
      uid,
      email,
      role,
      displayName,
      status: 'Active',
      photoURL: '',
      createdAt,
    };

    if (role === 'evaluator') {
      newUserDocument.assignedReferees = [];
      newUserDocument.evaluationsMade = 0;
    } else if (role === 'referee') {
      newUserDocument.tier = 'Tier 100';
      newUserDocument.avgScore = 0;
      newUserDocument.evaluations = 0;
      newUserDocument.evaluationsCount = 0;
      newUserDocument.totalScoreSum = 0;
      newUserDocument.suggestedTier = '';
    }

    await db.collection('users').doc(uid).set(newUserDocument);

    logger.info(`Successfully created user ${uid} and their document.`);
    return {
      status: 'success',
      message: `User ${displayName} created successfully with role ${role}.`,
      uid,
    };
  } catch (error) {
    logger.error('Error creating new user:', error);
    if (error.code === 'auth/email-already-exists') {
      throw new https.HttpsError('already-exists', 'A user with this email address already exists.');
    }
    throw new https.HttpsError('internal', 'An unexpected error occurred while creating the user.');
  }
});

exports.suspendUser = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be authenticated to suspend a user.');
  }

  const { uid } = data || {};
  if (!uid || typeof uid !== 'string') {
    throw new https.HttpsError('invalid-argument', 'The function must be called with a valid "uid".');
  }

  if (uid === context.auth.uid) {
    throw new https.HttpsError('failed-precondition', 'You cannot suspend your own account.');
  }

  const [callerDoc, targetDoc] = await Promise.all([
    db.collection('users').doc(context.auth.uid).get(),
    db.collection('users').doc(uid).get(),
  ]);

  const callerRole = callerDoc.exists ? callerDoc.data().role : null;
  if (callerRole !== 'admin' && callerRole !== 'evaluator') {
    throw new https.HttpsError('permission-denied', 'Only administrators or evaluators can suspend users.');
  }

  const targetRole = targetDoc.exists ? targetDoc.data().role : null;
  if (targetRole === 'admin') {
    throw new https.HttpsError('permission-denied', 'Administrator accounts cannot be suspended via this endpoint.');
  }

  if (callerRole === 'evaluator' && targetRole !== 'referee') {
    throw new https.HttpsError('permission-denied', 'Evaluators can only suspend referee accounts.');
  }

  try {
    await auth.deleteUser(uid);
    logger.info(`Successfully deleted user ${uid} from Auth.`);

    await db.collection('users').doc(uid).update({
      status: 'Disabled',
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Successfully marked user document ${uid} as Disabled.`);

    return { success: true, message: 'User suspended successfully.' };
  } catch (error) {
    logger.error('Error suspending user:', error);
    if (error.code === 'auth/user-not-found') {
      logger.warn(`User ${uid} not found in Auth, proceeding to mark Firestore doc as Disabled.`);
      await db.collection('users').doc(uid).set({
        status: 'Disabled',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { success: true, message: 'User was not in Auth, but marked as Disabled in DB.' };
    }
    throw new https.HttpsError('internal', 'Unable to suspend user.');
  }
});

/**
 * Admin-only callable to update a Referee's or Evaluator's login email
 * across both Firebase Authentication and Firestore, with rollback protection
 * and active session revocation.
 */
exports.updateUserEmail = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be authenticated to update user email.');
  }

  const rawUid = data?.uid;
  const rawEmail = data?.newEmail;
  if (typeof rawUid !== 'string' || !rawUid.trim()) {
    throw new https.HttpsError('invalid-argument', 'A valid user "uid" is required.');
  }
  if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
    throw new https.HttpsError('invalid-argument', 'A valid "newEmail" is required.');
  }

  const uid = rawUid.trim();
  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new https.HttpsError('invalid-argument', 'Please provide a valid email address.');
  }

  const [callerDoc, targetDoc] = await Promise.all([
    db.collection('users').doc(context.auth.uid).get(),
    db.collection('users').doc(uid).get(),
  ]);

  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new https.HttpsError('permission-denied', 'Only administrators can update user email addresses.');
  }
  if (!targetDoc.exists) {
    throw new https.HttpsError('not-found', 'User profile not found.');
  }

  const targetData = targetDoc.data();
  if (targetData.role !== 'referee' && targetData.role !== 'evaluator') {
    throw new https.HttpsError('permission-denied', 'Email updates are restricted to referee and evaluator accounts.');
  }
  if (targetData.status === 'Disabled') {
    throw new https.HttpsError('failed-precondition', 'Cannot change email for a disabled account.');
  }

  let authUser;
  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      throw new https.HttpsError('not-found', 'Authentication account not found for this user.');
    }
    logger.error(`Error fetching Auth user ${uid}:`, error);
    throw new https.HttpsError('internal', 'Failed to verify authentication account.');
  }

  const previousAuthEmail = authUser.email || '';
  if (
    previousAuthEmail.toLowerCase() === normalizedEmail &&
    String(targetData.email || '').trim().toLowerCase() === normalizedEmail
  ) {
    return {
      status: 'unchanged',
      email: normalizedEmail,
      message: 'Email is already set to this value.',
    };
  }

  const authNeedsUpdate = previousAuthEmail.toLowerCase() !== normalizedEmail;
  if (authNeedsUpdate) {
    try {
      await auth.updateUser(uid, { email: normalizedEmail });
    } catch (authError) {
      logger.error(`Failed to update Auth email for ${uid}:`, authError);
      if (authError?.code === 'auth/email-already-exists') {
        throw new https.HttpsError('already-exists', 'That email address is already in use by another account.');
      }
      if (authError?.code === 'auth/invalid-email') {
        throw new https.HttpsError('invalid-argument', 'The provided email address is invalid.');
      }
      if (authError?.code === 'auth/user-not-found') {
        throw new https.HttpsError('not-found', 'Authentication account not found.');
      }
      throw new https.HttpsError('internal', 'Failed to update authentication email.');
    }
  }

  try {
    await db.collection('users').doc(uid).update({
      email: normalizedEmail,
      previousEmail: targetData.email || previousAuthEmail,
      emailUpdatedAt: FieldValue.serverTimestamp(),
      emailUpdatedBy: context.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (fsError) {
    logger.error(`Failed to update Firestore email for user ${uid}:`, fsError);
    if (authNeedsUpdate && previousAuthEmail) {
      try {
        await auth.updateUser(uid, { email: previousAuthEmail });
      } catch (rollbackErr) {
        logger.error(`CRITICAL: Failed to roll back Auth email for user ${uid}:`, rollbackErr);
      }
    }
    throw new https.HttpsError('internal', 'Failed to update user profile email. Changes were rolled back.');
  }

  try {
    await auth.revokeRefreshTokens(uid);
  } catch (revokeErr) {
    logger.warn(`Failed to revoke refresh tokens after email change for ${uid}:`, revokeErr);
  }

  logger.info(`Admin ${context.auth.uid} updated email for user ${uid} (${targetData.role}).`);
  return {
    status: 'success',
    email: normalizedEmail,
    message: 'User email updated successfully.',
  };
});

/**
 * Authoritative Firestore Trigger on `evaluations/{evaluationId}` writes.
 * Recomputes affected evaluator and referee stats inside per-user transactions
 * so retries, concurrent submissions, edits, and deletions stay 100% accurate.
 */
exports.onEvaluationWrite = firestore
  .document('evaluations/{evaluationId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    if (before && after && !hasRelevantEvaluationChange(before, after)) {
      return null;
    }

    const beforeIds = extractAffectedUserIds(before);
    const afterIds = extractAffectedUserIds(after);

    const affectedEvaluatorIds = Array.from(
      new Set([beforeIds.evaluatorId, afterIds.evaluatorId].filter(Boolean))
    );
    const affectedRefereeIds = Array.from(
      new Set([...beforeIds.refereeIds, ...afterIds.refereeIds])
    );

    const updateEvaluator = async (uid) => {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists || userSnap.data().role !== 'evaluator') {
          return;
        }
        const countSnap = await tx.get(
          db.collection('evaluations').where('evaluatorId', '==', uid).count()
        );
        tx.update(userRef, { evaluationsMade: countSnap.data().count });
      });
    };

    const updateReferee = async (uid) => {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists || userSnap.data().role !== 'referee') {
          return;
        }

        const [singleSnap, groupSnap] = await Promise.all([
          tx.get(db.collection('evaluations').where('refereeId', '==', uid)),
          tx.get(db.collection('evaluations').where('refereeIds', 'array-contains', uid)),
        ]);

        const dedupMap = new Map();
        singleSnap.forEach((docSnap) => {
          dedupMap.set(docSnap.id, { id: docSnap.id, data: docSnap.data() });
        });
        groupSnap.forEach((docSnap) => {
          dedupMap.set(docSnap.id, { id: docSnap.id, data: docSnap.data() });
        });

        const rollup = computeRefereeRollup(uid, Array.from(dedupMap.values()));
        tx.update(userRef, rollup);
      });
    };

    try {
      await Promise.all([
        ...affectedEvaluatorIds.map(updateEvaluator),
        ...affectedRefereeIds.map(updateReferee),
      ]);
    } catch (error) {
      logger.error(`onEvaluationWrite failed for evaluation ${context.params.evaluationId}:`, error);
      throw error;
    }

    return null;
  });

/**
 * ONE-TIME / IDEMPOTENT DATABASE MIGRATION FUNCTION
 *
 * Uses the exact same stats & tier helpers as `onEvaluationWrite` to backfill
 * evaluator counts, referee rollups, normalized tier strings, and missing names.
 */
exports.migrateDatabaseSchema = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new https.HttpsError('unauthenticated', 'Must be authenticated to run migration.');
  }

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
    throw new https.HttpsError('permission-denied', 'Only administrators can run the migration.');
  }

  logger.info(`Migration initiated by admin UID: ${context.auth.uid}`);

  try {
    const [usersSnap, evalsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('evaluations').get(),
    ]);

    logger.info(`Loaded ${usersSnap.size} user documents and ${evalsSnap.size} evaluation documents.`);

    const usersMap = new Map();
    usersSnap.forEach((docSnap) => {
      usersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });

    const evaluatorCounts = new Map();
    const refereeEvalDocs = new Map();

    evalsSnap.forEach((evalDoc) => {
      const ev = evalDoc.data();
      const { evaluatorId, refereeIds } = extractAffectedUserIds(ev);

      if (evaluatorId) {
        evaluatorCounts.set(evaluatorId, (evaluatorCounts.get(evaluatorId) || 0) + 1);
      }

      refereeIds.forEach((refId) => {
        if (!refereeEvalDocs.has(refId)) {
          refereeEvalDocs.set(refId, []);
        }
        refereeEvalDocs.get(refId).push({ id: evalDoc.id, data: ev });
      });
    });

    let batch = db.batch();
    let opCount = 0;
    const commitBatchIfNeeded = async () => {
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    // BATCH 1: Update Users using shared rollup helpers
    for (const [uid, user] of usersMap.entries()) {
      const userRef = db.collection('users').doc(uid);
      const updates = {};

      if (!user.status) updates.status = 'Active';
      if (user.photoURL === undefined && user.photo === undefined) updates.photoURL = '';

      if (user.role === 'evaluator') {
        updates.evaluationsMade = evaluatorCounts.get(uid) || 0;
      }

      if (user.role === 'referee') {
        const rollup = computeRefereeRollup(uid, refereeEvalDocs.get(uid) || []);
        Object.assign(updates, rollup);
        if (!user.tier) updates.tier = 'Tier 100';
        if (user.stats) {
          updates.stats = FieldValue.delete();
        }
      }

      if (Object.keys(updates).length > 0) {
        batch.set(userRef, updates, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }
    }

    // BATCH 2: Denormalize missing names and normalize tier strings on Evaluations
    for (const docSnap of evalsSnap.docs) {
      const ev = docSnap.data();
      const evalRef = db.collection('evaluations').doc(docSnap.id);
      const updates = {};

      if (!ev.evaluatorName && ev.evaluatorId) {
        const evUser = usersMap.get(ev.evaluatorId);
        if (evUser?.displayName) {
          updates.evaluatorName = evUser.displayName;
        }
      }

      if (!ev.refereeName && ev.refereeId) {
        const refUser = usersMap.get(ev.refereeId);
        if (refUser?.displayName) {
          updates.refereeName = refUser.displayName;
        }
      }

      if (ev.tier) {
        const normalizedTier = normalizeTier(ev.tier);
        if (normalizedTier && normalizedTier !== ev.tier) {
          updates.tier = normalizedTier;
        }
      }

      if (Object.keys(updates).length > 0) {
        batch.set(evalRef, updates, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    logger.info('NTBOA migration completed successfully!');
    return {
      status: 'success',
      usersUpdated: usersSnap.size,
      evaluationsUpdated: evalsSnap.size,
    };
  } catch (error) {
    logger.error('Migration failed:', error);
    throw new https.HttpsError('internal', `Migration error: ${error.message}`);
  }
});
