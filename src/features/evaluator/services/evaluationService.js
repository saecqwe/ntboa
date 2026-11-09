import { db } from '@/services/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, startAfter, documentId } from 'firebase/firestore';
import { getScoresForOfficial, getOfficialTotalScore } from '@/lib/evaluationUtils';

/**
 * Fetches a single evaluation by ID with referee and evaluator details (parallelized).
 */
export const getEvaluationById = async (evaluationId) => {
  try {
    const docRef = doc(db, 'evaluations', evaluationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Check if referee name is already stored directly or in group arrays
    let refereeName = data.refereeName || null;
    let refereeTier = data.tier || '';
    let refereeEmail = '';

    if (Array.isArray(data.refereeNames) && data.refereeNames.length > 0) {
      refereeName = data.refereeNames.length > 2
        ? `${data.refereeNames.slice(0, 2).join(', ')} +${data.refereeNames.length - 2} more`
        : data.refereeNames.join(', ');
    } else if (Array.isArray(data.officials) && data.officials.length > 0) {
      refereeName = data.officials.length > 2
        ? `${data.officials.slice(0, 2).map((o) => o.name).join(', ')} +${data.officials.length - 2} more`
        : data.officials.map((o) => o.name).join(', ');
    }

    let evaluatorName = data.evaluatorName || null;
    let evaluatorEmail = '';

    // Only make Firestore user lookups if names are NOT already stored on the document
    const promises = [];
    if (!refereeName && data.refereeId) {
      promises.push(
        getDoc(doc(db, 'users', data.refereeId))
          .then((refDoc) => {
            if (refDoc.exists()) {
              const refData = refDoc.data();
              refereeName = refData.displayName || refData.name || 'Unknown';
              refereeEmail = refData.email || '';
              refereeTier = refData.tier || refereeTier;
            }
          })
          .catch((err) => console.warn('Could not fetch referee details:', err))
      );
    }

    if (!evaluatorName && data.evaluatorId) {
      promises.push(
        getDoc(doc(db, 'users', data.evaluatorId))
          .then((evalDoc) => {
            if (evalDoc.exists()) {
              const evalData = evalDoc.data();
              evaluatorName = evalData.displayName || evalData.name || 'Unknown';
              evaluatorEmail = evalData.email || '';
            }
          })
          .catch((err) => console.warn('Could not fetch evaluator details:', err))
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    const referee = {
      name: refereeName || (data.refereeIds?.length ? `Group Evaluation (${data.refereeIds.length} Officials)` : 'Unknown'),
      email: refereeEmail,
      tier: refereeTier,
    };

    const evaluator = {
      name: evaluatorName || 'Unknown',
      email: evaluatorEmail,
    };

    let totalScore = data.totalScore ?? data.overallScore ?? data.score;
    if (totalScore === undefined || totalScore === null || totalScore === 0) {
      const scores = getScoresForOfficial(data, 0);
      totalScore = getOfficialTotalScore(scores);
    }

    return {
      id: docSnap.id,
      ...data,
      totalScore,
      referee,
      evaluator,
      gameDateFormatted: data.gameDate
        ? new Date(data.gameDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '',
      gameTimeFormatted: data.gameDate
        ? new Date(data.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '',
      location: data.location || 'Unknown Location',
      date: data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''),
      time: data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''),
    };
  } catch (error) {
    console.error('Error fetching evaluation:', error);
    throw error;
  }
};

/**
 * Fetches evaluations for a specific evaluator without N+1 query waterfall.
 * Uses denormalized metadata when present, and batches any missing referee lookups.
 * Supports optional limit and cursor for pagination.
 */
export const getEvaluationsByEvaluator = async (evaluatorId, { pageSize = 50, lastDoc = null } = {}) => {
  try {
    const queryConstraints = [
      where('evaluatorId', '==', evaluatorId),
      limit(pageSize)
    ];

    if (lastDoc) {
      queryConstraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'evaluations'), ...queryConstraints);
    const querySnapshot = await getDocs(q);

    // Collect distinct refereeIds that need name resolution
    const missingRefereeIds = new Set();
    const rawEvals = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      let refereeName = data.refereeName || null;

      if (data.refereeIds && Array.isArray(data.refereeIds)) {
        if (Array.isArray(data.refereeNames) && data.refereeNames.length > 0) {
          refereeName = data.refereeNames.length > 2
            ? `${data.refereeNames.slice(0, 2).join(', ')} +${data.refereeNames.length - 2} more`
            : data.refereeNames.join(', ');
        } else if (Array.isArray(data.officials) && data.officials.length > 0) {
          refereeName = data.officials.length > 2
            ? `${data.officials.slice(0, 2).map((o) => o.name).join(', ')} +${data.officials.length - 2} more`
            : data.officials.map((o) => o.name).join(', ');
        }
      }

      if (!refereeName && data.refereeId) {
        missingRefereeIds.add(data.refereeId);
      }

      let totalScore = data.totalScore ?? data.overallScore ?? data.score;
      if (totalScore === undefined || totalScore === null || totalScore === 0) {
        const scores = getScoresForOfficial(data, 0);
        totalScore = getOfficialTotalScore(scores);
      }

      return {
        id: docSnap.id,
        ...data,
        totalScore,
        refereeName: refereeName || 'Unknown',
        maxScore: data.maxScore || 40,
        date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0),
        _doc: docSnap,
      };
    });

    // Batch fetch missing referees (in chunks of up to 30 for Firestore 'in' query) to eliminate N+1 queries
    const refereeMap = {};
    const missingIdList = Array.from(missingRefereeIds);

    for (let i = 0; i < missingIdList.length; i += 30) {
      const chunk = missingIdList.slice(i, i + 30);
      if (chunk.length > 0) {
        try {
          const userSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
          userSnap.forEach((u) => {
            const uData = u.data();
            refereeMap[u.id] = uData.displayName || uData.name || 'Unknown';
          });
        } catch (e) {
          console.error('Error batch fetching referee names:', e);
        }
      }
    }

    const evaluations = rawEvals.map((ev) => {
      if (ev.refereeName === 'Unknown' && ev.refereeId && refereeMap[ev.refereeId]) {
        return { ...ev, refereeName: refereeMap[ev.refereeId] };
      }
      return ev;
    });

    return evaluations.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    throw error;
  }
};