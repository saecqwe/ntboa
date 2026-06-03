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
    const totalMaxScoreSum = evaluations.reduce((sum, ev) => sum + (ev.maxScore || 40), 0);
    // Average Rating (1-5 scale)
    const averageRating = totalMaxScoreSum > 0 ? (totalScoreSum / totalMaxScoreSum * 5).toFixed(1) : 0;

    // Recent Evaluations (Top 3)
    const recentDocs = evaluations.slice(0, 3);
    const recentEvaluations = await Promise.all(
      recentDocs.map(async (ev) => {
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
          try {
            const userDoc = await getDoc(doc(db, 'users', ev.refereeId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              name = userData.displayName || userData.name || 'Unknown';
              tier = userData.tier || tier;
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
          score: `${ev.totalScore}/${ev.maxScore || 40}`,
          tier,
        };
      })
    );

    // Fetch All Assignments for Stats & Upcoming List
    const assignmentsRef = collection(db, 'assignments');
    const assignmentsQuery = query(
      assignmentsRef,
      where('evaluatorId', '==', userId)
    );
    
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
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

    const allAssignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    allAssignments.forEach(asgn => {
        const scheduledDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
        
        // Today
        if (scheduledDate >= todayStart && scheduledDate <= todayEnd) {
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
        // Check if status is pending AND current time is > scheduled time + 60 mins
        const sixtyMinsAfter = new Date(scheduledDate.getTime() + 60 * 60 * 1000);
        if (asgn.status !== 'completed' && now > sixtyMinsAfter) {
            assignmentsMissed++;
        }
    });
    
    // Filter for relevant assignments:
    // 1. All Pending (Upcoming & Missed)
    // 2. Completed (Done) ONLY from this week
    const relevantAssignments = await Promise.all(allAssignments
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
      .map(async (asgn) => {
         const scheduledDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
         const isMissed = asgn.status !== 'completed' && now > new Date(scheduledDate.getTime() + 60 * 60 * 1000);
         
         let refereeDetails = [];
         if (asgn.refereeIds && Array.isArray(asgn.refereeIds)) {
            for (const rid of asgn.refereeIds) {
                try {
                    const rDoc = await getDoc(doc(db, 'users', rid));
                    if (rDoc.exists()) {
                        const rData = rDoc.data();
                        refereeDetails.push({
                            id: rid,
                            name: rData.displayName || 'Unknown',
                            tier: rData.tier || 'N/A'
                        });
                    }
                } catch (e) {
                    console.error("Error fetching referee details for assignment", e);
                }
            }
         }
         return {
            id: asgn.id,
            location: asgn.location,
            status: asgn.status, // Pass status through
            date: scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawDate: scheduledDate.toISOString(),
            refereeDetails, 
            isMissed
         };
      }));

    // Quick Overview
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startWeekEval = new Date(now);
    startWeekEval.setDate(now.getDate() - now.getDay());
    startWeekEval.setHours(0, 0, 0, 0);

    const thisMonth = evaluations.filter((e) => e.createdAt?.toDate() >= startOfMonth).length;
    
    // We can use the assignments stats for "this week" instead of evaluations if that's what the user wants,
    // but the prompt asked for "assignments this week".
    // I will map the new stats to the quickOverview object.
    
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
        thisMonth, // Evaluations this month (kept for legacy/context)
        completionRate: (assignmentsDoneThisWeek + assignmentsMissed + assignmentsToday) > 0 
            ? `${Math.round((assignmentsDoneThisWeek / (assignmentsDoneThisWeek + assignmentsMissed + assignmentsToday + assignmentsUpcoming)) * 100)}%` 
            : '0%',
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};