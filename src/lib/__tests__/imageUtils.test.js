/**
 * imageUtils.test.js
 * Unit tests for image compression and validation utilities.
 */
import { describe, it, expect } from 'vitest';
import { validateImageFile } from '../imageUtils';

describe('validateImageFile', () => {
  it('rejects null or undefined file', () => {
    const res = validateImageFile(null);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/no file selected/i);
  });

  it('rejects non-image files', () => {
    const mockPdf = {
      type: 'application/pdf',
      name: 'document.pdf',
      size: 1024,
    };
    const res = validateImageFile(mockPdf);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/valid image file/i);
  });

  it('rejects files larger than the maximum MB limit', () => {
    const mockLargeImage = {
      type: 'image/jpeg',
      name: 'huge_photo.jpg',
      size: 20 * 1024 * 1024, // 20MB
    };
    const res = validateImageFile(mockLargeImage, 15);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/too large/i);
  });

  it('accepts valid image files within size limit', () => {
    const mockImage = {
      type: 'image/png',
      name: 'avatar.png',
      size: 2 * 1024 * 1024, // 2MB
    };
    const res = validateImageFile(mockImage, 15);
    expect(res.valid).toBe(true);
    expect(res.error).toBeNull();
  });
});
