'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import BackButton from '@/components/ui/BackButton';

const RefereeDashboardPage = () => {
  const [profileData, setProfileData] = useState({
    name: 'Michael',
    initials: 'MC',
    tier: 'Tier 150',
    photo: null,
  });

  // Load profile data from localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem('refereeProfile');
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      setProfileData({
        name: profile.name || 'Michael',
        initials: profile.initials || 'MC',
        tier: profile.tier || 'Tier 150',
        photo: profile.photo,
      });
    }
  }, []);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = () => {
      const savedProfile = localStorage.getItem('refereeProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setProfileData({
          name: profile.name || 'Michael',
          initials: profile.initials || 'MC',
          tier: profile.tier || 'Tier 150',
          photo: profile.photo,
        });
      }
    };

    window.addEventListener('storage', handleProfileUpdate);
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('storage', handleProfileUpdate);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const referee = profileData;

  const upcomingGame = {
    date: '22 Oct, 2025',
    time: '2:30 PM',
    location: 'Dubai International Cricket Stadium',
  };

  const performanceStats = {
    totalEvaluations: 128,
    averageScore: 8.75,
    averageDelta: '+1.2%',
    tierProgress: 150,
    tierMin: 100,
    tierMax: 300,
  };

  const {
    totalEvaluations,
    averageScore,
    averageDelta,
    tierProgress,
    tierMin,
    tierMax,
  } = performanceStats;

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

  return (
    <div className='min-h-screen bg-[#0f0f0f] flex flex-col text-white'>
      <header className='bg-gradient-to-r from-[#c41414] via-[#b41313] to-[#8b0f0f] px-5 lg:px-10 pt-8 pb-7 shadow-lg'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <BackButton variant='light' className='shrink-0' />
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
            {referee.photo ? (
              <img
                src={referee.photo}
                alt='Profile'
                className='w-full h-full object-cover'
              />
            ) : (
              referee.initials
            )}
          </Link>
        </div>
        <div className='border-t border-white/20 pt-4 text-center'>
          <p className='text-base text-white/90 heading mb-1'>
            Welcome, {referee.name}!
          </p>
          <p className='text-lg font-semibold heading text-white'>
            Here&apos;s your performance overview
          </p>
        </div>
      </header>

      <main className='flex-1 px-5 lg:px-10 py-6 bg-[#0f0f0f]'>
        <div className='max-w-5xl mx-auto w-full space-y-4 lg:space-y-6'>
          <section className='bg-[#1b1b1b] rounded-[24px] p-5 border border-[#2b2b2b] shadow-[0px_12px_30px_rgba(0,0,0,0.35)]'>
            <p className='text-[#f1882a] text-[14px] heading font-semibold mb-3'>
              Upcoming Game
            </p>
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
                {referee.tier}
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
