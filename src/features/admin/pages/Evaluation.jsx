'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminSidebar from '@/components/layout/AdminSidebar';
import BackButton from '@/components/ui/BackButton';
import { HiMenu, HiArrowLeft } from 'react-icons/hi';

const EvaluationDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock data for evaluation detail based on ID
  const evaluation = {
    id: params.id,
    date: 'October 27, 2025',
    time: '7:30 PM',
    location: 'Madison Square Garden',
    gameDetails: 'Lakers vs Knicks - Regular Season',
    referee: {
      name: 'Michael Johnson',
      email: 'mjohnson@ntboa.org',
      tier: 'Tier 150',
    },
    evaluator: {
      name: 'John Smith',
      email: 'jsmith@ntboa.org',
    },
    scores: {
      courtPresence: 9,
      communication: 8,
      gameManagement: 9,
      rulesKnowledge: 8,
      physicalFitness: 7,
      professionalism: 9,
    },
    totalScore: 37,
    maxScore: 40,
    tierAssigned: 'Tier 150',
    comments:
      'Excellent command of the court. Strong communication with players and coaches. Demonstrated solid understanding of game flow and made accurate calls consistently throughout the game. Physical conditioning was good, maintained proper positioning. Professional demeanor maintained at all times.',
    recommendations:
      'Continue current performance level. Consider working on positioning during fast breaks to maintain optimal viewing angles.',
    submittedAt: '2025-10-27T22:15:00Z',
  };

  const scoreCategories = [
    { label: 'Court Presence', key: 'courtPresence', max: 7 },
    { label: 'Communication', key: 'communication', max: 7 },
    { label: 'Game Management', key: 'gameManagement', max: 7 },
    { label: 'Rules Knowledge', key: 'rulesKnowledge', max: 7 },
    { label: 'Physical Fitness', key: 'physicalFitness', max: 6 },
    { label: 'Professionalism', key: 'professionalism', max: 6 },
  ];

  const getScoreColor = (score, max) => {
    const percentage = (score / max) * 100;
    if (percentage >= 85) return 'text-green-500';
    if (percentage >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBackground = (score, max) => {
    const percentage = (score / max) * 100;
    if (percentage >= 85) return 'bg-green-500/10';
    if (percentage >= 70) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
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
            Evaluation Details
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto space-y-6'>
            {/* Evaluation Overview */}
            <div className='bg-accent rounded-[20px] px-6 py-6'>
              <h2 className='text-fluid-2xl font-bold text-white heading mb-4'>
                Evaluation #{evaluation.id}
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-white/90'>
                <div>
                  <div className='text-sm text-white/70'>Date & Time</div>
                  <div className='font-semibold'>{evaluation.date}</div>
                  <div className='text-sm'>{evaluation.time}</div>
                </div>
                <div>
                  <div className='text-sm text-white/70'>Location</div>
                  <div className='font-semibold'>{evaluation.location}</div>
                </div>
                <div>
                  <div className='text-sm text-white/70'>Game</div>
                  <div className='font-semibold'>{evaluation.gameDetails}</div>
                </div>
                <div>
                  <div className='text-sm text-white/70'>Total Score</div>
                  <div className='font-bold text-2xl'>
                    {evaluation.totalScore}/{evaluation.maxScore}
                  </div>
                </div>
              </div>
            </div>

            {/* Referee & Evaluator Info */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Referee Info */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
                <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                  Referee
                </h3>
                <div className='space-y-3'>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Name</div>
                    <div className='text-white font-semibold'>
                      {evaluation.referee.name}
                    </div>
                  </div>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Email</div>
                    <div className='text-white'>{evaluation.referee.email}</div>
                  </div>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Current Tier</div>
                    <span className='inline-block px-3 py-1 rounded-full text-sm font-semibold bg-[#e5e7eb] text-[#374151]'>
                      {evaluation.referee.tier}
                    </span>
                  </div>
                </div>
              </div>

              {/* Evaluator Info */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
                <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                  Evaluator
                </h3>
                <div className='space-y-3'>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Name</div>
                    <div className='text-white font-semibold'>
                      {evaluation.evaluator.name}
                    </div>
                  </div>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Email</div>
                    <div className='text-white'>
                      {evaluation.evaluator.email}
                    </div>
                  </div>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Submitted</div>
                    <div className='text-white'>
                      {new Date(evaluation.submittedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Scores */}
            <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
              <h3 className='text-fluid-xl font-semibold text-white mb-6'>
                Detailed Scores
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {scoreCategories.map((category) => {
                  const score = evaluation.scores[category.key];
                  return (
                    <div
                      key={category.key}
                      className={`rounded-lg p-4 border border-[#3a3a3a] ${getScoreBackground(
                        score,
                        category.max
                      )}`}
                    >
                      <div className='flex justify-between items-center mb-2'>
                        <div className='text-white font-medium'>
                          {category.label}
                        </div>
                        <div
                          className={`font-bold text-lg ${getScoreColor(
                            score,
                            category.max
                          )}`}
                        >
                          {score}/{category.max}
                        </div>
                      </div>
                      <div className='w-full bg-[#3a3a3a] rounded-full h-2 overflow-hidden'>
                        <div
                          className={`h-2 rounded-full transition-all ${
                            getScoreColor(score, category.max).includes('green')
                              ? 'bg-green-500'
                              : getScoreColor(score, category.max).includes(
                                  'yellow'
                                )
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${(score / category.max) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comments & Recommendations */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Comments */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
                <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                  Comments
                </h3>
                <p className='text-white/90 leading-relaxed'>
                  {evaluation.comments}
                </p>
              </div>

              {/* Recommendations */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
                <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                  Recommendations
                </h3>
                <p className='text-white/90 leading-relaxed'>
                  {evaluation.recommendations}
                </p>
              </div>
            </div>

            {/* Tier Assignment Result */}
            <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
              <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                Tier Assignment
              </h3>
              <div className='flex items-center gap-4'>
                <span className='text-white'>Assigned Tier:</span>
                <span className='inline-block px-4 py-2 rounded-full text-lg font-semibold bg-[#e5e7eb] text-[#374151]'>
                  {evaluation.tierAssigned}
                </span>
                <div className='text-sm text-[#9ca3af]'>
                  Based on total score of {evaluation.totalScore}/
                  {evaluation.maxScore}
                </div>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className='flex items-center gap-2 text-white hover:text-[#9ca3af] transition-colors text-fluid-base text-body'
            >
              <HiArrowLeft className='w-5 h-5' />
              Back to Previous Page
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EvaluationDetailPage;
