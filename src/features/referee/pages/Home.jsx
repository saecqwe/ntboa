'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import BackButton from '@/ui/BackButton';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

const RefereeDashboardPage = () => {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingGame, setUpcomingGame] = useState(null);
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    averageScore: 0,
    averageDelta: '+0.0%', // Placeholder calculation
    tierProgress: 0,
    tierMin: 0,
    tierMax: 500 // Example max
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/referee/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userData) {
          // Wait for auth
          return; 
      }
      
      try {
        setLoading(true);
        
        // 1. Fetch Assignments for Upcoming Game
        const qAssignments = query(
          collection(db, 'assignments'), 
          where('refereeIds', 'array-contains', userData.uid)
        );
        const assignSnap = await getDocs(qAssignments);
        const assignments = assignSnap.docs.map(d => ({id: d.id, ...d.data()}));
        
        // Find next upcoming
        const now = new Date();
        const futureAssignments = assignments
          .filter(a => {
            const d = a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
            return d > now;
          })
          .sort((a, b) => {
             const dA = a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
             const dB = b.scheduledDate?.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
             return dA - dB;
          });
          
        if (futureAssignments.length > 0) {
            const next = futureAssignments[0];
            const d = next.scheduledDate?.toDate ? next.scheduledDate.toDate() : new Date(next.scheduledDate);
            setUpcomingGame({
                date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                location: next.location || 'TBD'
            });
        } else {
            setUpcomingGame(null);
        }

        // 2. Fetch Evaluations for Stats
        const qEvals = query(collection(db, 'evaluations'), where('refereeId', '==', userData.uid));
        const evalSnap = await getDocs(qEvals);
        const total = evalSnap.size;
        let sumScore = 0;
        evalSnap.forEach(doc => {
            const data = doc.data();
            // Assuming score is 0-10 or 0-100. Adjust based on your evaluation schema.
            // If overallScore is not present, check for average of categories.
            sumScore += (data.overallScore || data.totalScore || 0); 
        });
        
        // Tier Logic (Mockup based on userData or calculated)
        // You might want to store current tier points in userData
        const currentTierPoints = userData.tierPoints || 150; 

        setStats({
            totalEvaluations: total,
            averageScore: total > 0 ? (sumScore / total).toFixed(2) : 0,
            averageDelta: '+1.2%', // This requires historical comparison, leaving static for now or can be 0
            tierProgress: currentTierPoints,
            tierMin: 100, // Example
            tierMax: 300  // Example
        });

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userData]);

  // Derived display values
  const {
    totalEvaluations,
    averageScore,
    averageDelta,
    tierProgress,
    tierMin,
    tierMax,
  } = stats;

  const clampedProgress = Math.min(
    Math.max(((tierProgress - tierMin) / (tierMax - tierMin)) * 100, 0),
    100
  );

  const summaryCards = [
    {
      icon: '≋',
      label: 'Total Evaluations',
      value: totalEvaluations,
    },
    {
      icon: '★',
      label: 'Average Score',
      value: averageScore,
      detail: (
        <span className='text-[14px] font-semibold text-[#3fd07b] mb-2'>
          ↑ {averageDelta}
        </span>
      ),
    },
  ];

  if (authLoading || (!userData && loading)) {
      return (
        <div className='min-h-screen bg-[#0f0f0f] flex items-center justify-center'>
            <div className='w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin'></div>
        </div>
      );
  }

  // Fallback if userData is null (e.g. forced navigation without auth, though Login should prevent this)
  if (!userData) return null;

  return (
    <div className='min-h-screen bg-[#0f0f0f] flex flex-col text-white'>
      <header className='bg-gradient-to-r from-[#c41414] via-[#b41313] to-[#8b0f0f] px-5 lg:px-10 pt-8 pb-7 shadow-lg'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            {/* <BackButton variant='light' className='shrink-0' /> */}
            <div className='w-12 h-12 rounded-full bg-white/15 flex items-center justify-center'>
              <PiGlobeSimpleThin className='w-6 h-6 text-white' />
            </div>
            <p className='text-2xl font-semibold tracking-wide heading text-white'>
              NTBOA
            </p>
          </div>
          <Link
            href='/referee/profile'
            className='w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-base font-semibold heading text-white transition-all hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white overflow-hidden'
            aria-label='Open profile'
          >
            {userData.photoURL ? (
              <img
                src={userData.photoURL}
                alt='Profile'
                className='w-full h-full object-cover'
              />
            ) : (
              userData.displayName ? userData.displayName.substring(0, 2).toUpperCase() : 'RF'
            )}
          </Link>
        </div>
        <div className='border-t border-white/20 pt-4 text-center'>
          <p className='text-base text-white/90 heading mb-1'>
            Welcome, {userData.displayName || 'Referee'}!
          </p>
          <p className='text-lg font-semibold heading text-white'>
            Here&apos;s your performance overview
          </p>
        </div>
      </header>

      <main className='flex-1 px-5 lg:px-10 py-6 bg-[#0f0f0f]'>
        <div className='max-w-5xl mx-auto w-full space-y-4 lg:space-y-6'>
          <section className='bg-[#1b1b1b] rounded-[24px] p-5 border border-[#2b2b2b] shadow-[0px_12px_30px_rgba(0,0,0,0.35)]'>
            <div className='flex items-center justify-between mb-3'>
                <p className='text-[#f1882a] text-[14px] heading font-semibold'>
                Upcoming Game
                </p>
                <Link href='/referee/schedule' className='text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-all'>
                    View Schedule
                </Link>
            </div>
            {upcomingGame ? (
                <div className='space-y-2 text-[13px] text-white/70 text-body'>
                <div className='flex justify-between'>
                    <span className='text-white/60'>Date / Time :</span>
                    <span className='text-white font-medium'>
                    {upcomingGame.date}, {upcomingGame.time}
                    </span>
                </div>
                <div className='flex justify-between gap-3'>
                    <span className='text-white/60'>Location :</span>
                    <span className='text-white font-medium text-right'>
                    {upcomingGame.location}
                    </span>
                </div>
                </div>
            ) : (
                <div className='text-[13px] text-white/50 text-center py-2'>
                    No upcoming games scheduled.
                </div>
            )}
          </section>

          <div className='space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6'>
            {summaryCards.map(({ icon, label, value, detail }) => (
              <section
                key={label}
                className='bg-[#1b1b1b] rounded-[32px] px-6 py-7 border border-[#2b2b2b] shadow-[0px_12px_30px_rgba(0,0,0,0.35)] h-full'
              >
                <div className='flex flex-col items-center gap-3 text-center'>
                  <div className='text-[#f1882a] text-2xl'>{icon}</div>
                  <p className='text-white/80 text-[15px] font-medium heading'>
                    {label}
                  </p>
                  <div className='flex items-end gap-3'>
                    <p className='text-[48px] font-bold heading text-white'>
                      {value}
                    </p>
                    {detail}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className='space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1.1fr,0.9fr] lg:gap-6'>
            <section className='bg-[#1b1b1b] rounded-[24px] px-5 py-6 border border-[#2b2b2b] shadow-[0px_12px_30px_rgba(0,0,0,0.35)] space-y-4 h-full'>
              <div className='flex items-center justify-between'>
                <p className='text-white/80 text-[15px] font-medium heading'>
                  Tier Progression
                </p>
                <span className='text-sm font-semibold text-[#bfa568] heading'>
                  {tierProgress}
                </span>
              </div>
              <div className='h-3 w-full bg-[#262626] rounded-full overflow-hidden'>
                <div
                  className='h-full bg-[#f1882a] rounded-full'
                  style={{ width: `${clampedProgress}%` }}
                ></div>
              </div>
              <div className='flex justify-between text-xs text-white/60 uppercase tracking-wide heading'>
                <span>Tier {tierMax}</span>
                <span>Tier {tierMin}</span>
              </div>
            </section>

            <section className='bg-[#1b1b1b] rounded-[32px] px-6 py-7 border border-[#2b2b2b] shadow-[0px_12px_30px_rgba(0,0,0,0.35)] flex flex-col items-center justify-center text-center h-full'>
              <div className='text-[#f1882a] text-2xl'>🛡️</div>
              <p className='text-white/80 text-[15px] font-medium heading mt-3'>
                Current Tier
              </p>
              <div className='inline-flex items-center justify-center px-8 py-2 rounded-full bg-[#f1882a] text-base font-semibold heading text-white mt-4'>
                {userData.tier || 'N/A'}
              </div>
            </section>
          </div>

          <p className='text-center text-sm text-white/70 heading'>
            Keep up the great work, your consistency drives success!
          </p>

          <div className='w-20 h-1 bg-white/10 rounded-full mx-auto'></div>
        </div>
      </main>
    </div>
  );
};

export default RefereeDashboardPage;
