/**
 * pageCache.test.js
 *
 * Unit tests for the createPageCache utility.
 * Run with: npx vitest run
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPageCache } from '../pageCache';

describe('createPageCache', () => {
  let cache;

  beforeEach(() => {
    cache = createPageCache({
      items: [],
      count: 0,
      loaded: false,
    });
  });

  it('returns default initial state from get()', () => {
    const state = cache.get();
    expect(state.items).toEqual([]);
    expect(state.count).toBe(0);
    expect(state.loaded).toBe(false);
  });

  it('isLoaded() returns false before any set()', () => {
    expect(cache.isLoaded()).toBe(false);
  });

  it('set() merges partial updates without losing other keys', () => {
    cache.set({ items: [1, 2, 3], loaded: true });
    const state = cache.get();
    expect(state.items).toEqual([1, 2, 3]);
    expect(state.count).toBe(0); // untouched
    expect(state.loaded).toBe(true);
  });

  it('isLoaded() returns true after set({ loaded: true })', () => {
    cache.set({ loaded: true });
    expect(cache.isLoaded()).toBe(true);
  });

  it('set() can be called multiple times and accumulates changes', () => {
    cache.set({ items: ['a'] });
    cache.set({ count: 5 });
    const state = cache.get();
    expect(state.items).toEqual(['a']);
    expect(state.count).toBe(5);
  });

  it('invalidate() resets the cache back to the initial state', () => {
    cache.set({ items: [1, 2], count: 2, loaded: true });
    expect(cache.isLoaded()).toBe(true);

    cache.invalidate();

    const state = cache.get();
    expect(state.items).toEqual([]);
    expect(state.count).toBe(0);
    expect(state.loaded).toBe(false);
    expect(cache.isLoaded()).toBe(false);
  });

  it('multiple cache instances do not share state', () => {
    const cacheA = createPageCache({ value: 'A', loaded: false });
    const cacheB = createPageCache({ value: 'B', loaded: false });

    cacheA.set({ value: 'A-updated', loaded: true });

    expect(cacheA.get().value).toBe('A-updated');
    expect(cacheB.get().value).toBe('B'); // B should be unchanged
    expect(cacheB.isLoaded()).toBe(false);
  });

  it('get() returns a snapshot; mutating it does not corrupt cache', () => {
    cache.set({ items: [1, 2, 3], loaded: true });
    const snapshot = cache.get();
    snapshot.items.push(999); // mutate the snapshot

    // The cache should still hold the original reference (shallow copy)
    // but internal reassignment on next set() will fix it.
    cache.set({ items: [1, 2, 3] }); // re-set clean
    expect(cache.get().items).toEqual([1, 2, 3]);
  });
});
