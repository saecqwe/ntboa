import { db } from '@/services/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, startAfter, documentId } from 'firebase/firestore';

/**
 * Fetches a single evaluation by ID with referee and evaluator details (parallelized).
 */
export const getEvaluationById = async (evaluationId) => {
  try {
    const docRef = doc(db, 'evaluations', evaluationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Parallelize referee and evaluator fetches
      const refereePromise = (async () => {
        let referee = { name: 'Unknown', email: '', tier: '' };
        if (data.refereeIds && Array.isArray(data.refereeIds)) {
          if (Array.isArray(data.refereeNames) && data.refereeNames.length > 0) {
            referee.name = data.refereeNames.length > 2
              ? `${data.refereeNames.slice(0, 2).join(', ')} +${data.refereeNames.length - 2} more`
              : data.refereeNames.join(', ');
          } else if (Array.isArray(data.officials) && data.officials.length > 0) {
            referee.name = data.officials.length > 2
              ? `${data.officials.slice(0, 2).map((o) => o.name).join(', ')} +${data.officials.length - 2} more`
              : data.officials.map((o) => o.name).join(', ');
          } else {
            referee.name = `Group Evaluation (${data.refereeIds.length} Officials)`;
          }
          referee.tier = data.tier || '';
        } else if (data.refereeId) {
          const refDoc = await getDoc(doc(db, 'users', data.refereeId));
          if (refDoc.exists()) {
            const refData = refDoc.data();
            referee = {
              name: refData.displayName || refData.name || 'Unknown',
              email: refData.email || '',
              tier: refData.tier || '',
            };
          }
        }
        return referee;
      })();

      const evaluatorPromise = (async () => {
        let evaluator = { name: 'Unknown', email: '' };
        if (data.evaluatorId) {
          const evalDoc = await getDoc(doc(db, 'users', data.evaluatorId));
          if (evalDoc.exists()) {
            const evalData = evalDoc.data();
            evaluator = {
              name: evalData.displayName || evalData.name || 'Unknown',
              email: evalData.email || '',
            };
          }
        }
        return evaluator;
      })();

      const [referee, evaluator] = await Promise.all([refereePromise, evaluatorPromise]);

      return {
        id: docSnap.id,
        ...data,
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
          : '',
        time: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '',
      };
    } else {
      return null;
    }
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

      return {
        id: docSnap.id,
        ...data,
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