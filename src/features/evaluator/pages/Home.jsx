'use client';

import React, { useState, useEffect } from 'react';
import { IoBasketballOutline, IoPlay, IoCalendar, IoTime, IoCheckmarkCircle, IoAlertCircle } from 'react-icons/io5';
import { FaStar, FaTrophy } from 'react-icons/fa';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getDashboardData } from '@/features/evaluator/services/dashboardService';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const EvaluatorHome = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('upcoming'); // Default to upcoming/today view
  
  // Profile data state
  const [userData, setUserData] = useState({
    name: 'John',
    initials: 'JS',
  });
  
  // Dashboard data state
  const [dashboardData, setDashboardData] = useState({
    stats: {
      assignmentsToday: 0,
      assignmentsUpcoming: 0,
      assignmentsDoneThisWeek: 0,
      assignmentsMissed: 0,
    },
    recentEvaluations: [],
    relevantAssignments: [],
    quickOverview: { thisMonth: 0, completionRate: '0%' },
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
      filterKey: 'today',
      icon: IoCalendar,
      label: 'Today',
      value: dashboardData.stats.assignmentsToday,
      gradient: 'from-blue-500 to-blue-600',
      shadow: 'shadow-blue-500/20',
      border: 'border-blue-400/30'
    },
    {
      id: 2,
      filterKey: 'upcoming',
      icon: IoTime,
      label: 'Upcoming',
      value: dashboardData.stats.assignmentsUpcoming,
      gradient: 'from-violet-500 to-violet-600',
      shadow: 'shadow-violet-500/20',
      border: 'border-violet-400/30'
    },
    {
      id: 3,
      filterKey: 'done',
      icon: IoCheckmarkCircle,
      label: 'Done (Week)',
      value: dashboardData.stats.assignmentsDoneThisWeek,
      gradient: 'from-emerald-500 to-emerald-600',
      shadow: 'shadow-emerald-500/20',
      border: 'border-emerald-400/30'
    },
    {
      id: 4,
      filterKey: 'missed',
      icon: IoAlertCircle,
      label: 'Missed',
      value: dashboardData.stats.assignmentsMissed,
      gradient: 'from-rose-500 to-rose-600',
      shadow: 'shadow-rose-500/20',
      border: 'border-rose-400/30'
    },
  ];

  const getFilteredAssignments = () => {
    if (!dashboardData.relevantAssignments) return [];
    
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    return dashboardData.relevantAssignments.filter(asgn => {
       const date = new Date(asgn.rawDate);
       
       switch(activeFilter) {
           case 'today':
               return date >= todayStart && date <= todayEnd && asgn.status !== 'completed';
           case 'upcoming':
               // "Upcoming" usually implies future, but practically users want to see everything coming up including today.
               // But strictly separating them:
               return date > todayEnd && asgn.status !== 'completed';
           case 'done':
               return asgn.status === 'completed';
           case 'missed':
               return asgn.isMissed;
           default:
               return true;
       }
    });
  };

  const filteredAssignments = getFilteredAssignments();

  const recentEvaluations = dashboardData.recentEvaluations;

  const handleStartEvaluation = (assignment) => {
    const officials = assignment.refereeDetails.map(ref => ({
        id: ref.id,
        name: ref.name,
        tier: ref.tier,
        assignmentId: assignment.id,
        location: assignment.location,
        date: assignment.rawDate,
        time: assignment.time
    }));
    
    // Determine if this should be a group evaluation
    // If more than 1 official, it is always a group evaluation
    const isGroup = officials.length > 1;
    
    // If location is present in assignment, skip GameContext
    if (assignment.location) {
        const url = `/evaluator/evaluation-form?officials=${encodeURIComponent(JSON.stringify(officials))}&isGroup=${isGroup}&location=${encodeURIComponent(assignment.location)}`;
        router.push(url);
    } else {
        const url = `/evaluator/game-context?officials=${encodeURIComponent(JSON.stringify(officials))}&isGroup=${isGroup}`;
        router.push(url);
    }
  };

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
                  {/* Stats Cards - Interactive Filters */}
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 lg:gap-4 lg:mb-8'>
                    {statsCards.map((card) => {
                      const IconComponent = card.icon;
                      const isActive = activeFilter === card.filterKey;
                      
                      return (
                        <button
                          key={card.id}
                          onClick={() => setActiveFilter(isActive ? 'all' : card.filterKey)}
                          className={`relative overflow-hidden rounded-[24px] p-5 flex flex-col items-start justify-between min-h-[140px] transition-all duration-300 border ${isActive ? `ring-2 ring-white/50 scale-[1.02] ${card.border}` : 'border-[#FFFFFF]/10 hover:border-[#FFFFFF]/30 hover:-translate-y-1'}`}
                        >
                          {/* Background Gradient */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} ${isActive ? 'opacity-100' : 'opacity-10'} transition-opacity duration-300`} />
                          
                          {/* Content */}
                          <div className="relative z-10 w-full flex justify-between items-start">
                             <div className={`p-2.5 rounded-2xl ${isActive ? 'bg-white/20 text-white' : 'bg-[#FFFFFF]/10 text-gray-400'} backdrop-blur-sm transition-colors`}>
                                <IconComponent className="w-6 h-6" />
                             </div>
                             {isActive && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                          </div>
                          
                          <div className="relative z-10 mt-auto">
                            <div className={`text-[32px] font-bold leading-none mb-1 ${isActive ? 'text-white' : 'text-white'}`}>
                                {card.value}
                            </div>
                            <div className={`text-[13px] font-medium tracking-wide ${isActive ? 'text-white/90' : 'text-[#9ca3af]'}`}>
                                {card.label}
                            </div>
                          </div>
                        </button>
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

                  {/* Pending Assignments Section */}
                  <div className='mb-8'>
                    <div className='flex items-center justify-between mb-4 lg:mb-5'>
                      <h3 className='text-[20px] lg:text-[24px] font-bold text-white heading'>
                        Your Assignments
                      </h3>
                    </div>

                    <div className='space-y-3 lg:space-y-3'>
                      {filteredAssignments && filteredAssignments.length > 0 ? (
                        filteredAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className={`bg-[#FFFFFF]/6 rounded-[20px] px-5 py-4 lg:px-5 lg:py-4 flex flex-col border transition-all ${assignment.isMissed ? 'border-red-500/30' : 'border-[#FFFFFF]/20'}`}
                          >
                             <div className='flex justify-between items-start mb-2'>
                                <div className='flex items-center gap-2'>
                                    <div className='text-[16px] font-semibold text-white heading'>
                                    {assignment.location}
                                    </div>
                                    {assignment.isMissed && (
                                        <span className='bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded font-bold uppercase'>
                                            Missed
                                        </span>
                                    )}
                                </div>
                                <div className='text-[13px] text-accent bg-accent/10 px-2 py-1 rounded-lg border border-accent/20'>
                                   {assignment.time}
                                </div>
                             </div>
                             <div className='flex justify-between items-center mb-3'>
                                <div className='text-[14px] text-[#9ca3af] text-body'>
                                   {assignment.date}
                                </div>
                                <div className='text-[13px] text-white/80 text-body truncate max-w-[50%] text-right'>
                                   {assignment.refereeDetails.map(r => r.name).join(', ')}
                                </div>
                             </div>
                             
                             <button 
                                onClick={() => handleStartEvaluation(assignment)}
                                className='w-full bg-accent/20 hover:bg-accent hover:text-white text-accent border border-accent/50 rounded-xl py-2 flex items-center justify-center gap-2 transition-all font-semibold text-sm'
                             >
                                <IoPlay /> Start Evaluation
                             </button>
                          </div>
                        ))
                      ) : (
                        <div className='text-center py-8 text-gray-500 bg-[#FFFFFF]/6 rounded-[20px] border border-[#FFFFFF]/20'>
                          No pending assignments
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Evaluations Section */}
                  <div>
                    <div className='flex items-center justify-between mb-4 lg:mb-5'>
                      <h3 className='text-[20px] lg:text-[24px] font-bold text-white heading'>
                        Recent Evaluations
                      </h3>
                      <Link 
                        href='/evaluator/evaluations'
                        className='text-[14px] font-medium text-accent hover:text-accent/80 transition-colors'
                      >
                        View All
                      </Link>
                    </div>

                    {/* Evaluations List */}
                    <div className='space-y-3 lg:space-y-3'>
                      {recentEvaluations.length > 0 ? (
                        recentEvaluations.map((evaluation) => (
                          <Link
                            href={`/evaluator/evaluation/${evaluation.id}`}
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
                          </Link>
                        ))
                      ) : (
                        <div className='text-center py-8 text-gray-500 bg-[#FFFFFF]/6 rounded-[20px] border border-[#FFFFFF]/20'>
                          No recent evaluations
                        </div>
                      )}
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
                            Assignments This Week
                          </div>
                          <div className='text-white font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.assignmentsThisWeek}
                          </div>
                        </div>
                        <div className='flex justify-between items-center pb-3 border-b border-[#FFFFFF]/10'>
                          <div className='text-[#9ca3af] text-body text-[14px]'>
                            Completed (Done)
                          </div>
                          <div className='text-accent font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.assignmentsDone}
                          </div>
                        </div>
                        <div className='flex justify-between items-center pb-3 border-b border-[#FFFFFF]/10'>
                          <div className='text-[#9ca3af] text-body text-[14px]'>
                            Missed (Late &gt; 60m)
                          </div>
                          <div className='text-red-500 font-bold heading text-[16px]'>
                            {dashboardData.quickOverview.assignmentsMissed}
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
