/**
 * pageCache.js
 *
 * A tiny module-level cache factory for admin pages.
 * Module-level variables survive React component unmounts (tab switches),
 * so navigating back to a page renders instantly from the in-memory cache
 * instead of issuing a fresh Firestore fetch.
 *
 * Usage:
 *   import { createPageCache } from '@/lib/pageCache';
 *   const cache = createPageCache({ evaluators: [], loaded: false });
 *   // In component:
 *   const [data, setData] = useState(() => cache.get().evaluators);
 *   cache.set({ evaluators: newData, loaded: true });
 *   cache.isLoaded(); // → true
 */

/**
 * Creates a typed module-level page cache.
 * @template T
 * @param {T} initialState — the shape & defaults for this cache
 * @returns {{ get: () => T, set: (partial: Partial<T>) => void, isLoaded: () => boolean, invalidate: () => void }}
 */
export function createPageCache(initialState) {
  let state = { ...initialState };

  return {
    /** Returns the full current cache state. */
    get() {
      return state;
    },

    /**
     * Merges partial updates into the cache.
     * @param {Partial<T>} partial
     */
    set(partial) {
      state = { ...state, ...partial };
    },

    /** Returns true when the cache has been populated at least once. */
    isLoaded() {
      return Boolean(state.loaded);
    },

    /**
     * Resets the cache back to the initial state (e.g., after a logout).
     * Call this from auth sign-out logic to prevent stale data across sessions.
     */
    invalidate() {
      state = { ...initialState };
    },
  };
}
