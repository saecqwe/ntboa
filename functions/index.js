const { logger, https } = require("firebase-functions");
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
