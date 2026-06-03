'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getEvaluationById } from '@/features/evaluator/services/evaluationService';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const EvaluationDetailsPage = () => {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Profile data state
  const [userData, setUserData] = useState({
    name: 'John',
    initials: 'JS',
  });

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

  useEffect(() => {
    const fetchEvaluation = async () => {
      if (params.id) {
        try {
          const data = await getEvaluationById(params.id);
          if (data) {
            setEvaluation(data);
          } else {
            setError('Evaluation not found');
          }
        } catch (err) {
          setError('Failed to load evaluation');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchEvaluation();
  }, [params.id]);

  if (loading) {
    return <div className="min-h-screen bg-[#181818] flex items-center justify-center text-white">Loading...</div>;
  }

  if (error || !evaluation) {
    return <div className="min-h-screen bg-[#181818] flex items-center justify-center text-white">{error || 'Evaluation not found'}</div>;
  }

  const CATEGORY_LIST = [
    { id: 'positioning', name: 'Positioning & Court Coverage' },
    { id: 'gameManagement', name: 'Game Management & Control' },
    { id: 'rulesKnowledge', name: 'Rules Knowledge & Application' },
    { id: 'mechanics', name: 'Mechanics & Signals' },
    { id: 'consistency', name: 'Consistency & Accuracy' },
    { id: 'demeanor', name: 'Professional Demeanor' },
    { id: 'decisionSpeed', name: 'Decision Making Speed' },
    { id: 'collaboration', name: 'Team Collaboration' },
  ];

  const isGroupEvaluation = evaluation.isGroup || (evaluation.refereeIds?.length || 0) > 1 || (evaluation.officials?.length || 0) > 1;

  const renderStars = (rating) => (
    <div className='flex items-center gap-[6px]'>
      {[1, 2, 3, 4, 5].map((star) => (
        <div
          key={star}
          className={`w-[8px] h-[8px] rounded-full ${
            star <= rating ? 'bg-accent' : 'bg-[#4a4a4a]'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className='min-h-screen flex flex-col bg-gradient-secondary'>
      <EvaluatorHeader
        userName={userData.name}
        userInitials={userData.initials}
        showBackButton={true}
      />

      <div className='flex-1 bg-[#181818]'>
        <main className='px-6 py-6 lg:px-8 lg:py-8'>
          <div className='max-w-md mx-auto lg:max-w-6xl'>
            {/* Header Info */}
            <div className='mb-6 lg:mb-8'>
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 lg:p-7 border border-[#3a3a3a] flex flex-col items-center text-center'>
                <div className='w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-accent flex items-center justify-center mb-4'>
                  <span className='text-[32px] lg:text-[36px] text-white font-bold'>
                    {evaluation.referee.name.charAt(0)}
                  </span>
                </div>

                <h3 className='text-[20px] lg:text-[22px] font-semibold text-white text-body mb-2'>
                  {evaluation.referee.name}
                </h3>
                
                <div className='flex flex-col gap-1 mb-3'>
                    <p className='text-[15px] text-white font-medium'>
                      {evaluation.location}
                    </p>
                    <p className='text-[14px] text-[#9ca3af]'>
                       {evaluation.gameDateFormatted} {evaluation.gameTimeFormatted && `• ${evaluation.gameTimeFormatted}`}
                    </p>
                </div>

                 <div className='flex items-center justify-center gap-4 text-[13px] text-[#6b7280] border-t border-[#3a3a3a] pt-3 w-full'>
                    <span>Report Date: {evaluation.date}</span>
                    <span>•</span>
                    <span>Tier: {evaluation.tier || 'N/A'}</span>
                </div>
              </div>
            </div>

             {/* Score Summary */}
            <div className='mb-6 lg:mb-8'>
              <div className='bg-white rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 flex flex-col gap-4 shadow-sm'>
                <div className="flex items-center justify-between">
                  <div>
                    <div className='text-[13px] lg:text-[14px] text-[#6b7280] text-body mb-1 font-medium'>
                      Total Score
                    </div>
                    <div className='text-[32px] lg:text-[36px] font-bold text-accent heading'>
                      {evaluation.totalScore}
                      <span className='text-[24px] lg:text-[28px] text-[#9ca3af]'>
                        /{evaluation.maxScore || 40}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className='mb-8 lg:mb-10'>
              <h2 className='text-[16px] lg:text-[17px] font-normal text-white text-body mb-4'>
                Category Details
              </h2>

              <div className='space-y-[10px] lg:space-y-[10px]'>
                {isGroupEvaluation ? (
                  evaluation.officials?.map((official, index) => {
                    const officialScores = evaluation.scores?.[`official_${index}`] || {};
                    const officialComments = evaluation.comments?.[`official_${index}`] || {};

                    return (
                      <div key={official.id || index} className='bg-[#2a2a2a] rounded-[16px] p-5 border border-[#3a3a3a]'>
                        <div className='mb-4'>
                          <h3 className='text-[17px] lg:text-[18px] font-semibold text-white'>
                            {official.name}
                          </h3>
                          <p className='text-[#9ca3af] text-sm'>Official {index + 1}</p>
                        </div>

                        <div className='space-y-[10px] lg:space-y-[10px]'>
                          {CATEGORY_LIST.map((category) => {
                            const rating = officialScores?.[category.id] || 0;
                            const comment = officialComments?.[category.id];

                            return (
                              <div
                                key={category.id}
                                className='bg-[#252525] rounded-[16px] px-5 py-[16px] border border-[#3a3a3a]'
                              >
                                <div className='flex items-center justify-between gap-4'>
                                  <div className='text-[15px] lg:text-[16px] font-normal text-white text-body flex-1 leading-tight'>
                                    {category.name}
                                  </div>

                                  <div className='flex items-center gap-3'>
                                    <div className='flex-shrink-0'>
                                      {renderStars(rating)}
                                    </div>
                                    <div className='text-[16px] lg:text-[17px] font-normal text-white text-body min-w-[12px] text-right'>
                                      {rating}
                                    </div>
                                  </div>
                                </div>

                                {comment && (
                                  <div className='mt-3'>
                                    <div className='pl-4 border-l-[3px] border-[#555555]'>
                                      <p className='text-[13px] lg:text-[13px] text-[#9ca3af] text-body leading-[1.6]'>
                                        {comment}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  CATEGORY_LIST.map((category) => {
                    const rating = evaluation.scores?.[category.id] || 0;
                    const comment = evaluation.comments?.[category.id];

                    return (
                      <div
                        key={category.id}
                        className='bg-[#2a2a2a] rounded-[16px] px-6 py-[18px] lg:px-6 lg:py-[18px] border border-[#3a3a3a]'
                      >
                        <div className='flex items-center justify-between gap-4'>
                          <div className='text-[15px] lg:text-[16px] font-normal text-white text-body flex-1 leading-tight'>
                            {category.name}
                          </div>

                          <div className='flex-shrink-0 mx-3'>
                            {renderStars(rating)}
                          </div>

                          <div className='text-[16px] lg:text-[17px] font-normal text-white text-body min-w-[12px] text-right'>
                            {rating}
                          </div>
                        </div>

                        {comment && (
                          <div className='mt-3'>
                            <div className='pl-4 border-l-[3px] border-[#555555]'>
                              <p className='text-[13px] lg:text-[13px] text-[#9ca3af] text-body leading-[1.6]'>
                                {comment}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {isGroupEvaluation && evaluation.groupComment && (
              <div className='mb-8 lg:mb-10'>
                <div className='bg-[#2a2a2a] rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 border border-[#3a3a3a]'>
                  <h3 className='text-[16px] lg:text-[17px] font-semibold text-white mb-3'>Group Comment</h3>
                  <p className='text-[#9ca3af] text-[14px] leading-6'>
                    {evaluation.groupComment}
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default EvaluationDetailsPage;
