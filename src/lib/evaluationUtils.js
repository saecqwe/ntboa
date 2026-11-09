/**
 * Centralized evaluation utilities, category schemas, and normalization helpers.
 * Single source of truth across Admin, Referee, and Evaluator views.
 */

export const OFFICIAL_CATEGORIES = [
  { label: 'Positioning & Court Coverage', name: 'Positioning & Court Coverage', key: 'positioning', id: 'positioning', max: 5 },
  { label: 'Game Management & Control', name: 'Game Management & Control', key: 'gameManagement', id: 'gameManagement', max: 5 },
  { label: 'Rules Knowledge & Application', name: 'Rules Knowledge & Application', key: 'rulesKnowledge', id: 'rulesKnowledge', max: 5 },
  { label: 'Mechanics & Signals', name: 'Mechanics & Signals', key: 'mechanics', id: 'mechanics', max: 5 },
  { label: 'Consistency & Accuracy', name: 'Consistency & Accuracy', key: 'consistency', id: 'consistency', max: 5 },
  { label: 'Professional Demeanor', name: 'Professional Demeanor', key: 'demeanor', id: 'demeanor', max: 5 },
  { label: 'Decision Making Speed', name: 'Decision Making Speed', key: 'decisionSpeed', id: 'decisionSpeed', max: 5 },
  { label: 'Team Collaboration', name: 'Team Collaboration', key: 'collaboration', id: 'collaboration', max: 5 },
];

export const LEGACY_CATEGORIES = [
  { label: 'Court Presence', name: 'Court Presence', key: 'courtPresence', id: 'courtPresence', max: 5 },
  { label: 'Communication', name: 'Communication', key: 'communication', id: 'communication', max: 5 },
  { label: 'Game Management', name: 'Game Management', key: 'gameManagement', id: 'gameManagement', max: 5 },
  { label: 'Rules Knowledge', name: 'Rules Knowledge', key: 'rulesKnowledge', id: 'rulesKnowledge', max: 5 },
  { label: 'Physical Fitness', name: 'Physical Fitness', key: 'physicalFitness', id: 'physicalFitness', max: 5 },
  { label: 'Professionalism', name: 'Professionalism', key: 'professionalism', id: 'professionalism', max: 5 },
];

export const CATEGORY_ALIASES = {
  demeanor: 'professionalism',
  professionalism: 'demeanor',
  collaboration: 'communication',
  communication: 'collaboration',
  positioning: 'courtPresence',
  courtPresence: 'positioning',
  mechanics: 'physicalFitness',
  physicalFitness: 'mechanics',
};

/**
 * Safely extracts a numeric score for a category, checking common key aliases.
 */
export const getCategoryScore = (scores, key) => {
  if (!scores || typeof scores !== 'object') return 0;
  if (typeof scores[key] === 'number') return scores[key];
  const alias = CATEGORY_ALIASES[key];
  if (alias && typeof scores[alias] === 'number') {
    return scores[alias];
  }
  return 0;
};

/**
 * Extracts a normalized array of officials evaluated in the given evaluation document.
 * Handles both group evaluations and single referee evaluations.
 */
export const getEvaluationOfficials = (evalData) => {
  if (!evalData) return [];

  // Group evaluations with full officials array
  if (Array.isArray(evalData.officials) && evalData.officials.length > 0) {
    return evalData.officials.map((off, idx) => ({
      index: idx,
      id: off.id || `official_${idx}`,
      name: off.name || `Official ${idx + 1}`,
      tier: off.tier || evalData.tier || 'N/A',
    }));
  }

  // Group evaluations with refereeNames array
  if (Array.isArray(evalData.refereeNames) && evalData.refereeNames.length > 0) {
    return evalData.refereeNames.map((name, idx) => ({
      index: idx,
      id: evalData.refereeIds?.[idx] || `official_${idx}`,
      name: name || `Official ${idx + 1}`,
      tier: evalData.tier || 'N/A',
    }));
  }

  // Nested official_0, official_1 in scores/comments
  const scoresObj = evalData.rawScores || evalData.scores || evalData.ratings || {};
  const commentsObj = evalData.rawComments || evalData.comments || {};
  const allKeys = new Set([...Object.keys(scoresObj), ...Object.keys(commentsObj)]);
  const officialKeys = Array.from(allKeys).filter(k => k.startsWith('official_')).sort();

  if (officialKeys.length > 0) {
    return officialKeys.map((key, idx) => {
      let name = `Official ${idx + 1}`;
      if (idx === 0 && evalData.refereeName && evalData.refereeName !== 'Unknown') {
        name = evalData.refereeName;
      }
      return {
        index: idx,
        id: evalData.refereeIds?.[idx] || key,
        name,
        tier: evalData.tier || 'N/A',
      };
    });
  }

  // Single referee evaluation fallback
  return [{
    index: 0,
    id: evalData.refereeId || 'official_0',
    name: evalData.refereeName || 'Official',
    tier: evalData.tier || 'N/A',
  }];
};

/**
 * Finds the index of a specific referee within a group evaluation.
 */
export const getOfficialIndexForReferee = (evalData, refereeId) => {
  if (!evalData || !refereeId) return 0;

  if (Array.isArray(evalData.officials)) {
    const idx = evalData.officials.findIndex(off => off.id === refereeId);
    if (idx !== -1) return idx;
  }

  if (Array.isArray(evalData.refereeIds)) {
    const idx = evalData.refereeIds.findIndex(id => id === refereeId);
    if (idx !== -1) return idx;
  }

  return 0;
};

/**
 * Returns the scores object for a specific official index.
 */
export const getScoresForOfficial = (evalData, index = 0) => {
  if (!evalData) return {};
  const scores = evalData.rawScores || evalData.scores || evalData.ratings || {};
  const key = `official_${index}`;

  if (scores[key] && typeof scores[key] === 'object') {
    return scores[key];
  }
  if (index === 0 && scores.official_0 && typeof scores.official_0 === 'object') {
    return scores.official_0;
  }
  if (index === 0 && scores.official && typeof scores.official === 'object') {
    return scores.official;
  }
  return scores;
};

/**
 * Returns scores for a specific referee ID, resolving their index automatically.
 */
export const getScoresForReferee = (evalData, refereeId) => {
  const index = getOfficialIndexForReferee(evalData, refereeId);
  return getScoresForOfficial(evalData, index);
};

/**
 * Returns the comments object for a specific official index.
 */
export const getCommentsForOfficial = (evalData, index = 0) => {
  if (!evalData) return {};
  const comments = evalData.rawComments || evalData.comments || {};
  const key = `official_${index}`;

  if (comments[key] && typeof comments[key] === 'object') {
    return comments[key];
  }
  if (index === 0 && comments.official_0 && typeof comments.official_0 === 'object') {
    return comments.official_0;
  }
  if (index === 0 && comments.official && typeof comments.official === 'object') {
    return comments.official;
  }
  return comments;
};

/**
 * Calculates total score by summing numeric category scores.
 */
export const getOfficialTotalScore = (scores) => {
  if (!scores || typeof scores !== 'object') return 0;
  const values = Object.values(scores).filter(v => typeof v === 'number');
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0);
};

/**
 * Resolves active categories (official 8 categories vs legacy 6 categories)
 * based on the keys present in scores.
 */
export const resolveActiveCategories = (scores) => {
  if (!scores || typeof scores !== 'object') return OFFICIAL_CATEGORIES;
  const keys = Object.keys(scores);
  const hasOfficial = OFFICIAL_CATEGORIES.some(c => keys.includes(c.key));
  if (hasOfficial) return OFFICIAL_CATEGORIES;
  const hasLegacy = LEGACY_CATEGORIES.some(c => keys.includes(c.key));
  if (hasLegacy) return LEGACY_CATEGORIES;
  return OFFICIAL_CATEGORIES;
};

/**
 * Color helper for score percentages.
 */
export const getScoreColor = (score, max = 5) => {
  const percentage = (score / max) * 100;
  if (percentage >= 85) return 'text-green-500';
  if (percentage >= 70) return 'text-yellow-500';
  return 'text-red-500';
};

/**
 * Background color helper for score percentage containers.
 */
export const getScoreBackground = (score, max = 5) => {
  const percentage = (score / max) * 100;
  if (percentage >= 85) return 'bg-green-500/10';
  if (percentage >= 70) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
};
