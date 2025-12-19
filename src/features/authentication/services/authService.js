import { onAuthStateChanged, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, limit, updateDoc } from 'firebase/firestore';
import { auth, db, functions, firebaseConfig } from '@/services/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { initializeApp, getApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';

// Re-exporting for convenience, in case other services need them
export { auth, db };

/**
 * Signs in a user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential>}
 */
export const login = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Signs out the current user.
 * @returns {Promise<void>}
 */
export const logout = () => {
  return signOut(auth);
};

/**
 * Creates a new user using a secondary Firebase App instance.
 * This ensures the main authenticated user (Admin) stays logged in.
 * 
 * @param {string} email
 * @param {string} password
 * @returns {Promise<UserCredential>}
 */
export const createUser = async (email, password) => {
  let secondaryApp;
  try {
    // Create a unique name for the secondary app to avoid conflicts
    const appName = `secondaryApp-${Date.now()}`;
    secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    
    // Sign out from the secondary app immediately to be clean
    await signOutSecondary(secondaryAuth);
    
    return userCredential;
  } catch (error) {
    throw error;
  } finally {
    // Clean up the secondary app instance
    if (secondaryApp) {
      await deleteApp(secondaryApp);
    }
  }
};

/**
 * Checks if a user with the 'admin' role exists.
 * @returns {Promise<boolean>}
 */
export const checkIfAdminExists = async () => {
  const q = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

/**
 * Fetches the user's data document from Firestore.
 * @param {string} uid - The user's unique ID.
 * @returns {Promise<object|null>} The user data object or null if not found.
 */
export const getUserDocument = async (uid) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}

/**
 * Updates the user's profile data in Firestore.
 * @param {string} uid - The user's unique ID.
 * @param {object} data - The data to update.
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (uid, data) => {
  const docRef = doc(db, 'users', uid);
  return updateDoc(docRef, data);
};

/**
 * Changes the current user's password.
 * Re-authenticates the user before updating the password.
 * @param {string} currentPassword - The user's current password.
 * @param {string} newPassword - The new password.
 * @returns {Promise<void>}
 */
export const changeUserPassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return updatePassword(user, newPassword);
};

/**
 * Subscribes to the authentication state changes.
 * @param {function} callback - A function to be called with the user object.
 * @returns {import('firebase/auth').Unsubscribe} A function to unsubscribe from the listener.
 */
export const onAuthObserver = (callback) => {
    return onAuthStateChanged(auth, callback);
}