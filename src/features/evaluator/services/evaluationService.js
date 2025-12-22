import { db } from '@/services/firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export const getEvaluationById = async (evaluationId) => {
  try {
    const docRef = doc(db, 'evaluations', evaluationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Fetch referee details
      let referee = { name: 'Unknown', email: '', tier: '' };
      if (data.refereeId) {
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
        date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
        time: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching evaluation:', error);
    throw error;
  }
};

export const getEvaluationsByEvaluator = async (evaluatorId) => {
  try {
    const q = query(
      collection(db, 'evaluations'),
      where('evaluatorId', '==', evaluatorId)
    );
    const querySnapshot = await getDocs(q);
    
    const evaluations = await Promise.all(querySnapshot.docs.map(async (doc) => {
      const data = doc.data();
      
      // Fetch referee details for list view
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

      return {
        id: doc.id,
        ...data,
        refereeName,
        date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0), // Keep as Date object for sorting
      };
    }));

    return evaluations.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    throw error;
  }
};
