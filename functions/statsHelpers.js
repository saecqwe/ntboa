/**
 * Pure server-side evaluation aggregation, tier calculation, and diff helpers.
 * Shared by both `onEvaluationWrite` and `migrateDatabaseSchema` in functions/index.js.
 */

const TIER_THRESHOLDS = [
  { tier: '100', min: 38 },
  { tier: '150', min: 36 },
  { tier: '200', min: 33 },
  { tier: '300', min: 30 },
  { tier: '350', min: 27 },
  { tier: '400', min: 23 },
  { tier: '500', min: 19 },
  { tier: '600', min: 15 },
  { tier: '700', min: 8 },
  { tier: '800', min: -Infinity },
];

const RELEVANT_EVAL_FIELDS = [
  'evaluatorId',
  'refereeId',
  'refereeIds',
  'officials',
  'scores',
  'rawScores',
  'ratings',
  'totalScore',
  'overallScore',
  'score',
  'tier',
  'isGroup',
  'createdAt',
  'gameDate',
];

const calculateTier = (score) => {
  const num = Number(score);
  if (!Number.isFinite(num)) return '800';
  const match = TIER_THRESHOLDS.find((entry) => num >= entry.min);
  return match ? match.tier : '800';
};

const normalizeTier = (rawTier) => {
  if (rawTier === null || rawTier === undefined) return '';
  const trimmed = String(rawTier).trim();
  if (!trimmed || /^n\/a$/i.test(trimmed) || /^tier\s*n\/a$/i.test(trimmed)) {
    return '';
  }
  const match = trimmed.match(/(\d+)/);
  return match ? `Tier ${match[1]}` : '';
};

const isValidUserId = (id) =>
  typeof id === 'string' && id.trim().length > 0 && !id.startsWith('official_');

const isMultiOfficialEvaluation = (ev) => {
  if (!ev || typeof ev !== 'object') return false;
  return Boolean(
    ev.isGroup ||
    (Array.isArray(ev.officials) && ev.officials.length > 1) ||
    (Array.isArray(ev.refereeIds) && ev.refereeIds.length > 1)
  );
};

const resolveOfficialIndex = (ev, uid) => {
  if (!ev || !uid) return 0;
  if (Array.isArray(ev.officials)) {
    const idx = ev.officials.findIndex((o) => o && o.id === uid);
    if (idx !== -1) return idx;
  }
  if (Array.isArray(ev.refereeIds)) {
    const idx = ev.refereeIds.indexOf(uid);
    if (idx !== -1) return idx;
  }
  return 0;
};

const extractOfficialScore = (ev, index = 0, isGroup = false) => {
  if (!ev || typeof ev !== 'object') return 0;
  const scores = ev.rawScores || ev.scores || ev.ratings || {};
  const key = `official_${index}`;
  let targetObj = null;

  if (scores[key] && typeof scores[key] === 'object' && !Array.isArray(scores[key])) {
    targetObj = scores[key];
  } else if (index === 0 && scores.official_0 && typeof scores.official_0 === 'object' && !Array.isArray(scores.official_0)) {
    targetObj = scores.official_0;
  } else if (index === 0 && scores.official && typeof scores.official === 'object' && !Array.isArray(scores.official)) {
    targetObj = scores.official;
  } else if (!isGroup && scores && typeof scores === 'object' && !Array.isArray(scores)) {
    targetObj = scores;
  }

  if (targetObj) {
    const vals = Object.values(targetObj).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (vals.length > 0) {
      return vals.reduce((a, b) => a + b, 0);
    }
  }

  const topScore = Number(ev.totalScore ?? ev.overallScore ?? ev.score);
  if (!Number.isFinite(topScore)) return 0;

  if (!isGroup) {
    return topScore;
  }

  const officialCount =
    (Array.isArray(ev.officials) && ev.officials.length > 0 ? ev.officials.length : 0) ||
    (Array.isArray(ev.refereeIds) && ev.refereeIds.length > 0 ? ev.refereeIds.length : 0) ||
    1;
  return Number((topScore / officialCount).toFixed(2));
};

const getEvalTimestampMs = (ev) => {
  if (!ev || typeof ev !== 'object') return 0;
  const ts = ev.createdAt;
  if (ts) {
    if (typeof ts.toMillis === 'function') {
      const ms = ts.toMillis();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof ts.toDate === 'function') {
      const ms = ts.toDate().getTime();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof ts.seconds === 'number' && Number.isFinite(ts.seconds)) {
      return ts.seconds * 1000;
    }
    if (typeof ts._seconds === 'number' && Number.isFinite(ts._seconds)) {
      return ts._seconds * 1000;
    }
    const parsedCreated = new Date(ts).getTime();
    if (Number.isFinite(parsedCreated)) return parsedCreated;
  }
  if (ev.gameDate) {
    const parsedGame = new Date(ev.gameDate).getTime();
    if (Number.isFinite(parsedGame)) return parsedGame;
  }
  return 0;
};

const extractAffectedUserIds = (ev) => {
  const evaluatorId = ev && isValidUserId(ev.evaluatorId) ? ev.evaluatorId : null;
  const refereeSet = new Set();

  if (ev && typeof ev === 'object') {
    if (isValidUserId(ev.refereeId)) {
      refereeSet.add(ev.refereeId);
    }
    if (Array.isArray(ev.refereeIds)) {
      ev.refereeIds.forEach((id) => {
        if (isValidUserId(id)) refereeSet.add(id);
      });
    }
    if (Array.isArray(ev.officials)) {
      ev.officials.forEach((off) => {
        if (off && isValidUserId(off.id)) refereeSet.add(off.id);
      });
    }
  }

  return {
    evaluatorId,
    refereeIds: Array.from(refereeSet),
  };
};

const canonicalize = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;
  if (typeof val.toMillis === 'function') return { __tsMillis: val.toMillis() };
  if (val instanceof Date) return { __dateMillis: val.getTime() };
  if (typeof val.seconds === 'number' && typeof val.nanoseconds === 'number') {
    return { __tsSeconds: val.seconds, __tsNanos: val.nanoseconds };
  }
  if (typeof val._seconds === 'number' && typeof val._nanoseconds === 'number') {
    return { __tsSeconds: val._seconds, __tsNanos: val._nanoseconds };
  }
  if (Array.isArray(val)) return val.map(canonicalize);

  const sorted = {};
  for (const key of Object.keys(val).sort()) {
    if (val[key] !== undefined) {
      sorted[key] = canonicalize(val[key]);
    }
  }
  return sorted;
};

const pickRelevantSnapshot = (ev) => {
  const subset = {};
  for (const field of RELEVANT_EVAL_FIELDS) {
    subset[field] = ev && ev[field] !== undefined ? ev[field] : null;
  }
  return canonicalize(subset);
};

const hasRelevantEvaluationChange = (before, after) => {
  if (!before || !after) return true;
  return JSON.stringify(pickRelevantSnapshot(before)) !== JSON.stringify(pickRelevantSnapshot(after));
};

const computeRefereeRollup = (uid, evalDocs) => {
  if (!Array.isArray(evalDocs) || evalDocs.length === 0) {
    return {
      evaluations: 0,
      evaluationsCount: 0,
      totalScoreSum: 0,
      avgScore: 0,
      suggestedTier: '',
    };
  }

  const sorted = [...evalDocs].sort((a, b) => {
    const diff = getEvalTimestampMs(b.data) - getEvalTimestampMs(a.data);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id));
  });

  let totalScoreSum = 0;
  let latestScore = 0;

  sorted.forEach((docItem, orderIdx) => {
    const data = docItem.data || {};
    const isGroup = isMultiOfficialEvaluation(data);
    const officialIdx = resolveOfficialIndex(data, uid);
    const score = extractOfficialScore(data, officialIdx, isGroup);
    totalScoreSum += Number(score) || 0;
    if (orderIdx === 0) {
      latestScore = score;
    }
  });

  const roundedSum = Number(totalScoreSum.toFixed(2));
  const avgScore = Number((totalScoreSum / sorted.length).toFixed(1));

  const latestData = sorted[0].data || {};
  const latestIsGroup = isMultiOfficialEvaluation(latestData);
  const latestIdx = resolveOfficialIndex(latestData, uid);

  const officialSuggested =
    Array.isArray(latestData.officials) && latestData.officials[latestIdx]
      ? normalizeTier(latestData.officials[latestIdx].suggestedTier)
      : '';

  let suggestedTier = officialSuggested;
  if (!suggestedTier && !latestIsGroup) {
    suggestedTier = normalizeTier(latestData.suggestedTier) || normalizeTier(latestData.tier);
  }
  if (!suggestedTier) {
    suggestedTier = `Tier ${calculateTier(latestScore)}`;
  }

  return {
    evaluations: sorted.length,
    evaluationsCount: sorted.length,
    totalScoreSum: roundedSum,
    avgScore,
    suggestedTier,
  };
};

module.exports = {
  TIER_THRESHOLDS,
  calculateTier,
  normalizeTier,
  isValidUserId,
  isMultiOfficialEvaluation,
  resolveOfficialIndex,
  extractOfficialScore,
  getEvalTimestampMs,
  extractAffectedUserIds,
  canonicalize,
  hasRelevantEvaluationChange,
  computeRefereeRollup,
};
