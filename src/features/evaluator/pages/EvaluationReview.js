'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import EvaluatorHeader from '../components/EvaluatorHeader';
export const dynamic = 'force-dynamic';

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

const EvaluationReviewContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const officialParam = searchParams.get('official');
  const official = officialParam
    ? JSON.parse(officialParam)
    : { name: 'Michael Johnson', tier: 'Tier 150', id: null };

  const ratings = JSON.parse(searchParams.get('ratings') || '{}');
  const comments = JSON.parse(searchParams.get('comments') || '{}');

  const gameLocation = searchParams.get('gameLocation');

  const [expandedCategories, setExpandedCategories] = useState(() => {
    const initialExpanded = {};
    Object.keys(comments).forEach((key) => {
      if (comments[key]) initialExpanded[key] = true;
    });
    return initialExpanded;
  });

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

  const toggleCategory = (categoryId) => {
    if (!comments[categoryId]) return;
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleSubmit = async () => {
    if (!user || !official.id) {
      alert(
        'You must be logged in and have a valid official to submit an evaluation.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const scores = ratings || {};
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

      const evaluationData = {
        refereeId: official.id,
        evaluatorId: user.uid,
        scores,
        totalScore,
        comments: comments || {},
        gameDate: official.date,
        location: gameLocation || official.location,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'evaluations'), evaluationData);

      alert('Evaluation submitted successfully!');
      router.push('/evaluator/home');
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      alert('Failed to submit evaluation. Please try again.');
      setIsSubmitting(false);
    }
  };

  const ratingValues = Object.values(ratings).filter(Boolean);
  const totalScore = ratingValues.reduce((acc, val) => acc + val, 0);
  const maxScore = CATEGORY_LIST.length * 5;

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
      {/* Header - Same as Game Context */}
      <EvaluatorHeader
        userName={userData.name}
        userInitials={userData.initials}
        showBackButton={true}
      />
      <hr className='border-white/20 my-4' />

      {/* Title */}
      <div className='text-center mb-4'>
        <h2 className='text-[20px] lg:text-[22px] font-semibold text-white heading'>
          Review & Submit
        </h2>
      </div>

      {/* Main Content - Black Background */}
      <div className='flex-1 bg-[#181818]'>
        <main className='px-6 py-6 lg:px-8 lg:py-8'>
          <div className='max-w-md mx-auto lg:max-w-6xl'>
            <div className='mb-6 lg:mb-8'>
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 lg:p-7 border border-[#3a3a3a] flex flex-col items-center text-center'>
                <div className='w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-accent flex items-center justify-center mb-4'>
                  <span className='text-[32px] lg:text-[36px] text-white font-bold'>
                    {official.name.charAt(0)}
                  </span>
                </div>

                <h3 className='text-[20px] lg:text-[22px] font-semibold text-white text-body mb-1'>
                  {official.name}
                </h3>

                <p className='text-[14px] lg:text-[15px] text-[#9ca3af] text-body'>
                  Evaluator • Grade: Advanced
                </p>
              </div>
            </div>

            <div className='mb-6 lg:mb-8'>
              <div className='bg-white rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 flex items-center justify-between shadow-sm'>
                <div>
                  <div className='text-[13px] lg:text-[14px] text-[#6b7280] text-body mb-1 font-medium'>
                    Total Score
                  </div>
                  <div className='text-[32px] lg:text-[36px] font-bold text-accent heading'>
                    {totalScore}
                    <span className='text-[24px] lg:text-[28px] text-[#9ca3af]'>
                      /{maxScore}
                    </span>
                  </div>
                </div>

                <div className='bg-[#2a2a2a] text-white text-[14px] lg:text-[15px] font-semibold px-5 py-2.5 rounded-full text-body whitespace-nowrap'>
                  {official.tier}
                </div>
              </div>
            </div>

            <div className='mb-8 lg:mb-10'>
              <h2 className='text-[16px] lg:text-[17px] font-normal text-white text-body mb-4'>
                Category Score
              </h2>

              <div className='space-y-[10px] lg:space-y-[10px]'>
                {CATEGORY_LIST.map((category) => {
                  const rating = ratings[category.id];
                  const comment = comments[category.id];
                  const isExpanded = expandedCategories[category.id];
                  const hasComment = !!comment;

                  return (
                    <div
                      key={category.id}
                      className='bg-[#2a2a2a] rounded-[16px] px-6 py-[18px] lg:px-6 lg:py-[18px] border border-[#3a3a3a] transition-all'
                    >
                      <div
                        className={`flex items-center justify-between gap-4 ${
                          hasComment ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => toggleCategory(category.id)}
                      >
                        <div className='text-[15px] lg:text-[16px] font-normal text-white text-body flex-1 leading-tight'>
                          {category.name}
                        </div>

                        <div className='flex-shrink-0 mx-3'>
                          {renderStars(rating || 0)}
                        </div>

                        <div className='text-[16px] lg:text-[17px] font-normal text-white text-body min-w-[12px] text-right'>
                          {rating || 0}
                        </div>
                      </div>

                      {comment && (
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${
                            isExpanded
                              ? 'max-h-[500px] opacity-100 mt-3'
                              : 'max-h-0 opacity-0'
                          }`}
                        >
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

            <div className='mt-8 lg:mt-10'>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className='w-full bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-[15px] py-4 lg:py-[18px] text-center transition-all active:scale-[0.98] shadow-lg'
              >
                {isSubmitting ? (
                  <div className='flex items-center justify-center gap-3'>
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                    <div className='text-[18px] lg:text-[19px] font-bold text-white heading'>
                      Submitting...
                    </div>
                  </div>
                ) : (
                  <div className='text-[18px] lg:text-[19px] font-bold text-white heading'>
                    Submit Evaluation
                  </div>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function EvaluationReviewPage() {
  return (
    <Suspense fallback={<div className='p-8 text-white'>Loading review...</div>}>
      <EvaluationReviewContent />
    </Suspense>
  );
}
