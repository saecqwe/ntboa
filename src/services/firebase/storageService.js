import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/services/firebase/config';
import { dataUrlToBlob } from '@/lib/imageUtils';

const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Returns the deterministic Firebase Storage path for a user's avatar.
 *
 * @param {string} uid - Firebase Auth user ID.
 * @returns {string}
 */
export const getProfilePhotoPath = (uid) => {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw new Error('A valid user ID is required for profile photo storage.');
  }
  return `profile-photos/${uid}/avatar.jpg`;
};

/**
 * Uploads a compressed profile photo (Data URL or Blob/File) to Firebase Storage
 * and returns its HTTPS download URL.
 *
 * @param {string} uid - Firebase Auth user ID.
 * @param {string|Blob} imageInput - Compressed base64 Data URL or image Blob/File.
 * @returns {Promise<string>} Public tokenized HTTPS download URL.
 */
export const uploadProfilePhoto = async (uid, imageInput) => {
  const blob = typeof imageInput === 'string' ? dataUrlToBlob(imageInput) : imageInput;

  if (!(blob instanceof Blob) || blob.size <= 0) {
    throw new Error('Invalid profile photo data.');
  }

  const contentType = blob.type || 'image/jpeg';
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new Error('Unsupported image format. Please use JPG, PNG, or WebP.');
  }

  if (blob.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Profile photo exceeds the 2MB upload limit.');
  }

  const photoRef = ref(storage, getProfilePhotoPath(uid));
  await uploadBytes(photoRef, blob, {
    contentType,
    cacheControl: 'public, max-age=31536000',
  });

  return getDownloadURL(photoRef);
};

/**
 * Deletes the user's profile photo from Firebase Storage if present.
 * Ignores `storage/object-not-found`; rethrows all permission or network failures.
 *
 * @param {string} uid - Firebase Auth user ID.
 * @returns {Promise<void>}
 */
export const deleteProfilePhoto = async (uid) => {
  const photoRef = ref(storage, getProfilePhotoPath(uid));
  try {
    await deleteObject(photoRef);
  } catch (error) {
    if (error?.code === 'storage/object-not-found') {
      return;
    }
    throw error;
  }
};
