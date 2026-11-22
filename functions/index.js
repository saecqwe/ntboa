const { logger } = require("firebase-functions");
const https = require("firebase-functions/v1").https;
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

const db = getFirestore();
const auth = getAuth();

exports.createNewUser = https.onCall(async (data, context) => {
  const { email, password, displayName, role } = data;

  // Ensure the caller is authenticated, or if you want to allow creation from an admin panel,
  // you might check for admin claims instead:
  // if (!context.auth) {
  //   throw new https.HttpsError('unauthenticated', 'You must be authenticated to create a user.');
  // }
  // const isAdmin = context.auth.token.role === 'admin';
  // if (!isAdmin) {
  //   throw new https.HttpsError('permission-denied', 'You must be an admin to create a new user.');
  // }

  // --- Input Validation ---
  if (!email || !password || !displayName || !role) {
    throw new https.HttpsError('invalid-argument', 'Missing required user data (email, password, displayName, role).');
  }

  const validRoles = ['admin', 'evaluator', 'referee'];
  if (!validRoles.includes(role)) {
    throw new https.HttpsError('invalid-argument', `Invalid role "${role}". Must be one of ${validRoles.join(', ')}.`);
  }

  try {
    // --- Create User in Firebase Auth ---
    logger.info(`Creating user: ${email} with role: ${role}`);
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });
    const uid = userRecord.uid;

    // --- Set Custom Claim for Role-Based Access Control ---
    await auth.setCustomUserClaims(uid, { role: role });

    // --- Create User Document in Firestore ---
    const createdAt = FieldValue.serverTimestamp();
    let newUserDocument = {
      uid,
      email,
      role,
      displayName,
      createdAt,
    };

    // Add role-specific fields based on our data models
    if (role === 'evaluator') {
      newUserDocument.assignedReferees = [];
      newUserDocument.evaluationsMade = 0;
    } else if (role === 'referee') {
      newUserDocument.level = 'Unassigned'; // Default level
      newUserDocument.overallScore = 0.0;
      newUserDocument.evaluationsReceived = [];
    }

    await db.collection('users').doc(uid).set(newUserDocument);

    logger.info(`Successfully created user ${uid} and their document.`);
    return {
      status: 'success',
      message: `User ${displayName} created successfully with role ${role}.`,
      uid: uid,
    };

  } catch (error) {
    logger.error('Error creating new user:', error);
    // Propagate a more specific error to the client
    if (error.code === 'auth/email-already-exists') {
      throw new https.HttpsError('already-exists', 'A user with this email address already exists.');
    }
    throw new https.HttpsError('internal', 'An unexpected error occurred while creating the user.');
  }
});

exports.suspendUser = https.onCall(async (data, context) => {
  const { uid } = data;

  // Check for authentication and admin role if needed
  // if (!context.auth || context.auth.token.role !== 'admin') {
  //   throw new https.HttpsError('permission-denied', 'Only admins can suspend users.');
  // }

  if (!uid) {
    throw new https.HttpsError('invalid-argument', 'The function must be called with a "uid".');
  }

  try {
    // 1. Delete the user from Firebase Authentication
    await auth.deleteUser(uid);
    logger.info(`Successfully deleted user ${uid} from Auth.`);

    // 2. Update the user's Firestore document to status 'Disabled'
    // We do NOT delete the document to preserve history (evaluations, etc.)
    await db.collection('users').doc(uid).update({
      status: 'Disabled',
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Successfully marked user document ${uid} as Disabled.`);

    return { success: true, message: 'User suspended successfully.' };
  } catch (error) {
    logger.error('Error suspending user:', error);
    // If user is not found in Auth, we might still want to ensure Firestore is updated
    if (error.code === 'auth/user-not-found') {
       logger.warn(`User ${uid} not found in Auth, proceeding to mark Firestore doc as Disabled.`);
       await db.collection('users').doc(uid).set({
        status: 'Disabled',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }); // merge:true handles missing docs gracefully
      return { success: true, message: 'User was not in Auth, but marked as Disabled in DB.' };
    }
    throw new https.HttpsError('internal', 'Unable to suspend user.');
  }
});

/**
 * ONE-TIME DATABASE MIGRATION FUNCTION
 * 
 * Safely backfills counters, normalizes schemas, and aggregates referee metrics
 * from historical evaluations without deleting or corrupting existing records.
 * Idempotent: can be run repeatedly without duplicating counts.
 */
exports.migrateDatabaseSchema = https.onCall(async (data, context) => {
  // Security: Require Admin
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

    // Tracking maps
    const evaluatorCounts = new Map(); // evaluatorId -> count
    const refereeStats = new Map();    // refereeId -> { count, totalScoreSum, latestTime, suggestedTier }

    let totalScoreSumAll = 0;
    let validScoresCountAll = 0;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let evalsThisWeekCount = 0;

    // Helper to extract numeric score from any evaluation format
    const extractScore = (ev, index, refId) => {
      const scores = ev.rawScores || ev.scores || ev.ratings || {};
      const key = `official_${index}`;
      let targetObj = scores;

      if (scores[key] && typeof scores[key] === 'object') targetObj = scores[key];
      else if (index === 0 && scores.official_0) targetObj = scores.official_0;
      else if (index === 0 && scores.official) targetObj = scores.official;

      const vals = Object.values(targetObj).filter((v) => typeof v === 'number');
      if (vals.length > 0) return vals.reduce((a, b) => a + b, 0);

      // Fallback to top-level score fields
      const topScore = Number(ev.totalScore ?? ev.overallScore ?? ev.score);
      return !isNaN(topScore) ? topScore : 0;
    };

    evalsSnap.forEach((evalDoc) => {
      const ev = evalDoc.data();
      const createdAt = ev.createdAt?.toDate
        ? ev.createdAt.toDate()
        : ev.gameDate
        ? new Date(ev.gameDate)
        : new Date(0);

      if (createdAt >= sevenDaysAgo) {
        evalsThisWeekCount++;
      }

      // 1. Evaluator stats
      if (ev.evaluatorId) {
        evaluatorCounts.set(ev.evaluatorId, (evaluatorCounts.get(ev.evaluatorId) || 0) + 1);
      }

      // 2. Identify all officials evaluated in this document
      const officialsList = [];
      if (Array.isArray(ev.officials) && ev.officials.length > 0) {
        ev.officials.forEach((o, idx) => {
          if (o.id && !o.id.startsWith('official_')) officialsList.push({ id: o.id, index: idx });
        });
      } else if (Array.isArray(ev.refereeIds) && ev.refereeIds.length > 0) {
        ev.refereeIds.forEach((id, idx) => {
          if (id) officialsList.push({ id, index: idx });
        });
      } else if (ev.refereeId) {
        officialsList.push({ id: ev.refereeId, index: 0 });
      }

      officialsList.forEach(({ id, index }) => {
        const score = extractScore(ev, index, id);
        const current = refereeStats.get(id) || {
          count: 0,
          totalScoreSum: 0,
          latestTime: 0,
          suggestedTier: '',
        };

        current.count += 1;
        current.totalScoreSum += Number(score) || 0;

        if (createdAt.getTime() >= current.latestTime) {
          current.latestTime = createdAt.getTime();
          if (ev.tier) {
            current.suggestedTier = String(ev.tier).startsWith('Tier ')
              ? ev.tier
              : `Tier ${ev.tier}`;
          }
        }

        refereeStats.set(id, current);
        totalScoreSumAll += Number(score) || 0;
        validScoresCountAll += 1;
      });
    });

    // Batch commit manager (Firestore batches max out at 500 operations)
    let batch = db.batch();
    let opCount = 0;
    const commitBatchIfNeeded = async () => {
      if (opCount >= 450) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    };

    // -------------------------------------------------------------------------
    // BATCH 1: Update Users
    // -------------------------------------------------------------------------
    for (const [uid, user] of usersMap.entries()) {
      const userRef = db.collection('users').doc(uid);
      const updates = {};

      // Safe normalization for all users
      if (!user.status) updates.status = 'Active';
      if (user.photoURL === undefined && user.photo === undefined) updates.photoURL = '';

      if (user.role === 'evaluator') {
        const count = evaluatorCounts.get(uid) || 0;
        updates.evaluationsMade = count;
      }

      if (user.role === 'referee') {
        const stats = refereeStats.get(uid) || { count: 0, totalScoreSum: 0, suggestedTier: '' };
        const avg = stats.count > 0 ? Number((stats.totalScoreSum / stats.count).toFixed(1)) : 0.0;

        updates.evaluations = stats.count; // Legacy compatibility
        updates.evaluationsCount = stats.count;
        updates.totalScoreSum = stats.totalScoreSum;
        updates.avgScore = avg;

        if (!user.tier) updates.tier = 'Tier 100';
        if (stats.suggestedTier) updates.suggestedTier = stats.suggestedTier;
        else if (!user.suggestedTier) updates.suggestedTier = '';

        // Clean up legacy nested stats map from ImportCenter if present
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

    // -------------------------------------------------------------------------
    // BATCH 2: Denormalize Missing Names on Evaluations
    // -------------------------------------------------------------------------
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

      if (Object.keys(updates).length > 0) {
        batch.set(evalRef, updates, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }
    }

    // -------------------------------------------------------------------------
    // BATCH 3: Seed system_stats/overview
    // -------------------------------------------------------------------------
    let activeRefereesCount = 0;
    usersMap.forEach((u) => {
      if (u.role === 'referee' && u.status !== 'Disabled') activeRefereesCount++;
    });

    const topOfficialsList = Array.from(refereeStats.entries())
      .filter(([id, s]) => s.count > 0)
      .map(([id, s]) => {
        const u = usersMap.get(id);
        return {
          name: u?.displayName || 'Unknown',
          avg: s.totalScoreSum / s.count,
        };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map((item) => item.name);

    const globalAvg =
      validScoresCountAll > 0
        ? Number((totalScoreSumAll / validScoresCountAll).toFixed(1))
        : 0.0;

    const systemStatsRef = db.collection('system_stats').doc('overview');
    batch.set(
      systemStatsRef,
      {
        totalOfficials: activeRefereesCount,
        evaluationsThisWeek: evalsThisWeekCount,
        averageRating: globalAvg.toString(),
        topTierOfficials: topOfficialsList,
        lastMigratedAt: FieldValue.serverTimestamp(),
        totalEvaluationsCount: evalsSnap.size,
      },
      { merge: true }
    );
    opCount++;

    if (opCount > 0) {
      await batch.commit();
    }

    logger.info('NTBOA migration completed successfully!');
    return {
      status: 'success',
      usersUpdated: usersSnap.size,
      evaluationsUpdated: evalsSnap.size,
      dashboardStatsSeeded: true,
    };
  } catch (error) {
    logger.error('Migration failed:', error);
    throw new https.HttpsError('internal', `Migration error: ${error.message}`);
  }
});
