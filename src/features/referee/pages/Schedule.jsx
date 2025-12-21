'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import BackButton from '@/ui/BackButton';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FiCalendar, FiClock, FiMapPin, FiUser } from 'react-icons/fi';

const RefereeSchedulePage = () => {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [pastGames, setPastGames] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'past'

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/referee/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchGames = async () => {
      if (!userData) return;

      try {
        setLoading(true);
        const q = query(
          collection(db, 'assignments'),
          where('refereeIds', 'array-contains', userData.uid)
        );
        const snapshot = await getDocs(q);
        const allAssignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const upcoming = [];
        const past = [];

        // Need to fetch evaluator names potentially, or just store IDs. 
        // For simplicity, we'll fetch evaluators if needed, but assignments have evaluatorId.
        // Let's fetch all evaluators to map names.
        const evaluatorsQuery = query(collection(db, 'users'), where('role', '==', 'evaluator'));
        const evaluatorsSnap = await getDocs(evaluatorsQuery);
        const evaluatorsMap = {};
        evaluatorsSnap.docs.forEach(doc => {
            evaluatorsMap[doc.id] = doc.data().displayName;
        });

        allAssignments.forEach(game => {
             const gameDate = game.scheduledDate?.toDate ? game.scheduledDate.toDate() : new Date(game.scheduledDate);
             const gameWithDetails = {
                 ...game,
                 dateObj: gameDate,
                 evaluatorName: evaluatorsMap[game.evaluatorId] || 'Unknown'
             };

             if (gameDate >= now) {
                 upcoming.push(gameWithDetails);
             } else {
                 past.push(gameWithDetails);
             }
        });

        // Sort upcoming asc (soonest first)
        upcoming.sort((a, b) => a.dateObj - b.dateObj);
        // Sort past desc (most recent first)
        past.sort((a, b) => b.dateObj - a.dateObj);

        setUpcomingGames(upcoming);
        setPastGames(past);

      } catch (error) {
        console.error("Error fetching schedule:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [userData]);

  const displayedGames = activeTab === 'upcoming' ? upcomingGames : pastGames;

  const formatDate = (dateObj) => {
    if (!dateObj || isNaN(dateObj)) return 'TBD';
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateObj) => {
    if (!dateObj || isNaN(dateObj)) return 'TBD';
    return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const groupGamesByDate = (games) => {
    const groups = {};
    games.forEach(game => {
      const dateKey = formatDate(game.dateObj);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(game);
    });
    return groups;
  };

  const groupedGames = groupGamesByDate(displayedGames);
  // Sort keys based on the date of the first game in each group
  const sortedDates = Object.keys(groupedGames).sort((a, b) => {
     const dateA = groupedGames[a][0].dateObj;
     const dateB = groupedGames[b][0].dateObj;
     return activeTab === 'upcoming' ? dateA - dateB : dateB - dateA;
  });

  if (authLoading || (loading && userData)) {
      return (
        <div className='min-h-screen bg-[#0f0f0f] flex items-center justify-center'>
            <div className='w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin'></div>
        </div>
      );
  }
  
  if (!userData) return null;

  return (
    <div className='min-h-screen bg-[#0f0f0f] flex flex-col text-white'>
      <header className='bg-gradient-to-r from-[#c41414] via-[#b41313] to-[#8b0f0f] px-5 lg:px-10 pt-8 pb-7 shadow-lg sticky top-0 z-20'>
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-3'>
            <BackButton variant='light' className='shrink-0' />
            <h1 className='text-2xl font-semibold tracking-wide heading text-white'>
              My Schedule
            </h1>
          </div>
        </div>
      </header>

      <main className='flex-1 px-5 lg:px-10 py-6 bg-[#0f0f0f]'>
        <div className='max-w-3xl mx-auto w-full'>
            
            {/* Tabs */}
            <div className='flex p-1 bg-[#1b1b1b] rounded-xl mb-8 border border-[#2b2b2b]'>
                <button 
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-[#333] text-white shadow-sm' : 'text-[#9ca3af] hover:text-white'}`}
                >
                    Upcoming ({upcomingGames.length})
                </button>
                <button 
                    onClick={() => setActiveTab('past')}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'past' ? 'bg-[#333] text-white shadow-sm' : 'text-[#9ca3af] hover:text-white'}`}
                >
                    Past ({pastGames.length})
                </button>
            </div>

            {/* List */}
            <div className='space-y-8'>
                {displayedGames.length === 0 ? (
                    <div className='text-center py-16 text-[#9ca3af] bg-[#1b1b1b] rounded-3xl border border-[#2b2b2b] border-dashed flex flex-col items-center justify-center'>
                        <div className='w-16 h-16 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-4'>
                            <FiCalendar className='w-8 h-8 opacity-50' />
                        </div>
                        <p className='text-lg font-medium text-white mb-1'>No {activeTab} games</p>
                        <p className='text-sm opacity-60'>Check back later for updates</p>
                    </div>
                ) : (
                    sortedDates.map(dateKey => (
                        <div key={dateKey} className='space-y-3'>
                            <div className='sticky top-[88px] bg-[#0f0f0f]/95 backdrop-blur-sm py-3 z-10 flex items-center gap-3'>
                                <h3 className='text-[#f97316] font-semibold text-sm uppercase tracking-wider'>
                                    {dateKey}
                                </h3>
                                <div className='h-px bg-[#2b2b2b] flex-1'></div>
                            </div>
                            
                            <div className='grid gap-4'>
                                {groupedGames[dateKey].map(game => (
                                    <div key={game.id} className='group bg-[#1b1b1b] hover:bg-[#222] border border-[#2b2b2b] hover:border-[#f97316]/50 rounded-2xl p-5 transition-all duration-300 relative overflow-hidden'>
                                        <div className='absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#f97316] to-[#b41313] opacity-0 group-hover:opacity-100 transition-opacity'></div>
                                        
                                        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-2'>
                                            <div className='space-y-1'>
                                                <div className='flex items-center gap-2 text-white font-medium text-lg'>
                                                    <FiClock className='text-[#f97316] w-5 h-5' />
                                                    <span>{formatTime(game.dateObj)}</span>
                                                </div>
                                                <div className='flex items-center gap-2 text-[#9ca3af]'>
                                                    <FiMapPin className='w-4 h-4' />
                                                    <span>{game.location || 'TBD'}</span>
                                                </div>
                                            </div>

                                            <div className='flex items-center gap-3 bg-[#2a2a2a] p-2 pr-4 rounded-full border border-[#333] self-start sm:self-auto'>
                                                <div className='w-8 h-8 rounded-full bg-[#333] flex items-center justify-center text-[#f97316]'>
                                                    <FiUser className='w-4 h-4' />
                                                </div>
                                                <div className='flex flex-col'>
                                                    <span className='text-[10px] text-[#9ca3af] uppercase tracking-wider leading-none mb-0.5'>Evaluator</span>
                                                    <span className='text-sm font-medium text-white leading-none'>{game.evaluatorName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

        </div>
      </main>
    </div>
  );
};

export default RefereeSchedulePage;
