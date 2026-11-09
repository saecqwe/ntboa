'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getEvaluationById } from '@/features/evaluator/services/evaluationService';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import EvaluationDetailSkeleton from '@/ui/skeletons/EvaluationDetailSkeleton';
import {
  OFFICIAL_CATEGORIES,
  getEvaluationOfficials,
  getScoresForOfficial,
  getCommentsForOfficial,
  getOfficialTotalScore,
  getCategoryScore,
  resolveActiveCategories,
} from '@/lib/evaluationUtils';

// In-memory cache across tab switches
const globalEvaluatorEvalDetailCache = new Map();

const EvaluationDetailsPage = () => {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  const cachedData = params?.id ? globalEvaluatorEvalDetailCache.get(params.id) : null;
  const [evaluation, setEvaluation] = useState(() => cachedData || null);
  const [loading, setLoading] = useState(() => !cachedData);
  const [error, setError] = useState(null);
  const [activeOfficialTab, setActiveOfficialTab] = useState(0);

  // Profile data state
  const [userData, setUserData] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedProfile = localStorage.getItem('evaluatorProfile');
        if (savedProfile) {
          const profile = JSON.parse(savedProfile);
          return {
            name: profile.name || 'John',
            initials: profile.initials || 'JS',
          };
        }
      } catch {
        // Fallback
      }
    }
    return { name: 'John', initials: 'JS' };
  });

  useEffect(() => {
    const fetchEvaluation = async () => {
      if (params.id) {
        try {
          const data = await getEvaluationById(params.id);
          if (data) {
            globalEvaluatorEvalDetailCache.set(params.id, data);
            setEvaluation(data);
          } else {
            setError('Evaluation not found');
          }
        } catch (err) {
          console.error('Error fetching evaluation:', err);
          setError('Failed to load evaluation');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchEvaluation();
  }, [params.id]);

  const officialsList = useMemo(() => {
    return getEvaluationOfficials(evaluation);
  }, [evaluation]);

  const activeOfficial = officialsList[activeOfficialTab] || officialsList[0] || {
    name: evaluation?.referee?.name || 'Official',
    tier: evaluation?.tier || 'N/A',
  };

  const activeScores = useMemo(() => {
    return getScoresForOfficial(evaluation, activeOfficial.index ?? activeOfficialTab);
  }, [evaluation, activeOfficial.index, activeOfficialTab]);

  const activeComments = useMemo(() => {
    return getCommentsForOfficial(evaluation, activeOfficial.index ?? activeOfficialTab);
  }, [evaluation, activeOfficial.index, activeOfficialTab]);

  const calculatedTotal = getOfficialTotalScore(activeScores);
  const activeTotalScore = calculatedTotal || evaluation?.totalScore || 0;
  const activeCategories = resolveActiveCategories(activeScores);

  if (loading) {
    return <EvaluationDetailSkeleton />;
  }

  if (error || !evaluation) {
    return (
      <div className='min-h-screen bg-[#181818] flex items-center justify-center flex-col gap-4 text-white'>
        <div className='text-lg'>{error || 'Evaluation not found'}</div>
        <button
          onClick={() => router.back()}
          className='text-accent hover:underline text-sm cursor-pointer'
        >
          Go Back
        </button>
      </div>
    );
  }

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
                    {(activeOfficial.name || evaluation.referee?.name || 'O').charAt(0)}
                  </span>
                </div>

                <h3 className='text-[20px] lg:text-[22px] font-semibold text-white text-body mb-2'>
                  {activeOfficial.name || evaluation.referee?.name}
                </h3>

                <div className='flex flex-col gap-1 mb-3'>
                  <p className='text-[15px] text-white font-medium'>
                    {evaluation.location}
                  </p>
                  <p className='text-[14px] text-[#9ca3af]'>
                    {evaluation.gameDateFormatted}{' '}
                    {evaluation.gameTimeFormatted && `• ${evaluation.gameTimeFormatted}`}
                  </p>
                </div>

                <div className='flex items-center justify-center gap-4 text-[13px] text-[#6b7280] border-t border-[#3a3a3a] pt-3 w-full'>
                  <span>Report Date: {evaluation.date || 'N/A'}</span>
                  <span>•</span>
                  <span>Tier: {activeOfficial.tier || evaluation.tier || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Score Summary */}
            <div className='mb-6 lg:mb-8'>
              <div className='bg-white rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 flex flex-col gap-4 shadow-sm'>
                <div className='flex items-center justify-between'>
                  <div>
                    <div className='text-[13px] lg:text-[14px] text-[#6b7280] text-body mb-1 font-medium'>
                      Total Score {officialsList.length > 1 ? `(${activeOfficial.name})` : ''}
                    </div>
                    <div className='text-[32px] lg:text-[36px] font-bold text-accent heading'>
                      {activeTotalScore}
                      <span className='text-[24px] lg:text-[28px] text-[#9ca3af]'>
                        /{evaluation.maxScore || (activeCategories.length * 5)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Official Switcher Tabs (if group evaluation) */}
            {officialsList.length > 1 && (
              <div className='mb-6 bg-[#242424] p-4 rounded-[20px] border border-[#3a3a3a]'>
                <div className='text-xs text-[#9ca3af] font-semibold uppercase tracking-wider mb-2.5'>
                  Officials Evaluated ({officialsList.length}):
                </div>
                <div className='flex items-center gap-2 overflow-x-auto pb-1'>
                  {officialsList.map((off, idx) => (
                    <button
                      key={off.id || idx}
                      type='button'
                      onClick={() => setActiveOfficialTab(idx)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        activeOfficialTab === idx
                          ? 'bg-accent text-white shadow-md'
                          : 'bg-[#1a1a1a] text-[#9ca3af] hover:text-white hover:bg-[#2e2e2e]'
                      }`}
                    >
                      {off.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className='mb-8 lg:mb-10'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-[16px] lg:text-[17px] font-normal text-white text-body'>
                  Category Details
                </h2>
                {officialsList.length > 1 && (
                  <span className='text-xs text-[#9ca3af]'>
                    Showing scores for <strong className='text-white'>{activeOfficial.name}</strong>
                  </span>
                )}
              </div>

              <div className='space-y-[10px]'>
                {activeCategories.map((category) => {
                  const rating = getCategoryScore(activeScores, category.key || category.id);
                  const comment = activeComments?.[category.key || category.id];

                  return (
                    <div
                      key={category.key || category.id}
                      className='bg-[#2a2a2a] rounded-[16px] px-6 py-[18px] lg:px-6 lg:py-[18px] border border-[#3a3a3a]'
                    >
                      <div className='flex items-center justify-between gap-4'>
                        <div className='text-[15px] lg:text-[16px] font-normal text-white text-body flex-1 leading-tight'>
                          {category.label || category.name}
                        </div>

                        <div className='flex items-center gap-3'>
                          <div className='flex-shrink-0'>{renderStars(rating)}</div>
                          <div className='text-[16px] lg:text-[17px] font-normal text-white text-body min-w-[12px] text-right'>
                            {rating}
                          </div>
                        </div>
                      </div>

                      {typeof comment === 'string' && comment.trim().length > 0 && (
                        <div className='mt-3'>
                          <div className='pl-4 border-l-[3px] border-accent/70'>
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

            {/* Crew / Game Comment */}
            {evaluation.groupComment && (
              <div className='mb-8 lg:mb-10'>
                <div className='bg-[#2a2a2a] rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 border border-accent/40'>
                  <h3 className='text-[16px] lg:text-[17px] font-semibold text-accent mb-2'>
                    Crew / Game Comment
                  </h3>
                  <p className='text-white/90 text-[14px] leading-6'>
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
