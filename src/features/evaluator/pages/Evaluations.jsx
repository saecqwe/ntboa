'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IoSearchOutline, IoFilterOutline } from 'react-icons/io5';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getEvaluationsByEvaluator } from '@/features/evaluator/services/evaluationService';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const EvaluationsPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const filteredEvaluations = evaluations.filter((ev) => {
    const term = searchTerm.toLowerCase();
    return (
      ev.refereeName?.toLowerCase().includes(term) ||
      ev.location?.toLowerCase().includes(term) ||
      ev.tier?.toLowerCase().includes(term)
    );
  });

  return (
    <div className='min-h-screen bg-[#181818] flex flex-col bg-gradient-secondary'>
      <EvaluatorHeader
        userName={userData.name}
        userInitials={userData.initials}
        showBackButton={true}
      />

      <div className='bg-gradient-primary rounded-tl-[60px] overflow-hidden flex-1'>
        <div className='rounded-tl-[60px] flex-1 overflow-hidden lg:rounded-tl-[80px] h-full'>
          <main className='px-6 py-8 lg:px-8 lg:py-12 min-h-full'>
            <div className='max-w-md mx-auto lg:max-w-6xl'>
              <div className='mb-8 lg:mb-10'>
                <h2 className='text-[32px] lg:text-[38px] font-bold text-white heading leading-none mb-2'>
                  Evaluations
                </h2>
                <div className='text-[#FFFFFF]/60 text-[15px] lg:text-[16px] text-body'>
                  View and manage your evaluation history
                </div>
              </div>

              {/* Search and Filter */}
              <div className='mb-6 flex gap-4'>
                <div className='relative flex-1'>
                  <div className='absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none'>
                    <IoSearchOutline className='text-gray-400 text-xl' />
                  </div>
                  <input
                    type='text'
                    placeholder='Search referee, location...'
                    className='w-full bg-[#FFFFFF]/6 border border-[#FFFFFF]/20 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-accent transition-colors placeholder-gray-500'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {/* <button className='bg-[#FFFFFF]/6 border border-[#FFFFFF]/20 rounded-xl px-4 py-3 text-white hover:bg-[#FFFFFF]/10 transition-colors'>
                  <IoFilterOutline className='text-xl' />
                </button> */}
              </div>

              {/* Evaluations List */}
              {loading ? (
                <div className='text-white text-center py-8'>Loading...</div>
              ) : filteredEvaluations.length > 0 ? (
                <div className='space-y-3 lg:space-y-3'>
                  {filteredEvaluations.map((evaluation) => (
                    <Link
                      href={`/evaluator/evaluation/${evaluation.id}`}
                      key={evaluation.id}
                      className='bg-[#FFFFFF]/6 rounded-[20px] px-5 py-4 lg:px-5 lg:py-4 flex items-center border border-[#FFFFFF]/20 hover:bg-[#FFFFFF]/10 transition-all cursor-pointer'
                    >
                      {/* Left Side - Name and Date */}
                      <div className='flex-1 pr-4'>
                        <div className='text-[18px] lg:text-[19px] font-semibold text-white heading mb-0.5 leading-tight'>
                          {evaluation.refereeName}
                        </div>
                        <div className='text-[13px] lg:text-[14px] text-[#9ca3af] text-body leading-tight'>
                          {evaluation.date?.toLocaleDateString ? evaluation.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </div>
                      </div>

                      {/* Vertical Divider */}
                      <div className='w-px h-12 lg:h-12 bg-[#FFFFFF]/6 mx-3 lg:mx-4'></div>

                      {/* Right Side - Score and Tier */}
                      <div className='flex items-center gap-2 min-w-[80px] lg:min-w-[90px]'>
                        <div className='text-base text-white heading leading-none'>
                          {evaluation.totalScore}/40
                        </div>
                        <div className='bg-[#FFFFFF]/6 text-[#9ca3af] text-[11px] lg:text-[12px] font-medium px-3 py-1 lg:px-3 lg:py-1 rounded-full text-body border border-[#FFFFFF]/20 whitespace-nowrap'>
                          {evaluation.tier || 'N/A'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
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
