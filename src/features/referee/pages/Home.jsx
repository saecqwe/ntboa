'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin, PiSignOut } from 'react-icons/pi';
import BackButton from '@/ui/BackButton';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { db } from '@/services/firebase/config';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { logout } from '@/features/authentication/services/authService';
import { getScoresForReferee, getOfficialTotalScore } from '@/lib/evaluationUtils';

const RefereeDashboardPage = () => {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingGame, setUpcomingGame] = useState(null);
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    averageScore: 0,
    averageDelta: null,
    isDeltaPositive: true,
  });

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/referee/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/referee/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!userData) return;

    const now = new Date();

    // ── Real-time listener: Assignments ──────────────────────────────────────
    const qAssignments = query(
      collection(db, 'assignments'),
      where('refereeIds', 'array-contains', userData.uid)
    );

    const unsubscribeAssignments = onSnapshot(qAssignments, (assignSnap) => {
      const assignments = assignSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Find next upcoming game
      const futureAssignments = assignments
        .filter((a) => {
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
          location: next.location || 'TBD',
        });
      } else {
        setUpcomingGame(null);
      }

      setLoading(false);
    }, (err) => {
      console.error('Error in assignments listener:', err);
      setLoading(false);
    });

    // ── Real-time listener: Evaluations (published only; supports single & group crew evals) ─
    const qEvalsSingle = query(
      collection(db, 'evaluations'),
      where('refereeId', '==', userData.uid),
      where('isPublished', '==', true)
    );
    const qEvalsGroup = query(
      collection(db, 'evaluations'),
      where('refereeIds', 'array-contains', userData.uid),
      where('isPublished', '==', true)
    );

    let singleMap = new Map();
    let groupMap = new Map();

    const extractRefereeScore = (data) => {
      const refScores = getScoresForReferee(data, userData.uid);
      const hasCategoryNumbers =
        refScores &&
        typeof refScores === 'object' &&
        Object.values(refScores).some((v) => typeof v === 'number' && Number.isFinite(v));

      if (hasCategoryNumbers) {
        return getOfficialTotalScore(refScores);
      }

      const fallbackTop = Number(data.overallScore ?? data.totalScore ?? data.score);
      if (!Number.isFinite(fallbackTop) || fallbackTop <= 0) return 0;

      const isGroup = Boolean(
        data.isGroup ||
        (Array.isArray(data.officials) && data.officials.length > 1) ||
        (Array.isArray(data.refereeIds) && data.refereeIds.length > 1)
      );
      if (isGroup) {
        const count =
          (Array.isArray(data.officials) && data.officials.length) ||
          (Array.isArray(data.refereeIds) && data.refereeIds.length) ||
          1;
        return fallbackTop / count;
      }
      return fallbackTop;
    };

    const recalculateStats = () => {
      const evalsMap = new Map([...singleMap, ...groupMap]);
      const total = evalsMap.size;
      let sumScore = 0;
      evalsMap.forEach((data) => {
        sumScore += extractRefereeScore(data);
      });

      // Calculate real delta against previous average if at least 2 evaluations exist
      let realDelta = null;
      let isDeltaPositive = true;
      if (evalsMap.size >= 2) {
        const evalsList = Array.from(evalsMap.values()).sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        const latestScore = extractRefereeScore(evalsList[0]);
        const pastSum = evalsList.slice(1).reduce((acc, ev) => acc + extractRefereeScore(ev), 0);
        const pastAvg = pastSum / (evalsList.length - 1);
        if (pastAvg > 0) {
          const diff = ((latestScore - pastAvg) / pastAvg) * 100;
          isDeltaPositive = diff >= 0;
          realDelta = diff >= 0 ? `↑ +${diff.toFixed(1)}%` : `↓ ${diff.toFixed(1)}%`;
        }
      }

      setStats({
        totalEvaluations: total,
        averageScore: total > 0 ? (sumScore / total).toFixed(2) : 0,
        averageDelta: realDelta,
        isDeltaPositive,
      });
    };

    const unsubscribeEvalsSingle = onSnapshot(qEvalsSingle, (snap) => {
      const nextSingle = new Map();
      snap.forEach((docSnap) => nextSingle.set(docSnap.id, docSnap.data()));
      singleMap = nextSingle;
      recalculateStats();
    }, (err) => console.error('Error in evaluations single listener:', err));

    const unsubscribeEvalsGroup = onSnapshot(qEvalsGroup, (snap) => {
      const nextGroup = new Map();
      snap.forEach((docSnap) => nextGroup.set(docSnap.id, docSnap.data()));
      groupMap = nextGroup;
      recalculateStats();
    }, (err) => console.error('Error in evaluations group listener:', err));

    return () => {
      unsubscribeAssignments();
      unsubscribeEvalsSingle();
      unsubscribeEvalsGroup();
    };
  }, [userData]);

  // Derived display values
  const {
    totalEvaluations,
    averageScore,
    averageDelta,
    isDeltaPositive,
  } = stats;

  // Inverted Texas high school tier ranking: Tier 100 is highest varsity rank, Tier 800 is entry-level
  const parseTierNumber = (tierValue) => {
    if (!tierValue) return 200;
    const num = parseInt(String(tierValue).replace(/\D/g, ''), 10);
    return isNaN(num) ? 200 : num;
  };
  const currentTierNum = parseTierNumber(userData?.tier || userData?.ranking || 'Tier 200');
  const clampedProgress = Math.min(
    Math.max(((800 - currentTierNum) / (800 - 100)) * 100, 8),
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
      detail: averageDelta ? (
        <span className={`text-[14px] font-semibold mb-2 ${isDeltaPositive ? 'text-[#3fd07b]' : 'text-rose-400'}`}>
          {averageDelta}
        </span>
      ) : null,
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
      <header className='bg-gradient-to-r from-[#c41414] via-[#b41313] to-[#8b0f0f] px-5 lg:px-10 pt-6 pb-5 shadow-lg'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            {/* <BackButton variant='light' className='shrink-0' /> */}
            <div className='w-12 h-12 rounded-full bg-white/15 flex items-center justify-center'>
              <PiGlobeSimpleThin className='w-6 h-6 text-white' />
            </div>

            <button
              type='button'
              onClick={handleLogout}
              className='w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all cursor-pointer'
              title="Logout"
              aria-label="Logout"
            >
              <PiSignOut className='w-6 h-6 text-red-200' />
            </button>

            <p className='text-2xl font-semibold tracking-wide heading text-white'>
              NTBOA
            </p>
          </div>
          <Link
            href='/referee/profile'
            className='w-12 h-12 rounded-full bg-white/15 flex items-center justify-center text-base font-semibold heading text-white transition-all hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white overflow-hidden'
            aria-label='Open profile'
          >
            {(userData.photoURL || userData.photo) ? (
              <img
                src={userData.photoURL || userData.photo}
                alt='Profile'
                className='w-full h-full object-cover'
              />
            ) : (
              (userData.displayName || userData.name) ? (userData.displayName || userData.name).substring(0, 2).toUpperCase() : 'RF'
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

      <main className='flex-1 px-5 lg:px-10 py-6 pb-20 bg-[#0f0f0f]'>
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
                  <span className='text-white/60 shrink-0'>Location :</span>
                  <span
                    className='text-white font-medium text-right truncate min-w-0'
                    title={upcomingGame.location}
                  >
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
                    <p className='text-[48px] font-bold heading text-white tabular-nums'>
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
                  {userData.tier || `Tier ${currentTierNum}`}
                </span>
              </div>
              <div className='h-3 w-full bg-[#262626] rounded-full overflow-hidden'>
                <div
                  className='h-full bg-[#f1882a] rounded-full'
                  style={{ width: `${clampedProgress}%` }}
                ></div>
              </div>
              <div className='flex justify-between text-xs text-white/60 uppercase tracking-wide heading'>
                <span>Tier 800</span>
                <span>Tier 100</span>
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
