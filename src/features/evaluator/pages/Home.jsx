'use client';

import React, { useState, useEffect } from 'react';
import { IoBasketballOutline } from 'react-icons/io5';
import { FaStar, FaTrophy } from 'react-icons/fa';
import Link from 'next/link';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getDashboardData } from '@/features/evaluator/services/dashboardService';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const EvaluatorHome = () => {
  const { user } = useAuth();
  // Profile data state
  const [userData, setUserData] = useState({
    name: 'John',
    initials: 'JS',
  });
  
  // Dashboard data state
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalEvaluations: 0,
      averageRating: 0,
      topTierOfficials: 0,
    },
    recentEvaluations: [],
    quickOverview: { thisMonth: 0, thisWeek: 0, pendingReviews: 0, completionRate: '0%' },
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load profile data from localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem('evaluatorProfile');
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      setUserData({
        name: profile.name || 'John',
        initials: profile.initials || 'JS',
      });
    }
  }, []);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = () => {
      const savedProfile = localStorage.getItem('evaluatorProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setUserData({
          name: profile.name || 'John',
          initials: profile.initials || 'JS',
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

  // Fetch dashboard data
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        try {
          const data = await getDashboardData(user.uid);
          setDashboardData(data);
        } catch (error) {
          console.error('Failed to load dashboard data:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [user]);

  const statsCards = [
    {
      id: 1,
      icon: IoBasketballOutline,
      iconSize: 'w-11 h-11 lg:w-12 lg:h-12',
      label: 'Total\nEvaluations',
      value: dashboardData.stats.totalEvaluations,
    },
    {
      id: 2,
      icon: FaStar,
      iconSize: 'w-10 h-10 lg:w-11 lg:h-11',
      label: 'Average\nRating',
      value: dashboardData.stats.averageRating,
    },
    {
      id: 3,
      icon: FaTrophy,
      iconSize: 'w-10 h-10 lg:w-11 lg:h-11',
      label: 'Top Tier\nOfficials',
      value: dashboardData.stats.topTierOfficials,
    },
  ];

  const recentEvaluations = dashboardData.recentEvaluations;

  return (
    <div className='min-h-screen bg-[#181818] flex flex-col bg-gradient-secondary'>
      <EvaluatorHeader
        userName={userData.name}
        userInitials={userData.initials}
        showBackButton={true}
      />

      <div className='bg-gradient-primary rounded-tl-[60px] overflow-hidden'>
        <div className='rounded-tl-[60px] flex-1 overflow-hidden lg:rounded-tl-[80px]'>
          <main className='px-6 py-8 lg:px-8 lg:py-12'>
            <div className='max-w-md mx-auto lg:max-w-6xl'>
              {/* Welcome Section */}
              <div className='mb-8 lg:mb-10'>
                <h2 className='text-[32px] lg:text-[38px] font-bold text-white heading leading-none mb-2'>
                  Welcome {userData.name}
                </h2>
                <div className='text-[#FFFFFF]/60 text-[15px] lg:text-[16px] text-body'>
                  Ready to evaluate your next official?
                </div>
              </div>

              {/* Layout Container */}
              <div className='lg:grid lg:grid-cols-12 lg:gap-8'>
                {/* Main Content Area */}
                <div className='lg:col-span-8'>
                  {/* Stats Cards - 3 Column Grid */}
                  <div className='grid grid-cols-3 gap-3 mb-6 lg:gap-5 lg:mb-8'>
                    {statsCards.map((card) => {
                      const IconComponent = card.icon;
                      return (
                        <div
                          key={card.id}
                          className='bg-[#FFFFFF]/6 rounded-[20px] p-4 lg:p-6 flex flex-col items-center justify-center border border-[#FFFFFF]/20'
                        >
                          <div className='w-12 h-12 lg:w-14 lg:h-14 mb-3 lg:mb-4 flex items-center justify-center'>
                            <IconComponent
                              className={`${card.iconSize} text-white`}
                            />
                          </div>
                          <div className='text-[11px] lg:text-[13px] text-[#9ca3af] text-center mb-2 text-body leading-tight whitespace-pre-line'>
                            {card.label}
                          </div>
                          <div className='text-[28px] lg:text-[36px] font-bold text-white heading leading-none'>
                            {card.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* CTA Button - Mobile Only (appears here in mobile) */}
                  <Link
                    href='/evaluator/new-evaluation'
                    className='lg:hidden block bg-accent rounded-[20px] px-8 py-5 text-center mb-8 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg'
                  >
                    <div className='text-[22px] font-bold text-white heading mb-1 leading-tight'>
                      Start New Evaluation
                    </div>
                    <div className='text-[14px] text-white/90 text-body'>
                      Tap to evaluate an official in seconds
                    </div>
                  </Link>

                  {/* Recent Evaluations Section */}
                  <div>
                    <h3 className='text-[20px] lg:text-[24px] font-bold text-white heading mb-4 lg:mb-5'>
                      Recent Evaluations
                    </h3>

                    {/* Evaluations List */}
                    <div className='space-y-3 lg:space-y-3'>
                      {recentEvaluations.map((evaluation) => (
                        <div
                          key={evaluation.id}
                          className='bg-[#FFFFFF]/6 rounded-[20px] px-5 py-4 lg:px-5 lg:py-4 flex items-center border border-[#FFFFFF]/20 hover:bg-[#FFFFFF]/10 transition-all cursor-pointer'
                        >
                          {/* Left Side - Name and Date */}
                          <div className='flex-1 pr-4'>
                            <div className='text-[18px] lg:text-[19px] font-semibold text-white heading mb-0.5 leading-tight'>
                              {evaluation.name}
                            </div>
                            <div className='text-[13px] lg:text-[14px] text-[#9ca3af] text-body leading-tight'>
                              {evaluation.date}
                            </div>
                          </div>

                          {/* Vertical Divider */}
                          <div className='w-px h-12 lg:h-12 bg-[#FFFFFF]/6 mx-3 lg:mx-4'></div>

                          {/* Right Side - Score and Tier */}
                          <div className='flex items-center gap-2 min-w-[80px] lg:min-w-[90px]'>
                            <div className='text-base text-white heading leading-none'>
                              {evaluation.score}
                            </div>
                            <div className='bg-[#FFFFFF]/6 text-[#9ca3af] text-[11px] lg:text-[12px] font-medium px-3 py-1 lg:px-3 lg:py-1 rounded-full text-body border border-[#FFFFFF]/20 whitespace-nowrap'>
                              {evaluation.tier}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar - Desktop Only */}
                <div className='hidden lg:block lg:col-span-4'>
                  <div className='sticky top-8'>
                    {/* CTA Button - Desktop */}
                    <Link
                      href='/evaluator/new-evaluation'
                      className='block bg-accent rounded-[20px] px-8 py-6 text-center hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg'
                    >
                      <div className='text-[22px] font-bold text-white heading mb-1.5 leading-tight'>
                        Start New Evaluation
                      </div>
                      <div className='text-[15px] text-white/90 text-body'>
                        Tap to evaluate an official in seconds
                      </div>
                    </Link>

                    {/* Quick Stats Card - Desktop Only */}
                    <div className='mt-5 bg-[#FFFFFF]/6 rounded-[20px] p-5 border border-[#FFFFFF]/20'>
                      <div className='text-[18px] font-bold text-white heading mb-4'>
                        Quick Overview
                      </div>
                      <div className='space-y-3'>
                        <div className='flex justify-between items-center pb-3 border-b border-[#FFFFFF]/10'>
                          <div className='text-[#9ca3af] text-body text-[14px]'>
                            This Month
                          </div>
                          <div className='text-white font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.thisMonth}
                          </div>
                        </div>
                        <div className='flex justify-between items-center pb-3 border-b border-[#FFFFFF]/10'>
                          <div className='text-[#9ca3af] text-body text-[14px]'>
                            This Week
                          </div>
                          <div className='text-white font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.thisWeek}
                          </div>
                        </div>
                        <div className='flex justify-between items-center pb-3 border-b border-[#FFFFFF]/10'>
                          <div className='text-[#9ca3af] text-body text-[14px]'>
                            Pending Reviews
                          </div>
                          <div className='text-accent font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.pendingReviews}
                          </div>
                        </div>
                        <div className='flex justify-between items-center'>
                          <div className='text-[#9ca3af] text-body text-[14px]'>
                            Completion Rate
                          </div>
                          <div className='text-white font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.completionRate}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default EvaluatorHome;
