'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiArrowLeft, HiPencil, HiCheck, HiX } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import EvaluationDetailSkeleton from '@/ui/skeletons/EvaluationDetailSkeleton';

// Module-level cache across tab navigations
const globalEvaluationDetailCache = new Map();

const OFFICIAL_CATEGORIES = [
  { label: 'Positioning & Court Coverage', key: 'positioning', max: 5 },
  { label: 'Game Management & Control', key: 'gameManagement', max: 5 },
  { label: 'Rules Knowledge & Application', key: 'rulesKnowledge', max: 5 },
  { label: 'Mechanics & Signals', key: 'mechanics', max: 5 },
  { label: 'Consistency & Accuracy', key: 'consistency', max: 5 },
  { label: 'Professional Demeanor', key: 'demeanor', max: 5 },
  { label: 'Decision Making Speed', key: 'decisionSpeed', max: 5 },
  { label: 'Team Collaboration', key: 'collaboration', max: 5 },
];

const LEGACY_CATEGORIES = [
  { label: 'Court Presence', key: 'courtPresence', max: 5 },
  { label: 'Communication', key: 'communication', max: 5 },
  { label: 'Game Management', key: 'gameManagement', max: 5 },
  { label: 'Rules Knowledge', key: 'rulesKnowledge', max: 5 },
  { label: 'Physical Fitness', key: 'physicalFitness', max: 5 },
  { label: 'Professionalism', key: 'professionalism', max: 5 },
];

// Helper to extract score for a category, checking common key aliases
const getCategoryScore = (scores, key) => {
  if (!scores) return 0;
  if (typeof scores[key] === 'number') return scores[key];
  const aliases = {
    demeanor: 'professionalism',
    professionalism: 'demeanor',
    collaboration: 'communication',
    communication: 'collaboration',
    positioning: 'courtPresence',
    courtPresence: 'positioning',
    mechanics: 'physicalFitness',
    physicalFitness: 'mechanics',
  };
  if (aliases[key] && typeof scores[aliases[key]] === 'number') {
    return scores[aliases[key]];
  }
  return 0;
};

const EvaluationDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const cachedData = params?.id ? globalEvaluationDetailCache.get(params.id) : null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evaluation, setEvaluation] = useState(() => cachedData?.evaluation || null);
  const [loading, setLoading] = useState(() => !cachedData);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(() => cachedData?.editForm || null);

  useEffect(() => {
    const fetchEvaluation = async () => {
      if (!params.id) return;
      try {
        const evalDoc = await getDoc(doc(db, 'evaluations', params.id));
        if (evalDoc.exists()) {
          const evalData = evalDoc.data();

          // Parallelize fetching referee and evaluator docs to eliminate client waterfall
          const refereePromise = evalData.refereeId ? getDoc(doc(db, 'users', evalData.refereeId)) : Promise.resolve(null);
          const evaluatorPromise = evalData.evaluatorId ? getDoc(doc(db, 'users', evalData.evaluatorId)) : Promise.resolve(null);

          const [refereeDoc, evaluatorDoc] = await Promise.all([refereePromise, evaluatorPromise]);
          const refereeData = refereeDoc && refereeDoc.exists() ? refereeDoc.data() : null;
          const evaluatorData = evaluatorDoc && evaluatorDoc.exists() ? evaluatorDoc.data() : null;

          // Normalize scores & ratings (unwrapping official_0 or official if nested)
          let rawScores = evalData.scores || evalData.ratings || {};
          if (rawScores.official_0 && typeof rawScores.official_0 === 'object') {
            rawScores = rawScores.official_0;
          } else if (rawScores.official && typeof rawScores.official === 'object') {
            rawScores = rawScores.official;
          }

          // Normalize comments (unwrapping official_0 if nested)
          let rawComments = evalData.comments || {};
          if (rawComments.official_0 && typeof rawComments.official_0 === 'object') {
            rawComments = rawComments.official_0;
          }

          // Calculate total score if missing or zero
          let totalScore = evalData.totalScore ?? evalData.overallScore ?? evalData.score;
          const scoreValues = Object.values(rawScores).filter(v => typeof v === 'number');
          if ((totalScore === undefined || totalScore === null || totalScore === 0) && scoreValues.length > 0) {
            totalScore = scoreValues.reduce((a, b) => a + b, 0);
          }
          if (totalScore === undefined || totalScore === null) {
            totalScore = 0;
          }

          const maxScore = evalData.maxScore || (scoreValues.length > 0 ? scoreValues.length * 5 : 40);

          const formattedEvaluation = {
            id: evalDoc.id,
            ...evalData,
            date: evalData.createdAt ? new Date(evalData.createdAt.seconds * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : 'N/A',
            time: evalData.createdAt ? new Date(evalData.createdAt.seconds * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }) : 'N/A',
            gameDetails: evalData.game || evalData.gameDetails || 'N/A',
            location: evalData.location || 'N/A',
            referee: {
              name: refereeData?.displayName || evalData.refereeName || 'Unknown',
              email: refereeData?.email || 'N/A',
              tier: refereeData?.tier || evalData.tier || 'N/A',
            },
            evaluator: {
              name: evaluatorData?.displayName || evalData.evaluatorName || 'Unknown',
              email: evaluatorData?.email || 'N/A',
            },
            scores: rawScores,
            totalScore,
            maxScore,
            tierAssigned: evalData.tier || refereeData?.tier || 'N/A',
            comments: rawComments,
            recommendations: evalData.recommendations || evalData.feedback || evalData.groupComment || 'None provided.',
            submittedAt: evalData.createdAt ? new Date(evalData.createdAt.seconds * 1000).toISOString() : null,
          };

          const initialEditForm = {
            scores: { ...rawScores },
            comments: rawComments,
            recommendations: evalData.recommendations || evalData.feedback || evalData.groupComment || '',
            tierAssigned: evalData.tier || refereeData?.tier || 'N/A',
          };

          globalEvaluationDetailCache.set(params.id, {
            evaluation: formattedEvaluation,
            editForm: initialEditForm,
          });

          setEvaluation(formattedEvaluation);
          setEditForm(initialEditForm);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching evaluation:", error);
        setLoading(false);
      }
    };

    fetchEvaluation();
  }, [params.id]);

  const activeCategories = React.useMemo(() => {
    if (!evaluation?.scores) return OFFICIAL_CATEGORIES;
    const keys = Object.keys(evaluation.scores);
    const hasOfficial = OFFICIAL_CATEGORIES.some(c => keys.includes(c.key));
    if (hasOfficial) return OFFICIAL_CATEGORIES;
    const hasLegacy = LEGACY_CATEGORIES.some(c => keys.includes(c.key));
    if (hasLegacy) return LEGACY_CATEGORIES;
    return OFFICIAL_CATEGORIES;
  }, [evaluation?.scores]);

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



  const handleEditToggle = () => {
    if (isEditing) {
      // Create a reset
      setEditForm({
        scores: evaluation.scores,
        comments: evaluation.comments,
        recommendations: evaluation.recommendations,
        tierAssigned: evaluation.tierAssigned,
      });
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleScoreChange = (categoryKey, value) => {
    const newScore = Math.min(5, Math.max(0, parseInt(value) || 0));
    setEditForm(prev => ({
      ...prev,
      scores: {
        ...prev.scores,
        [categoryKey]: newScore
      }
    }));
  };

  const handleTextChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  }

  const handleSaveChanges = async () => {
    try {
      const newTotalScore = Object.values(editForm.scores).reduce((a, b) => a + b, 0);
      const evalRef = doc(db, 'evaluations', params.id);

      await updateDoc(evalRef, {
        scores: editForm.scores,
        totalScore: newTotalScore,
        comments: editForm.comments,
        recommendations: editForm.recommendations, // or feedback
        tier: editForm.tierAssigned,
      });

      // Sync tier to referee profile (Master Roster update)
      if (evaluation.refereeId) {
        try {
          const refereeRef = doc(db, 'users', evaluation.refereeId);
          await updateDoc(refereeRef, {
            suggestedTier: editForm.tierAssigned
          });
        } catch (err) {
          console.error("Error syncing tier to user profile:", err);
        }
      }

      toast.success("Evaluation updated successfully!");

      // Update local state and cache
      const updatedEval = {
        ...evaluation,
        scores: editForm.scores,
        totalScore: newTotalScore,
        comments: editForm.comments,
        recommendations: editForm.recommendations,
        tierAssigned: editForm.tierAssigned,
      };
      globalEvaluationDetailCache.set(params.id, {
        evaluation: updatedEval,
        editForm: { ...editForm },
      });

      setEvaluation(updatedEval);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating evaluation:", error);
      toast.error("Failed to update evaluation.");
    }
  };

  if (loading) {
    return <EvaluationDetailSkeleton />;
  }

  if (!evaluation) {
    return (
      <div className='flex min-h-screen bg-[#1a1a1a] items-center justify-center flex-col gap-4'>
        <div className='text-white text-xl'>Evaluation not found.</div>
        <button onClick={() => router.back()} className='text-accent hover:underline'>Go Back</button>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
      <Toaster />
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className='flex-1 lg:ml-64'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-4 lg:px-8 lg:py-6 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-4'>
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
          </div>

          <div className='flex gap-2'>
            {isEditing ? (
              <>
                <button
                  onClick={handleEditToggle}
                  className='flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg font-semibold transition-all'
                >
                  <HiX className='w-5 h-5' />
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  className='flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition-all'
                >
                  <HiCheck className='w-5 h-5' />
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={handleEditToggle}
                className='flex items-center gap-2 bg-accent hover:opacity-90 text-white px-4 py-2 rounded-lg font-semibold transition-all'
              >
                <HiPencil className='w-5 h-5' />
                Edit Evaluation
              </button>
            )}

          </div>
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
                      {evaluation.submittedAt ? new Date(evaluation.submittedAt).toLocaleString() : 'N/A'}
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
                {activeCategories.map((category) => {
                  const score = isEditing
                    ? (editForm.scores?.[category.key] ?? getCategoryScore(editForm.scores, category.key))
                    : getCategoryScore(evaluation.scores, category.key);

                  return (
                    <div
                      key={category.key}
                      className={`rounded-lg p-4 border border-[#3a3a3a] ${!isEditing ? getScoreBackground(score, category.max) : 'bg-[#333]'}`}
                    >
                      <div className='flex justify-between items-center mb-2'>
                        <div className='text-white font-medium'>
                          {category.label}
                        </div>

                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="5"
                            value={score}
                            onChange={(e) => handleScoreChange(category.key, e.target.value)}
                            className="w-16 bg-[#1a1a1a] border border-[#4a4a4a] rounded px-2 py-1 text-white text-right focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <div
                            className={`font-bold text-lg ${getScoreColor(
                              score,
                              category.max
                            )}`}
                          >
                            {score}/{category.max}
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className='w-full bg-[#3a3a3a] rounded-full h-2 overflow-hidden'>
                          <div
                            className={`h-2 rounded-full transition-all ${getScoreColor(score, category.max).includes('green')
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
                      )}
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
                {isEditing ? (
                  <textarea
                    value={typeof editForm.comments === 'string' ? editForm.comments : ''}
                    onChange={(e) => handleTextChange('comments', e.target.value)}
                    className="w-full h-32 bg-[#1a1a1a] border border-[#4a4a4a] rounded-lg p-4 text-white resize-none focus:outline-none focus:border-accent"
                    placeholder="Enter comments..."
                  />
                ) : (
                  typeof evaluation.comments === 'object' && evaluation.comments !== null ? (
                    <div className='space-y-4'>
                      {Object.entries(evaluation.comments)
                        .filter(([_, c]) => c && typeof c === 'string' && c.trim().length > 0)
                        .map(([category, comment]) => (
                        <div key={category}>
                          <div className='text-sm text-[#9ca3af] capitalize mb-1'>{category.replace(/([A-Z])/g, ' $1')}</div>
                          <p className='text-white/90 leading-relaxed'>{comment}</p>
                        </div>
                      ))}
                      {Object.values(evaluation.comments).filter(c => c && typeof c === 'string' && c.trim().length > 0).length === 0 && (
                        <p className='text-white/90 leading-relaxed'>No comments provided.</p>
                      )}
                    </div>
                  ) : (
                    <p className='text-white/90 leading-relaxed'>
                      {evaluation.comments || 'No comments provided.'}
                    </p>
                  )
                )}
              </div>

              {/* Recommendations */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
                <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                  Recommendations
                </h3>
                {isEditing ? (
                  <textarea
                    value={editForm.recommendations}
                    onChange={(e) => handleTextChange('recommendations', e.target.value)}
                    className="w-full h-32 bg-[#1a1a1a] border border-[#4a4a4a] rounded-lg p-4 text-white resize-none focus:outline-none focus:border-accent"
                    placeholder="Enter recommendations..."
                  />
                ) : (
                  <p className='text-white/90 leading-relaxed'>
                    {evaluation.recommendations}
                  </p>
                )}
              </div>
            </div>

            {/* Tier Assignment Result */}
            <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
              <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                Tier Assignment
              </h3>
              <div className='flex flex-wrap items-center gap-4'>
                <span className='text-white'>Assigned Tier:</span>
                {isEditing ? (
                  <select
                    value={editForm.tierAssigned}
                    onChange={(e) => handleTextChange('tierAssigned', e.target.value)}
                    className='bg-[#1a1a1a] text-white border border-[#4a4a4a] rounded px-4 py-2 focus:outline-none focus:border-accent'
                  >
                    <option>Tier 100</option>
                    <option>Tier 150</option>
                    <option>Tier 200</option>
                    <option>Tier 250</option>
                  </select>
                ) : (
                  <span className='inline-block px-4 py-2 rounded-full text-lg font-semibold bg-[#e5e7eb] text-[#374151]'>
                    {evaluation.tierAssigned}
                  </span>
                )}

                <div className='text-sm text-[#9ca3af]'>
                  Based on total score of {isEditing ? Object.values(editForm.scores).reduce((a, b) => a + b, 0) : evaluation.totalScore}/
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
