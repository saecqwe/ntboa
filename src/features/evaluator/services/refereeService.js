import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const getReferees = async () => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'referee')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });
  } catch (error) {
    console.error('Error fetching referees:', error);
    return [];
  }
};