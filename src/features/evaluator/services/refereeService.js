import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const getReferees = async (evaluatorId) => {
  try {
    // 1. Fetch all referees
    const refereesQuery = query(
      collection(db, 'users'),
      where('role', '==', 'referee')
    );
    const refereesSnapshot = await getDocs(refereesQuery);
    const referees = refereesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 2. Fetch assignments if evaluatorId is present
    const assignmentMap = {};
    if (evaluatorId) {
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('evaluatorId', '==', evaluatorId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      
      const now = new Date();

      assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Handle Firestore Timestamp or string dates
        const scheduledDate = data.scheduledDate?.toDate ? data.scheduledDate.toDate() : new Date(data.scheduledDate);
        
        // Since an assignment can have multiple referees
        if (data.refereeIds && Array.isArray(data.refereeIds)) {
          data.refereeIds.forEach(refId => {
            if (!assignmentMap[refId]) {
                assignmentMap[refId] = [];
            }
            assignmentMap[refId].push({
                assignmentId: doc.id,
                location: data.location,
                dateTime: scheduledDate.toISOString(),
                rawDate: scheduledDate
            });
          });
        }
      });
    }

    // 3. Merge assignment data into referees
    return referees.map(ref => {
      let nextAssignment = null;
      if (assignmentMap[ref.id]) {
        // Sort assignments by date
        const assignments = assignmentMap[ref.id].sort((a, b) => a.rawDate - b.rawDate);
        
        // Find the next upcoming assignment
        const now = new Date();
        const upcoming = assignments.find(a => a.rawDate >= now);
        
        // Use upcoming assignment, or fall back to the most recent one if all are in the past
        nextAssignment = upcoming || assignments[assignments.length - 1];
      }

      return {
        ...ref,
        nextAssignment
      };
    });

  } catch (error) {
    console.error('Error fetching referees:', error);
    return [];
  }
};
