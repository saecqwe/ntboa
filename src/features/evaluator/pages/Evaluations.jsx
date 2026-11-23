'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { IoSearchOutline } from 'react-icons/io5';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getEvaluationsByEvaluator } from '@/features/evaluator/services/evaluationService';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const getEvalTimestamp = (ev) => {
  if (ev.date instanceof Date && !isNaN(ev.date)) return ev.date.getTime();
  if (ev.createdAt?.seconds) return ev.createdAt.seconds * 1000;
  return 0;
};

const EvaluationsPage = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    const loadEvaluations = async () => {
      if (user) {
        try {
          const data = await getEvaluationsByEvaluator(user.uid);
          setEvaluations(data);
        } catch (error) {
          console.error('Failed to load evaluations:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadEvaluations();
  }, [user]);

  const filteredEvaluations = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = evaluations.filter((ev) => {
      const matchesSearch =
        ev.refereeName?.toLowerCase().includes(term) ||
        ev.location?.toLowerCase().includes(term) ||
        ev.tier?.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (statusFilter === 'published') return ev.isPublished === true;
      if (statusFilter === 'unpublished') return ev.isPublished !== true;
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return getEvalTimestamp(a) - getEvalTimestamp(b);
        case 'score':
          return (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0);
        case 'name':
          return (a.refereeName || '').localeCompare(b.refereeName || '', undefined, {
            sensitivity: 'base',
          });
        case 'newest':
        default:
          return getEvalTimestamp(b) - getEvalTimestamp(a);
      }
    });
  }, [evaluations, searchTerm, statusFilter, sortBy]);

  const visibleEvaluations = filteredEvaluations.slice(0, visibleCount);

  return (
    <div className='min-h-screen bg-[#181818] flex flex-col bg-gradient-secondary'>
      <EvaluatorHeader showBackButton={true} />

      <div className='bg-gradient-primary rounded-tl-[60px] overflow-hidden flex-1'>
        <div className='rounded-tl-[60px] flex-1 overflow-hidden lg:rounded-tl-[80px] h-full'>
          <main className='px-5 py-6 lg:px-8 lg:py-8 pb-20 min-h-full'>
            <div className='max-w-md mx-auto lg:max-w-6xl'>
              <div className='mb-5 lg:mb-6'>
                <h2 className='text-2xl lg:text-3xl font-bold text-white heading leading-none mb-1.5'>
                  Evaluations
                </h2>
                <div className='text-[#FFFFFF]/60 text-sm text-body'>
                  View and manage your evaluation history
                </div>
              </div>

              {/* Search, Filter and Sort */}
              <div className='mb-6 flex flex-col sm:flex-row gap-3'>
                <div className='relative flex-1 min-w-0'>
                  <div className='absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none'>
                    <IoSearchOutline className='text-gray-400 text-lg' />
                  </div>
                  <input
                    type='text'
                    placeholder='Search referee, location...'
                    aria-label='Search evaluations by referee, location, or tier'
                    className='w-full bg-[#FFFFFF]/6 border border-[#FFFFFF]/20 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors placeholder-gray-500'
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setVisibleCount(20);
                    }}
                  />
                </div>
                <div className='flex gap-2'>
                  <select
                    aria-label='Filter evaluations by status'
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setVisibleCount(20);
                    }}
                    className='flex-1 sm:flex-none bg-[#FFFFFF]/6 border border-[#FFFFFF]/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors'
                  >
                    <option value='all' className='bg-[#1e1e1e]'>All Statuses</option>
                    <option value='published' className='bg-[#1e1e1e]'>Published</option>
                    <option value='unpublished' className='bg-[#1e1e1e]'>Unpublished</option>
                  </select>
                  <select
                    aria-label='Sort evaluations by'
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className='flex-1 sm:flex-none bg-[#FFFFFF]/6 border border-[#FFFFFF]/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors'
                  >
                    <option value='newest' className='bg-[#1e1e1e]'>Sort: Newest</option>
                    <option value='oldest' className='bg-[#1e1e1e]'>Sort: Oldest</option>
                    <option value='score' className='bg-[#1e1e1e]'>Sort: Highest Score</option>
                    <option value='name' className='bg-[#1e1e1e]'>Sort: Name</option>
                  </select>
                </div>
              </div>

              {/* Evaluations List */}
              {loading ? (
                <div className='text-white text-center py-8'>Loading...</div>
              ) : visibleEvaluations.length > 0 ? (
                <>
                  <div className='space-y-2.5'>
                    {visibleEvaluations.map((evaluation) => (
                      <Link
                        href={`/evaluator/evaluation/${evaluation.id}`}
                        key={evaluation.id}
                        className='bg-[#FFFFFF]/6 rounded-2xl px-4 py-3.5 lg:px-5 lg:py-4 flex items-center border border-[#FFFFFF]/20 hover:bg-[#FFFFFF]/10 transition-all cursor-pointer'
                      >
                        {/* Left Side - Name, Date & Location */}
                        <div className='flex-1 min-w-0 pr-3'>
                          <div
                            className='text-base lg:text-lg font-semibold text-white heading mb-0.5 leading-tight truncate'
                            title={evaluation.refereeName}
                          >
                            {evaluation.refereeName}
                          </div>
                          <div className='text-xs lg:text-sm text-[#9ca3af] text-body leading-tight truncate'>
                            {evaluation.date?.toLocaleDateString
                              ? evaluation.date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : ''}
                            {evaluation.location ? ` · ${evaluation.location}` : ''}
                          </div>
                        </div>

                        {/* Vertical Divider */}
                        <div className='w-px h-11 bg-[#FFFFFF]/10 mx-2.5 lg:mx-4 shrink-0'></div>

                        {/* Right Side - Score, Tier, and Publish Status */}
                        <div className='flex flex-col items-end gap-1.5 shrink-0'>
                          <div className='flex items-center gap-2'>
                            <div className='text-sm sm:text-base font-semibold text-white heading leading-none tabular-nums'>
                              {evaluation.totalScore}/{evaluation.maxScore || 40}
                            </div>
                            <div className='bg-[#FFFFFF]/6 text-[#d1d5db] text-[11px] lg:text-xs font-medium px-2.5 py-0.5 rounded-full text-body border border-[#FFFFFF]/20 whitespace-nowrap'>
                              {evaluation.tier || 'N/A'}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
                              evaluation.isPublished
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {evaluation.isPublished ? 'Published' : 'Unpublished'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {filteredEvaluations.length > visibleCount && (
                    <div className='mt-6 text-center'>
                      <button
                        type='button'
                        onClick={() => setVisibleCount((prev) => prev + 20)}
                        className='bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all border border-white/15 cursor-pointer'
                      >
                        Load More ({filteredEvaluations.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className='text-center py-10 bg-[#FFFFFF]/6 rounded-[20px] border border-[#FFFFFF]/20'>
                  <p className='text-gray-400'>No evaluations found</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default EvaluationsPage;
