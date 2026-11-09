'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiArrowLeft, HiPencil, HiCheck, HiX } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import EvaluationDetailSkeleton from '@/ui/skeletons/EvaluationDetailSkeleton';

import {
  OFFICIAL_CATEGORIES,
  LEGACY_CATEGORIES,
  getCategoryScore,
  getEvaluationOfficials,
  getScoresForOfficial,
  getCommentsForOfficial,
  getOfficialTotalScore,
  getScoreColor,
  getScoreBackground,
} from '@/lib/evaluationUtils';

// Module-level cache across tab navigations
const globalEvaluationDetailCache = new Map();

const EvaluationDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const cachedData = params?.id ? globalEvaluationDetailCache.get(params.id) : null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evaluation, setEvaluation] = useState(() => cachedData?.evaluation || null);
  const [loading, setLoading] = useState(() => !cachedData);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(() => cachedData?.editForm || null);
  const [activeOfficialIndex, setActiveOfficialIndex] = useState(0);

  useEffect(() => {
    const fetchEvaluation = async () => {
      if (!params.id) return;
      try {
        const evalDoc = await getDoc(doc(db, 'evaluations', params.id));
        if (evalDoc.exists()) {
          const evalData = evalDoc.data();

          // Parallelize fetching referee and evaluator docs
          const refereePromise = evalData.refereeId ? getDoc(doc(db, 'users', evalData.refereeId)) : Promise.resolve(null);
          const evaluatorPromise = evalData.evaluatorId ? getDoc(doc(db, 'users', evalData.evaluatorId)) : Promise.resolve(null);

          const [refereeDoc, evaluatorDoc] = await Promise.all([refereePromise, evaluatorPromise]);
          const refereeData = refereeDoc && refereeDoc.exists() ? refereeDoc.data() : null;
          const evaluatorData = evaluatorDoc && evaluatorDoc.exists() ? evaluatorDoc.data() : null;

          const rawScores = evalData.scores || evalData.ratings || {};
          const rawComments = evalData.comments || {};

          // Initial unwrap for official 0
          let initialScores = rawScores;
          if (initialScores.official_0 && typeof initialScores.official_0 === 'object') {
            initialScores = initialScores.official_0;
          } else if (initialScores.official && typeof initialScores.official === 'object') {
            initialScores = initialScores.official;
          }

          let initialComments = rawComments;
          if (initialComments.official_0 && typeof initialComments.official_0 === 'object') {
            initialComments = initialComments.official_0;
          }

          let totalScore = evalData.totalScore ?? evalData.overallScore ?? evalData.score;
          const scoreValues = Object.values(initialScores).filter(v => typeof v === 'number');
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
            rawScores,
            rawComments,
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
            scores: initialScores,
            totalScore,
            maxScore,
            tierAssigned: evalData.tier || refereeData?.tier || 'N/A',
            comments: initialComments,
            recommendations: evalData.recommendations || evalData.feedback || evalData.groupComment || 'None provided.',
            submittedAt: evalData.createdAt ? new Date(evalData.createdAt.seconds * 1000).toISOString() : null,
          };

          const initialEditForm = {
            scores: { ...initialScores },
            comments: initialComments,
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

  const officialsList = useMemo(() => {
    return getEvaluationOfficials(evaluation);
  }, [evaluation]);

  const activeOfficial = officialsList[activeOfficialIndex] || officialsList[0] || {
    name: evaluation?.referee?.name || 'Official',
    tier: evaluation?.tierAssigned || 'N/A',
  };

  const activeScores = useMemo(() => {
    return getScoresForOfficial(evaluation, activeOfficial.index ?? activeOfficialIndex);
  }, [evaluation, activeOfficial.index, activeOfficialIndex]);

  const activeComments = useMemo(() => {
    return getCommentsForOfficial(evaluation, activeOfficial.index ?? activeOfficialIndex);
  }, [evaluation, activeOfficial.index, activeOfficialIndex]);

  const calculatedTotal = getOfficialTotalScore(activeScores);
  const activeTotalScore = calculatedTotal || evaluation?.totalScore || 0;

  const activeCategories = useMemo(() => {
    const scoresToCheck = isEditing ? editForm?.scores : activeScores;
    if (!scoresToCheck) return OFFICIAL_CATEGORIES;
    const keys = Object.keys(scoresToCheck);
    const hasOfficial = OFFICIAL_CATEGORIES.some(c => keys.includes(c.key));
    if (hasOfficial) return OFFICIAL_CATEGORIES;
    const hasLegacy = LEGACY_CATEGORIES.some(c => keys.includes(c.key));
    if (hasLegacy) return LEGACY_CATEGORIES;
    return OFFICIAL_CATEGORIES;
  }, [isEditing, editForm?.scores, activeScores]);


  const handleEditToggle = () => {
    if (isEditing) {
      // Reset editForm to currently active official
      setEditForm({
        scores: { ...activeScores },
        comments: activeComments,
        recommendations: evaluation.recommendations,
        tierAssigned: activeOfficial.tier || evaluation.tierAssigned,
      });
      setIsEditing(false);
    } else {
      setEditForm({
        scores: { ...activeScores },
        comments: activeComments,
        recommendations: evaluation.recommendations,
        tierAssigned: activeOfficial.tier || evaluation.tierAssigned,
      });
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
  };

  const handleSaveChanges = async () => {
    try {
      const newTotalScore = Object.values(editForm.scores).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      const evalRef = doc(db, 'evaluations', params.id);

      const isGroup = evaluation.rawScores && (evaluation.rawScores.official_0 || evaluation.officials);
      let updatedScoresPayload = editForm.scores;
      let updatedCommentsPayload = editForm.comments;

      if (isGroup) {
        const offKey = `official_${activeOfficialIndex}`;
        updatedScoresPayload = {
          ...(typeof evaluation.rawScores === 'object' ? evaluation.rawScores : {}),
          [offKey]: editForm.scores,
        };
        updatedCommentsPayload = {
          ...(typeof evaluation.rawComments === 'object' ? evaluation.rawComments : {}),
          [offKey]: editForm.comments,
        };
      }

      await updateDoc(evalRef, {
        scores: updatedScoresPayload,
        totalScore: newTotalScore,
        comments: updatedCommentsPayload,
        recommendations: editForm.recommendations,
        tier: editForm.tierAssigned,
      });

      // Sync tier to referee profile if single evaluation or primary official
      const refId = activeOfficial.id && !activeOfficial.id.startsWith('official_') ? activeOfficial.id : evaluation.refereeId;
      if (refId) {
        try {
          const refereeRef = doc(db, 'users', refId);
          await updateDoc(refereeRef, {
            suggestedTier: editForm.tierAssigned
          });
        } catch (err) {
          console.error("Error syncing tier to user profile:", err);
        }
      }

      toast.success("Evaluation updated successfully!");

      const updatedEval = {
        ...evaluation,
        rawScores: updatedScoresPayload,
        rawComments: updatedCommentsPayload,
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
                  className='flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer'
                >
                  <HiX className='w-5 h-5' />
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  className='flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer'
                >
                  <HiCheck className='w-5 h-5' />
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={handleEditToggle}
                className='flex items-center gap-2 bg-accent hover:opacity-90 text-white px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer'
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
            {/* Group Evaluation Tabs Switcher */}
            {officialsList.length > 1 && (
              <div className='bg-[#242424] p-4 rounded-[20px] border border-[#3a3a3a]'>
                <div className='text-xs text-[#9ca3af] font-semibold uppercase tracking-wider mb-2.5'>
                  Officials in Group Evaluation ({officialsList.length}):
                </div>
                <div className='flex items-center gap-2 overflow-x-auto pb-1'>
                  {officialsList.map((off, idx) => (
                    <button
                      key={off.id || idx}
                      type='button'
                      onClick={() => {
                        setActiveOfficialIndex(idx);
                        if (isEditing) {
                          const offScores = getScoresForOfficial(evaluation, idx);
                          const offComments = getCommentsForOfficial(evaluation, idx);
                          setEditForm(prev => ({
                            ...prev,
                            scores: { ...offScores },
                            comments: offComments,
                            tierAssigned: off.tier || evaluation.tierAssigned || 'N/A',
                          }));
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        activeOfficialIndex === idx
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

            {/* Evaluation Overview */}
            <div className='bg-accent rounded-[20px] px-6 py-6'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4'>
                <h2 className='text-fluid-2xl font-bold text-white heading'>
                  Evaluation #{evaluation.id}
                </h2>
                {officialsList.length > 1 && (
                  <span className='inline-block self-start sm:self-auto bg-black/20 text-white/90 px-3 py-1 rounded-full text-xs font-semibold'>
                    Viewing: {activeOfficial.name} (Official {activeOfficialIndex + 1} of {officialsList.length})
                  </span>
                )}
              </div>
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
                    {isEditing
                      ? Object.values(editForm.scores || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
                      : activeTotalScore}/{evaluation.maxScore || (activeCategories.length * 5)}
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
                      {activeOfficial.name || evaluation.referee.name}
                    </div>
                  </div>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Email</div>
                    <div className='text-white'>{evaluation.referee.email}</div>
                  </div>
                  <div>
                    <div className='text-sm text-[#9ca3af]'>Current Tier</div>
                    <span className='inline-block px-3 py-1 rounded-full text-sm font-semibold bg-[#e5e7eb] text-[#374151]'>
                      {activeOfficial.tier || evaluation.referee.tier}
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
                    : getCategoryScore(activeScores, category.key);

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
                            className="w-16 bg-[#1a1a1a] border border-[#4a4a4a] text-white text-center rounded p-1"
                          />
                        ) : (
                          <div className={`font-bold ${getScoreColor(score, category.max)}`}>
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

            {/* Crew / Game Comment (if group evaluation) */}
            {evaluation.groupComment && (
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-accent/40'>
                <h3 className='text-fluid-xl font-semibold text-accent mb-2'>
                  Crew / Game Comment
                </h3>
                <p className='text-white/90 leading-relaxed text-fluid-base'>
                  {evaluation.groupComment}
                </p>
              </div>
            )}

            {/* Comments & Recommendations */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Comments */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-6 border border-[#3a3a3a]'>
                <h3 className='text-fluid-xl font-semibold text-white mb-4'>
                  Category Comments ({activeOfficial.name})
                </h3>
                {isEditing ? (
                  <textarea
                    value={typeof editForm.comments === 'string' ? editForm.comments : ''}
                    onChange={(e) => handleTextChange('comments', e.target.value)}
                    className="w-full h-32 bg-[#1a1a1a] border border-[#4a4a4a] rounded-lg p-4 text-white resize-none focus:outline-none focus:border-accent"
                    placeholder="Enter comments..."
                  />
                ) : (
                  typeof activeComments === 'object' && activeComments !== null ? (
                    <div className='space-y-4'>
                      {Object.entries(activeComments)
                        .filter(([k, c]) => c && typeof c === 'string' && c.trim().length > 0 && !k.startsWith('official_'))
                        .map(([category, comment]) => (
                        <div key={category} className='bg-[#242424] p-3.5 rounded-xl border border-[#3a3a3a]'>
                          <div className='text-sm text-accent font-semibold capitalize mb-1'>
                            {category.replace(/([A-Z])/g, ' $1')}
                          </div>
                          <p className='text-white/90 text-sm leading-relaxed'>{comment}</p>
                        </div>
                      ))}
                      {Object.entries(activeComments).filter(([k, c]) => c && typeof c === 'string' && c.trim().length > 0 && !k.startsWith('official_')).length === 0 && (
                        <p className='text-[#9ca3af] leading-relaxed'>No specific comments provided for {activeOfficial.name}.</p>
                      )}
                    </div>
                  ) : (
                    <p className='text-white/90 leading-relaxed'>
                      {typeof activeComments === 'string' && activeComments ? activeComments : 'No comments provided.'}
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
                    {activeOfficial.tier || evaluation.tierAssigned}
                  </span>
                )}

                <div className='text-sm text-[#9ca3af]'>
                  Based on total score of {isEditing ? Object.values(editForm.scores || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) : activeTotalScore}/
                  {evaluation.maxScore || (activeCategories.length * 5)}
                </div>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className='flex items-center gap-2 text-white hover:text-[#9ca3af] transition-colors text-fluid-base text-body cursor-pointer'
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