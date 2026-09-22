/**
 * imageUtils.js
 * Utility functions for validating and compressing user avatar / profile images
 * client-side before uploading or saving to Firestore / localStorage.
 *
 * Firestore documents have a strict 1,048,487 bytes (~1MB) total size limit.
 * Compressing images to a max dimension of 400x400 at 0.8 JPEG quality produces
 * high-resolution avatars (~25KB - 50KB) that easily fit within Firestore's limits.
 */

/**
 * Validates whether a file is an acceptable image within size limits.
 *
 * @param {File|Blob} file - The file to validate.
 * @param {number} [maxFileSizeMB=15] - Maximum allowable file size before compression in MB.
 * @returns {{ valid: boolean, error: string|null }}
 */
export const validateImageFile = (file, maxFileSizeMB = 15) => {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Verify file type
  const isImage = file.type ? file.type.startsWith('image/') : /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name || '');
  if (!isImage) {
    return { valid: false, error: 'Please select a valid image file (JPG, PNG, WebP, etc.).' };
  }

  // Verify original file size limit (allows up to 15MB camera photos to be compressed)
  if (file.size > maxFileSizeMB * 1024 * 1024) {
    return { valid: false, error: `Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose an image under ${maxFileSizeMB}MB.` };
  }

  return { valid: true, error: null };
};

/**
 * Compresses and resizes an image file to a lightweight JPEG Data URL.
 * Guaranteed to produce an image well below Firestore's 1,048,487 bytes limit.
 *
 * @param {File|Blob} file - The image file to compress.
 * @param {Object} [options] - Compression options.
 * @param {number} [options.maxWidth=400] - Maximum width in pixels.
 * @param {number} [options.maxHeight=400] - Maximum height in pixels.
 * @param {number} [options.quality=0.82] - Initial JPEG quality (0.1 to 1.0).
 * @param {number} [options.maxSizeBytes=500000] - Hard cap on base64 string length (~500KB).
 * @returns {Promise<string>} Base64 data URL string representing the compressed image.
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.82,
    maxSizeBytes = 500000,
  } = options;

  if (!file) {
    throw new Error('No file provided for compression.');
  }

  // Ensure running in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('compressImage must be run in a browser environment.');
  }

  return new Promise((resolve, reject) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (err) {
      reject(new Error('Failed to create object URL for file: ' + err.message));
      return;
    }

    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect ratio scaling
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context.'));
          return;
        }

        // Fill white background for transparent PNG/GIF when converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let currentQuality = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);

        // If data URL exceeds maxSizeBytes, progressively reduce quality
        while (dataUrl.length > maxSizeBytes && currentQuality > 0.25) {
          currentQuality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
        }

        // If still over (extremely dense or large image), scale down dimensions further
        if (dataUrl.length > maxSizeBytes) {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = Math.max(1, Math.round(width * 0.6));
          fallbackCanvas.height = Math.max(1, Math.round(height * 0.6));
          const fallbackCtx = fallbackCanvas.getContext('2d');
          if (fallbackCtx) {
            fallbackCtx.fillStyle = '#FFFFFF';
            fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
            fallbackCtx.drawImage(canvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
            dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.65);
          }
        }

        resolve(dataUrl);
      } catch (err) {
        reject(new Error('Image processing error: ' + err.message));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image file. It may be corrupted or unsupported.'));
    };

    img.src = objectUrl;
  });
};
