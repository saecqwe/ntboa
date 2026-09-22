/**
 * Assignments.logic.test.js
 *
 * Unit tests for the pure logic functions used in Assignments.jsx.
 * No Firebase mocking needed — all functions are pure JS.
 *
 * Run with: npx vitest run
 */
import { describe, it, expect } from 'vitest';

// ─── Pure helpers (mirrored from Assignments.jsx) ──────────────────────────

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  const date1 = d1.toDate ? d1.toDate() : new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function buildAssignedRefereeIds(assignments, evaluatorId, date) {
  if (!evaluatorId || !date) return new Set();
  const ids = new Set();
  assignments
    .filter(a => a.evaluatorId === evaluatorId && isSameDay(a.scheduledDate, date))
    .forEach(a => {
      if (Array.isArray(a.refereeIds)) a.refereeIds.forEach(id => ids.add(id));
    });
  return ids;
}

function groupAssignmentsByDate(assignments) {
  const groups = {};
  assignments.forEach(assignment => {
    const dateObj = assignment.scheduledDate?.toDate
      ? assignment.scheduledDate.toDate()
      : new Date(assignment.scheduledDate);
    const dateKey = dateObj.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = { dateObj, items: [] };
    groups[dateKey].items.push(assignment);
  });
  return Object.entries(groups)
    .sort(([, a], [, b]) => b.dateObj - a.dateObj)
    .map(([key, value]) => ({ date: key, items: value.items }));
}

/** Returns true if the user account should be treated as inactive/disabled. */
function isUserDisabled(user) {
  if (!user) return true;
  if (user.status) {
    const s = String(user.status).toLowerCase().trim();
    if (['disabled', 'suspended', 'deleted', 'inactive'].includes(s)) return true;
  }
  if (user.isSuspended === true || user.suspended === true) return true;
  if (user.isDeleted === true || user.deleted === true) return true;
  if (user.isDisabled === true || user.disabled === true) return true;
  if (user.isActive === false || user.active === false) return true;
  return false;
}

/**
 * Builds a { id -> [timeStrings] } conflict map for a given date.
 * idKey = 'refereeIds' (array) or 'evaluatorId' (scalar).
 */
function buildConflictMap(assignments, date, idKey) {
  if (!date) return {};
  const map = {};
  assignments
    .filter(a => isSameDay(a.scheduledDate, date))
    .forEach(a => {
      const d = a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (idKey === 'refereeIds') {
        if (Array.isArray(a.refereeIds)) {
          a.refereeIds.forEach(rid => {
            if (!map[rid]) map[rid] = [];
            map[rid].push(timeStr);
          });
        }
      } else {
        const eid = a[idKey];
        if (eid) {
          if (!map[eid]) map[eid] = [];
          map[eid].push(timeStr);
        }
      }
    });
  return map;
}

// ─── isSameDay ─────────────────────────────────────────────────────────────

describe('isSameDay', () => {
  it('returns true for same calendar day (ISO string vs ISO string)', () => {
    expect(isSameDay('2025-03-15T08:00:00', '2025-03-15')).toBe(true);
  });
  it('returns false for different days', () => {
    expect(isSameDay('2025-03-15T08:00:00', '2025-03-16')).toBe(false);
  });
  it('handles Firestore Timestamp-like objects with toDate()', () => {
    const ts = { toDate: () => new Date('2025-06-20T10:00:00') };
    expect(isSameDay(ts, '2025-06-20')).toBe(true);
    expect(isSameDay(ts, '2025-06-21')).toBe(false);
  });
  it('returns false when d1 is null', () => {
    expect(isSameDay(null, '2025-03-15')).toBe(false);
  });
  it('returns false when d2 is empty string', () => {
    expect(isSameDay('2025-03-15', '')).toBe(false);
  });
});

// ─── buildAssignedRefereeIds ────────────────────────────────────────────────

describe('buildAssignedRefereeIds', () => {
  const baseAssignments = [
    { evaluatorId: 'eval-1', scheduledDate: '2025-06-01T09:00:00', refereeIds: ['ref-A', 'ref-B'] },
    { evaluatorId: 'eval-1', scheduledDate: '2025-06-02T09:00:00', refereeIds: ['ref-C'] },
    { evaluatorId: 'eval-2', scheduledDate: '2025-06-01T09:00:00', refereeIds: ['ref-D'] },
  ];
  it('returns referee IDs for matching evaluator and date', () => {
    const ids = buildAssignedRefereeIds(baseAssignments, 'eval-1', '2025-06-01');
    expect(ids.has('ref-A')).toBe(true);
    expect(ids.has('ref-B')).toBe(true);
    expect(ids.size).toBe(2);
  });
  it('excludes referees assigned on a different day', () => {
    expect(buildAssignedRefereeIds(baseAssignments, 'eval-1', '2025-06-01').has('ref-C')).toBe(false);
  });
  it('excludes referees of a different evaluator', () => {
    expect(buildAssignedRefereeIds(baseAssignments, 'eval-1', '2025-06-01').has('ref-D')).toBe(false);
  });
  it('returns empty Set when evaluatorId is null', () => {
    expect(buildAssignedRefereeIds(baseAssignments, null, '2025-06-01').size).toBe(0);
  });
  it('returns empty Set when date is empty string', () => {
    expect(buildAssignedRefereeIds(baseAssignments, 'eval-1', '').size).toBe(0);
  });
});

// ─── groupAssignmentsByDate ─────────────────────────────────────────────────

describe('groupAssignmentsByDate', () => {
  const assignments = [
    { id: '1', scheduledDate: '2025-06-01T10:00:00', location: 'Gym A' },
    { id: '2', scheduledDate: '2025-06-01T14:00:00', location: 'Gym B' },
    { id: '3', scheduledDate: '2025-06-03T09:00:00', location: 'Gym C' },
  ];
  it('groups assignments into date buckets', () => {
    expect(groupAssignmentsByDate(assignments)).toHaveLength(2);
  });
  it('puts both same-day assignments together', () => {
    const groups = groupAssignmentsByDate(assignments);
    expect(groups[0].items).toHaveLength(1); // June 3 (most recent first)
    expect(groups[1].items).toHaveLength(2); // June 1
  });
  it('sorts most recent date first', () => {
    const groups = groupAssignmentsByDate(assignments);
    expect(groups[0].items[0].id).toBe('3');
    expect(groups[1].items.map(i => i.id).sort()).toEqual(['1', '2']);
  });
  it('returns empty array for empty input', () => {
    expect(groupAssignmentsByDate([])).toEqual([]);
  });
});

// ─── isUserDisabled ─────────────────────────────────────────────────────────

describe('isUserDisabled', () => {
  it('returns true for null / undefined', () => {
    expect(isUserDisabled(null)).toBe(true);
    expect(isUserDisabled(undefined)).toBe(true);
  });
  it('returns false for a normal active user', () => {
    expect(isUserDisabled({ id: 'u1', displayName: 'Alice' })).toBe(false);
  });
  it('returns true for status "Disabled" (case-insensitive)', () => {
    expect(isUserDisabled({ status: 'Disabled' })).toBe(true);
    expect(isUserDisabled({ status: 'DISABLED' })).toBe(true);
    expect(isUserDisabled({ status: 'disabled' })).toBe(true);
  });
  it('returns true for status "Suspended"', () => {
    expect(isUserDisabled({ status: 'Suspended' })).toBe(true);
  });
  it('returns true for status "Deleted"', () => {
    expect(isUserDisabled({ status: 'deleted' })).toBe(true);
  });
  it('returns true for status "Inactive"', () => {
    expect(isUserDisabled({ status: 'inactive' })).toBe(true);
  });
  it('returns false for status "Active"', () => {
    expect(isUserDisabled({ status: 'Active' })).toBe(false);
  });
  it('returns true when isSuspended / suspended is true', () => {
    expect(isUserDisabled({ isSuspended: true })).toBe(true);
    expect(isUserDisabled({ suspended: true })).toBe(true);
  });
  it('returns true when isDeleted / deleted is true', () => {
    expect(isUserDisabled({ isDeleted: true })).toBe(true);
    expect(isUserDisabled({ deleted: true })).toBe(true);
  });
  it('returns true when isDisabled / disabled is true', () => {
    expect(isUserDisabled({ isDisabled: true })).toBe(true);
    expect(isUserDisabled({ disabled: true })).toBe(true);
  });
  it('returns true when isActive is explicitly false', () => {
    expect(isUserDisabled({ isActive: false })).toBe(true);
    expect(isUserDisabled({ active: false })).toBe(true);
  });
  it('returns false when active is true', () => {
    expect(isUserDisabled({ active: true })).toBe(false);
  });
});

// ─── buildConflictMap — referee view ───────────────────────────────────────

describe('buildConflictMap (referee)', () => {
  const assignments = [
    { scheduledDate: '2025-07-10T09:00:00', evaluatorId: 'eval-1', refereeIds: ['ref-A', 'ref-B'] },
    { scheduledDate: '2025-07-10T12:00:00', evaluatorId: 'eval-2', refereeIds: ['ref-A'] },
    { scheduledDate: '2025-07-11T09:00:00', evaluatorId: 'eval-1', refereeIds: ['ref-A', 'ref-C'] },
  ];
  it('returns empty object when date is falsy', () => {
    expect(buildConflictMap(assignments, '', 'refereeIds')).toEqual({});
    expect(buildConflictMap(assignments, null, 'refereeIds')).toEqual({});
  });
  it('only includes assignments on the target date', () => {
    const map = buildConflictMap(assignments, '2025-07-10', 'refereeIds');
    expect(map['ref-C']).toBeUndefined(); // only on July 11
  });
  it('records multiple time slots for a referee with 2 assignments on the same day', () => {
    const map = buildConflictMap(assignments, '2025-07-10', 'refereeIds');
    expect(map['ref-A']).toHaveLength(2);
  });
  it('records a single time slot for a referee with one assignment', () => {
    const map = buildConflictMap(assignments, '2025-07-10', 'refereeIds');
    expect(map['ref-B']).toHaveLength(1);
  });
});

// ─── buildConflictMap — evaluator view ─────────────────────────────────────

describe('buildConflictMap (evaluator)', () => {
  const assignments = [
    { scheduledDate: '2025-07-10T10:00:00', evaluatorId: 'eval-1', refereeIds: ['ref-A'] },
    { scheduledDate: '2025-07-10T14:00:00', evaluatorId: 'eval-1', refereeIds: ['ref-B'] },
    { scheduledDate: '2025-07-10T10:00:00', evaluatorId: 'eval-2', refereeIds: ['ref-C'] },
  ];
  it('maps each evaluator to their times on the target date', () => {
    const map = buildConflictMap(assignments, '2025-07-10', 'evaluatorId');
    expect(map['eval-1']).toHaveLength(2);
    expect(map['eval-2']).toHaveLength(1);
  });
  it('returns empty map when no assignments exist on the target date', () => {
    const map = buildConflictMap(assignments, '2025-07-11', 'evaluatorId');
    expect(Object.keys(map)).toHaveLength(0);
  });
});
