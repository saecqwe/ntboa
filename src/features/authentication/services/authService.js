import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import { auth, db, functions } from '@/services/firebase/config';
import { httpsCallable } from 'firebase/functions';

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
 * Securely creates a new user by calling a Cloud Function.
 * This function passes the user details to the 'createNewUser' callable function.
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @param {string} role
 * @returns {Promise<any>} The result from the callable function.
 */
export const createUser = (email, password, displayName, role) => {
  const createNewUserCallable = httpsCallable(functions, 'createNewUser');
  return createNewUserCallable({ email, password, displayName, role });
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
 * Subscribes to the authentication state changes.
 * @param {function} callback - A function to be called with the user object.
 * @returns {import('firebase/auth').Unsubscribe} A function to unsubscribe from the listener.
 */
export const onAuthObserver = (callback) => {
    return onAuthStateChanged(auth, callback);
}