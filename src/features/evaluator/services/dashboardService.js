import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, documentId } from 'firebase/firestore';

export const getDashboardData = async (userId) => {
  if (!userId) {
    return {
      stats: { totalEvaluations: 0, averageRating: 0, topTierOfficials: 0 },
      recentEvaluations: [],
      quickOverview: { thisMonth: 0, thisWeek: 0, pendingReviews: 0, completionRate: '0%' },
    };
  }

  try {
    // 1. Parallelize fetching evaluations and assignments for this evaluator
    const evaluationsRef = collection(db, 'evaluations');
    const evalsQuery = query(
      evaluationsRef,
      where('evaluatorId', '==', userId)
    );
    const assignmentsRef = collection(db, 'assignments');
    const assignmentsQuery = query(
      assignmentsRef,
      where('evaluatorId', '==', userId)
    );

    const [evalSnapshot, assignmentsSnapshot] = await Promise.all([
      getDocs(evalsQuery),
      getDocs(assignmentsQuery)
    ]);

    const evaluations = evalSnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA; // Descending order
      });

    const allAssignments = assignmentsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

    // 2. Gather ALL referee user IDs across recent evaluations AND assignments to fetch in batch
    const refereeIdsToFetch = new Set();
    const recentDocs = evaluations.slice(0, 3);
    recentDocs.forEach((ev) => {
      if (ev.refereeId) refereeIdsToFetch.add(ev.refereeId);
    });

    allAssignments.forEach((asgn) => {
      if (asgn.refereeIds && Array.isArray(asgn.refereeIds)) {
        asgn.refereeIds.forEach((rid) => refereeIdsToFetch.add(rid));
      }
    });

    // 3. Batch-fetch users in chunks of 30 to completely eliminate N+1 queries
    const userMap = {};
    const idArray = Array.from(refereeIdsToFetch);
    for (let i = 0; i < idArray.length; i += 30) {
      const chunk = idArray.slice(i, i + 30);
      if (chunk.length > 0) {
        try {
          const userSnap = await getDocs(
            query(collection(db, 'users'), where(documentId(), 'in', chunk))
          );
          userSnap.forEach((uDoc) => {
            userMap[uDoc.id] = uDoc.data();
          });
        } catch (batchErr) {
          console.error('Error batch fetching referee users:', batchErr);
        }
      }
    }

    // Calculate Stats
    const totalEvaluations = evaluations.length;
    const totalScoreSum = evaluations.reduce((sum, ev) => sum + (ev.totalScore || 0), 0);
    const totalMaxScoreSum = evaluations.reduce((sum, ev) => sum + (ev.maxScore || 40), 0);
    // Average Rating (1-5 scale)
    const averageRating = totalMaxScoreSum > 0 ? (totalScoreSum / totalMaxScoreSum * 5).toFixed(1) : 0;

    // Recent Evaluations (Top 3) — resolved instantly via userMap
    const recentEvaluations = recentDocs.map((ev) => {
      let name = 'Unknown Official';
      let tier = ev.tier ? `Tier ${ev.tier}` : 'N/A';

      if (ev.refereeIds && Array.isArray(ev.refereeIds)) {
        if (Array.isArray(ev.refereeNames) && ev.refereeNames.length > 0) {
          name = ev.refereeNames.length > 2
            ? `${ev.refereeNames.slice(0, 2).join(', ')} +${ev.refereeNames.length - 2} more`
            : ev.refereeNames.join(', ');
        } else if (Array.isArray(ev.officials) && ev.officials.length > 0) {
          name = ev.officials.length > 2
            ? `${ev.officials.slice(0, 2).map((o) => o.name).join(', ')} +${ev.officials.length - 2} more`
            : ev.officials.map((o) => o.name).join(', ');
        } else {
          name = `Group Evaluation (${ev.refereeIds.length} Officials)`;
        }
      } else if (ev.refereeId) {
        const userData = userMap[ev.refereeId];
        if (userData) {
          name = userData.displayName || userData.name || 'Unknown';
          tier = userData.tier || tier;
        }
      }

      return {
        id: ev.id,
        name,
        date: ev.createdAt?.toDate
          ? ev.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
        score: `${ev.totalScore}/${ev.maxScore || 40}`,
        tier,
      };
    });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    let assignmentsToday = 0;
    let assignmentsUpcoming = 0;
    let assignmentsDoneThisWeek = 0;
    let assignmentsMissed = 0;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    allAssignments.forEach(asgn => {
        const scheduledDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
        
        // Today (Pending)
        if (scheduledDate >= todayStart && scheduledDate <= todayEnd && asgn.status !== 'completed') {
            assignmentsToday++;
        }

        // Upcoming (Future days)
        if (scheduledDate > todayEnd && asgn.status !== 'completed') {
            assignmentsUpcoming++;
        }

        // Done This Week (Completed AND in current week)
        if (asgn.status === 'completed' && scheduledDate >= startOfWeek && scheduledDate < endOfWeek) {
            assignmentsDoneThisWeek++;
        }

        // Missed (60 min rule)
        const sixtyMinsAfter = new Date(scheduledDate.getTime() + 60 * 60 * 1000);
        if (asgn.status !== 'completed' && now > sixtyMinsAfter) {
            assignmentsMissed++;
        }
    });
    
    // Filter for relevant assignments resolved synchronously from userMap
    const relevantAssignments = allAssignments
      .filter(a => {
         const scheduledDate = a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
         const isCompletedThisWeek = a.status === 'completed' && scheduledDate >= startOfWeek && scheduledDate < endOfWeek;
         const isPending = a.status !== 'completed';
         return isPending || isCompletedThisWeek;
      })
      .sort((a, b) => {
         const d1 = a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
         const d2 = b.scheduledDate?.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
         return d1 - d2;
      })
      .map((asgn) => {
         const scheduledDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
         const isMissed = asgn.status !== 'completed' && now > new Date(scheduledDate.getTime() + 60 * 60 * 1000);
         
         const refereeDetails = [];
         if (asgn.refereeIds && Array.isArray(asgn.refereeIds)) {
            for (const rid of asgn.refereeIds) {
                const rData = userMap[rid];
                if (rData) {
                    refereeDetails.push({
                        id: rid,
                        name: rData.displayName || 'Unknown',
                        tier: rData.tier || 'N/A'
                    });
                } else {
                    refereeDetails.push({
                        id: rid,
                        name: 'Unknown',
                        tier: 'N/A'
                    });
                }
            }
         }
         return {
            id: asgn.id,
            location: asgn.location,
            status: asgn.status,
            date: scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawDate: scheduledDate.toISOString(),
            refereeDetails, 
            isMissed
         };
      });

    // Quick Overview
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = evaluations.filter((e) => e.createdAt?.toDate() >= startOfMonth).length;
    
    return {
      stats: {
        assignmentsToday,
        assignmentsUpcoming,
        assignmentsDoneThisWeek,
        assignmentsMissed
      },
      recentEvaluations,
      relevantAssignments,
      quickOverview: {
        thisMonth,
        assignmentsThisWeek: assignmentsToday + assignmentsUpcoming + assignmentsDoneThisWeek,
        assignmentsDone: assignmentsDoneThisWeek,
        assignmentsMissed,
        completionRate: (assignmentsDoneThisWeek + assignmentsMissed + assignmentsToday + assignmentsUpcoming) > 0 
            ? `${Math.round((assignmentsDoneThisWeek / (assignmentsDoneThisWeek + assignmentsMissed + assignmentsToday + assignmentsUpcoming)) * 100)}%` 
            : '0%',
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};

/**
 * Subscribes to real-time assignment updates for an evaluator.
 * Calls the callback with fresh dashboard data every time assignments change.
 *
 * @param {string} userId - The evaluator's UID.
 * @param {function} callback - Called with the full dashboard data object on every update.
 * @param {function} onError - Called if there is a Firestore error.
 * @returns {function} unsubscribe - Call this to stop listening (use in useEffect cleanup).
 */
export const subscribeToDashboardData = (userId, callback, onError) => {
  if (!userId) return () => {};

  const assignmentsRef = collection(db, 'assignments');
  const q = query(assignmentsRef, where('evaluatorId', '==', userId));

  const unsubscribe = onSnapshot(
    q,
    async () => {
      // Re-fetch the full dashboard whenever assignments change
      try {
        const data = await getDashboardData(userId);
        callback(data);
      } catch (err) {
        console.error('Error refreshing dashboard data:', err);
        if (onError) onError(err);
      }
    },
    (error) => {
      console.error('onSnapshot error on assignments:', error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
};
