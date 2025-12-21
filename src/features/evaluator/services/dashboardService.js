import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export const getDashboardData = async (userId) => {
  if (!userId) {
    return {
      stats: { totalEvaluations: 0, averageRating: 0, topTierOfficials: 0 },
      recentEvaluations: [],
      quickOverview: { thisMonth: 0, thisWeek: 0, pendingReviews: 0, completionRate: '0%' },
    };
  }

  try {
    const evaluationsRef = collection(db, 'evaluations');
    const q = query(
      evaluationsRef,
      where('evaluatorId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const evaluations = querySnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA; // Descending order
      });

    // Calculate Stats
    const totalEvaluations = evaluations.length;
    const totalScoreSum = evaluations.reduce((sum, ev) => sum + (ev.totalScore || 0), 0);
    // Average Rating (1-5 scale, assuming max score 40)
    const averageRating = totalEvaluations > 0 ? (totalScoreSum / (totalEvaluations * 8)).toFixed(1) : 0;

    // Recent Evaluations (Top 3)
    const recentDocs = evaluations.slice(0, 3);
    const recentEvaluations = await Promise.all(
      recentDocs.map(async (ev) => {
        let name = 'Unknown Official';
        let tier = 'N/A';

        if (ev.refereeId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', ev.refereeId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              name = userData.displayName || userData.name || 'Unknown';
              tier = userData.tier || 'N/A';
            }
          } catch (err) {
            console.error('Error fetching referee', err);
          }
        }

        return {
          id: ev.id,
          name,
          date: ev.createdAt?.toDate
            ? ev.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '',
          score: `${ev.totalScore}/40`,
          tier,
        };
      })
    );

    // Quick Overview
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const thisMonth = evaluations.filter((e) => e.createdAt?.toDate() >= startOfMonth).length;
    const thisWeek = evaluations.filter((e) => e.createdAt?.toDate() >= startOfWeek).length;

    return {
      stats: {
        totalEvaluations,
        averageRating,
        topTierOfficials: 0,
      },
      recentEvaluations,
      quickOverview: {
        thisMonth,
        thisWeek,
        pendingReviews: 0,
        completionRate: '100%',
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};