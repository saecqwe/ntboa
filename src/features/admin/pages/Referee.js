'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminSidebar from '@/components/layout/AdminSidebar';
import BackButton from '@/components/ui/BackButton';
import { HiMenu, HiArrowLeft } from 'react-icons/hi';

const RefereeDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock data for referee
  const referee = {
    id: params.id,
    name: 'Michael Johnson',
    email: 'mjohnson@ntboa.org',
    currentTier: 'Tier 150',
    avgScore: '37.0',
    totalEvaluations: 1,
    evaluators: 1,
  };

  // Stats configuration
  const stats = [
    {
      id: 'tier',
      label: 'Current Tier',
      value: referee.currentTier,
      type: 'badge',
    },
    {
      id: 'score',
      label: 'Average Score',
      value: referee.avgScore,
      suffix: '/40',
      type: 'number',
    },
    {
      id: 'evaluations',
      label: 'Total Evaluations',
      value: referee.totalEvaluations,
      subtitle: 'completed',
      type: 'number',
    },
    {
      id: 'evaluators',
      label: 'Evaluators',
      value: referee.evaluators,
      subtitle: 'assigned',
      type: 'number',
    },
  ];

  // Mock evaluation data
  const evaluations = [
    {
      id: 1,
      date: 'Oct 27, 2025',
      evaluatorName: 'John Smith',
      totalScore: '37/40',
      tierAssigned: 'Tier 150',
      comment: 'Excellent command of the court',
    },
  ];

  // Handler for viewing evaluation details
  const handleViewMore = (evaluationId) => {
    // Navigate to evaluation detail page
    router.push(`/admin/evaluations/${evaluationId}`);
  };

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className='flex-1 lg:ml-64'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-4 lg:px-8 lg:py-6 flex items-center gap-4'>
          <BackButton variant='solid' className='shrink-0' />
          {/* Hamburger Menu - Mobile Only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-3xl font-semibold text-white heading'>
            All Evaluations
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            {/* Referee Info Banner */}
            <div className='bg-accent  rounded-[20px] px-6 py-6 mb-6'>
              <h2 className='text-fluid-3xl font-bold text-white heading mb-1'>
                {referee.name}
              </h2>
              <p className='text-fluid-base text-white/80 text-body'>
                {referee.email}
              </p>
            </div>

            {/* Stats Row - Continuous Orange Background */}
            <div className='mb-6'>
              <div className='p-4 border border-[#3a3a3a] rounded-[20px] overflow-hidden'>
                <div className='grid grid-cols-2 lg:grid-cols-4 bg-accent overflow-hidden rounded-[20px]'>
                  {stats.map((stat, index) => (
                    <div
                      key={stat.id}
                      className={`p-6 lg:p-8 bg-[#2a2a2a] relative ${
                        index === 1 || index === 3 ? 'ml-[3px]' : ''
                      } ${
                        index === 2 || index === 3 ? 'mt-[3px] lg:mt-0' : ''
                      } ${index === 1 ? 'lg:ml-[3px]' : ''} ${
                        index === 2 ? 'lg:ml-[3px]' : ''
                      }`}
                    >
                      <div
                        className={`text-fluid-base text-[#9ca3af] text-body ${
                          stat.type === 'badge' ? 'mb-3' : 'mb-2'
                        }`}
                      >
                        {stat.label}
                      </div>

                      {stat.type === 'badge' ? (
                        <span className='inline-block px-5 py-2 rounded-full text-fluid-base font-semibold bg-[#e5e7eb] text-[#374151]'>
                          {stat.value}
                        </span>
                      ) : (
                        <>
                          <div className='text-fluid-4xl font-bold text-white heading mb-1'>
                            {stat.value}
                            {stat.suffix && (
                              <span className='text-fluid-2xl text-[#6b7280]'>
                                {stat.suffix}
                              </span>
                            )}
                          </div>
                          {stat.subtitle && (
                            <div className='text-fluid-sm text-[#6b7280] text-body'>
                              {stat.subtitle}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Evaluations Table */}
            <div className='bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a] mb-6'>
              <h2 className='text-fluid-xl font-semibold text-white text-body mb-4 lg:mb-6'>
                Recent Evaluations
              </h2>

              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-[#3a3a3a]'>
                      <th className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                        DATE
                      </th>
                      <th className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                        EVALUATOR NAME
                      </th>
                      <th className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                        TOTAL SCORE
                      </th>
                      <th className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                        TIER ASSIGNED
                      </th>
                      <th className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                        COMMENT
                      </th>
                      <th className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((evaluation) => (
                      <tr
                        key={evaluation.id}
                        className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors'
                      >
                        <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body whitespace-nowrap'>
                          {evaluation.date}
                        </td>
                        <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body whitespace-nowrap'>
                          {evaluation.evaluatorName}
                        </td>
                        <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body font-medium whitespace-nowrap'>
                          {evaluation.totalScore}
                        </td>
                        <td className='py-3 lg:py-4 px-2 lg:px-4'>
                          <span className='inline-block px-4 py-1.5 rounded-full text-[11px] lg:text-[13px] font-semibold whitespace-nowrap bg-[#e5e7eb] text-[#374151]'>
                            {evaluation.tierAssigned}
                          </span>
                        </td>
                        <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body max-w-[200px] truncate'>
                          {evaluation.comment}
                        </td>
                        <td className='py-3 lg:py-4 px-2 lg:px-4'>
                          <button
                            onClick={() => handleViewMore(evaluation.id)}
                            className='text-[12px] lg:text-[14px] text-[#fbbf24] hover:text-[#f59e0b] font-medium transition-colors cursor-pointer'
                          >
                            View More
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className='flex items-center gap-2 text-white hover:text-[#9ca3af] transition-colors text-fluid-base text-body'
            >
              <HiArrowLeft className='w-5 h-5' />
              Back to Referees List
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RefereeDetailPage;
