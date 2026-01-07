'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
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

const TIER_DATA = [
  { tier: '100', range: [38, 40], desc: 'Eligible for any Varsity game. Highest proficiency in all areas. Referee (R) for all assignments unless with another 100. Eligible for all levels during playoffs.' },
  { tier: '150', range: [36, 37], desc: 'Eligible for any Varsity game. Proficient in all areas. Referee (R) unless with another 100. Eligible for all levels during playoffs.' },
  { tier: '200', range: [33, 35], desc: 'Eligible for all games. CC at 5A Boys. Above average proficiency. Referee (R)/U1 unless with higher ranking official.' },
  { tier: '300', range: [30, 32], desc: 'Eligible for all games. CC at 6A/5A Girls. Average to above average proficiency. Referee (R)/U1 unless with higher ranking official.' },
  { tier: '350', range: [27, 29], desc: 'Eligible for Varsity CC up to 4A. Boys/Girls 6A/5A JV. Average proficiency. Referee (R)/U1 unless with higher ranking official.' },
  { tier: '400', range: [23, 26], desc: 'Eligible up to 3A Varsity. Some proficiency in 3-person. High proficiency 2-person CC. Referee (R) for Post Season JV/Freshman/MS.' },
  { tier: '500', range: [19, 22], desc: 'Eligible up to 2A Varsity. Med-High proficiency 2-person. Eligible for Post Season MS Tournaments.' },
  { tier: '600', range: [15, 18], desc: 'Unranked. Newer official with limited experience. Eligible for all JV Assignments.' },
  { tier: '700', range: [8, 14], desc: '1st or 2nd year official. Eligible for primarily middle school with potential for lower-level sub-varsity.' },
  { tier: '800', range: [0, 7], desc: 'New to the chapter. Learning phase.' },
];

const calculateTier = (score) => {
  return TIER_DATA.find(t => score >= t.range[0] && score <= t.range[1]) || TIER_DATA[TIER_DATA.length - 1];
};

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

  const ratingValues = Object.values(ratings).filter(Boolean);
  const totalScore = ratingValues.reduce((acc, val) => acc + val, 0);
  const maxScore = CATEGORY_LIST.length * 5;

  const currentTier = calculateTier(totalScore);

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

  const handleEdit = () => {
    const params = new URLSearchParams();
    params.set('officials', JSON.stringify([official]));
    params.set('initialRatings', JSON.stringify(ratings));
    params.set('initialComments', JSON.stringify(comments));
    if (gameLocation) params.set('location', gameLocation);

    router.push(`/evaluator/evaluation-form?${params.toString()}`);
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
      // totalScore is already calculated above

      const evaluationData = {
        refereeId: official.id,
        evaluatorId: user.uid,
        scores,
        totalScore,
        tier: currentTier.tier, // Save the calculated tier
        comments: comments || {},
        gameDate: official.date || new Date().toISOString(),
        location: gameLocation || official.location,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'evaluations'), evaluationData);

      // Update assignment status if assignmentId exists
      if (official.assignmentId) {
        try {
          const assignmentRef = doc(db, 'assignments', official.assignmentId);
          await updateDoc(assignmentRef, {
            status: 'completed',
            completedAt: serverTimestamp()
          });
        } catch (updateError) {
          console.error("Error updating assignment status:", updateError);
          // We don't block the success flow if this fails, but we log it
        }
      }

      // CRITICAL: Update the Referee's profile with the Suggested Tier
      // This ensures the Master Roster and other views see the latest suggestion immediately
      try {
        const refereeRef = doc(db, 'users', official.id);
        await updateDoc(refereeRef, {
          suggestedTier: `Tier ${currentTier.tier}`
        });
      } catch (tierError) {
        console.error("Error updating referee suggested tier:", tierError);
      }

      alert('Evaluation submitted successfully!');
      router.push('/evaluator/home');
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      alert('Failed to submit evaluation. Please try again.');
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating) => (
    <div className='flex items-center gap-[6px]'>
      {[1, 2, 3, 4, 5].map((star) => (
        <div
          key={star}
          className={`w-[8px] h-[8px] rounded-full ${star <= rating ? 'bg-accent' : 'bg-[#4a4a4a]'
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
              <div className='bg-white rounded-[20px] px-6 py-5 lg:px-7 lg:py-6 flex flex-col gap-4 shadow-sm'>
                <div className="flex items-center justify-between">
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

                  <div className='text-right'>
                    <div className='text-[13px] lg:text-[14px] text-[#6b7280] text-body mb-1 font-medium'>
                      Projected Tier
                    </div>
                    <div className='bg-[#2a2a2a] text-white text-[18px] lg:text-[20px] font-bold px-5 py-2 rounded-full text-body whitespace-nowrap inline-block'>
                      Tier {currentTier.tier}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-gray-700 text-sm italic">
                    &quot;{currentTier.desc}&quot;
                  </p>
                </div>
              </div>
            </div>

            {/* Tier Reference Table */}
            <div className='mb-8 lg:mb-10'>
              <div className='bg-[#2a2a2a] rounded-[20px] overflow-hidden border border-[#3a3a3a]'>
                <div className="px-6 py-4 border-b border-[#3a3a3a]">
                  <h3 className="text-white font-semibold">Chapter Tier Ranking System</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-[#333] text-gray-200 uppercase font-medium">
                      <tr>
                        <th className="px-6 py-3">Tier</th>
                        <th className="px-6 py-3">Score</th>
                        <th className="px-6 py-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3a3a3a]">
                      {TIER_DATA.map((tier) => (
                        <tr key={tier.tier} className={currentTier.tier === tier.tier ? 'bg-accent/10' : ''}>
                          <td className={`px-6 py-4 font-bold ${currentTier.tier === tier.tier ? 'text-accent' : 'text-white'}`}>
                            {tier.tier}
                          </td>
                          <td className="px-6 py-4 text-white whitespace-nowrap">
                            {tier.range[0]} - {tier.range[1]}
                          </td>
                          <td className="px-6 py-4 text-gray-300">
                            {tier.desc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        className={`flex items-center justify-between gap-4 ${hasComment ? 'cursor-pointer' : ''
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
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded
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

            <div className='mt-8 lg:mt-10 flex gap-4'>
              <button
                onClick={handleEdit}
                className='flex-1 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white rounded-[15px] py-4 lg:py-[18px] text-center transition-all text-[16px] lg:text-[17px] font-semibold'
              >
                Edit Evaluation
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className='flex-1 bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-[15px] py-4 lg:py-[18px] text-center transition-all active:scale-[0.98] shadow-lg text-[18px] lg:text-[19px] font-bold text-white heading'
              >
                {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
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
