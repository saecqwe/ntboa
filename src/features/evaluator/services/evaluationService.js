import { db } from '@/services/firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Fetches a single evaluation by ID with referee and evaluator details
 */
export const getEvaluationById = async (evaluationId) => {
  try {
    const docRef = doc(db, 'evaluations', evaluationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Fetch referee details or group evaluation metadata
      let referee = { name: 'Unknown', email: '', tier: '' };
      if (data.refereeIds && Array.isArray(data.refereeIds)) {
        if (Array.isArray(data.refereeNames) && data.refereeNames.length > 0) {
          referee.name = data.refereeNames.length > 2
            ? `${data.refereeNames.slice(0,2).join(', ')} +${data.refereeNames.length - 2} more`
            : data.refereeNames.join(', ');
        } else if (Array.isArray(data.officials) && data.officials.length > 0) {
          referee.name = data.officials.length > 2
            ? `${data.officials.slice(0,2).map((o) => o.name).join(', ')} +${data.officials.length - 2} more`
            : data.officials.map((o) => o.name).join(', ');
        } else {
          referee.name = `Group Evaluation (${data.refereeIds.length} Officials)`;
        }
        referee.tier = data.tier || '';
      } else if (data.refereeId) {
        const refereeDoc = await getDoc(doc(db, 'users', data.refereeId));
        if (refereeDoc.exists()) {
          const refData = refereeDoc.data();
          referee = {
            name: refData.displayName || refData.name || 'Unknown',
            email: refData.email || '',
            tier: refData.tier || '',
          };
        }
      }

      // Fetch evaluator details
      let evaluator = { name: 'Unknown', email: '' };
      if (data.evaluatorId) {
        const evaluatorDoc = await getDoc(doc(db, 'users', data.evaluatorId));
        if (evaluatorDoc.exists()) {
          const evalData = evaluatorDoc.data();
          evaluator = {
            name: evalData.displayName || evalData.name || 'Unknown',
            email: evalData.email || '',
          };
        }
      }

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
 * Fetches all evaluations for a specific evaluator
 */
export const getEvaluationsByEvaluator = async (evaluatorId) => {
  try {
    const q = query(
      collection(db, 'evaluations'),
      where('evaluatorId', '==', evaluatorId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // We use docSnap here to avoid shadowing the imported 'doc' function
    const evaluations = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      
      let refereeName = 'Unknown';
      if (data.refereeId) {
        try {
          const refereeDoc = await getDoc(doc(db, 'users', data.refereeId));
          if (refereeDoc.exists()) {
            const refData = refereeDoc.data();
            refereeName = refData.displayName || refData.name || 'Unknown';
          }
        } catch (e) {
          console.error('Error fetching referee for list:', e);
        }
      }

      const evaluation = {
        id: docSnap.id,
        ...data,
        refereeName,
        maxScore: data.maxScore || 40,
        // Keep as Date object for initial sorting
        date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0), 
      };

      if (data.refereeIds && Array.isArray(data.refereeIds)) {
        if (Array.isArray(data.refereeNames) && data.refereeNames.length > 0) {
          evaluation.refereeName = data.refereeNames.length > 2
            ? `${data.refereeNames.slice(0,2).join(', ')} +${data.refereeNames.length - 2} more`
            : data.refereeNames.join(', ');
        } else if (Array.isArray(data.officials) && data.officials.length > 0) {
          evaluation.refereeName = data.officials.length > 2
            ? `${data.officials.slice(0,2).map((o) => o.name).join(', ')} +${data.officials.length - 2} more`
            : data.officials.map((o) => o.name).join(', ');
        } else {
          evaluation.refereeName = `Group Evaluation (${data.refereeIds.length} Officials)`;
        }
      }

      return evaluation;
    }));

    return evaluations.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    throw error;
  }
};