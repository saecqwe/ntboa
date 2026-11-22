'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiArrowLeft, HiChevronUp, HiChevronDown, HiSelector } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import { getScoresForReferee, getOfficialTotalScore } from '@/lib/evaluationUtils';

// Module-level caches across tab navigations
const globalRefereeDetailCache = new Map();
const globalEvaluatorNameCache = new Map();

const RefereeDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const cachedData = params?.id ? globalRefereeDetailCache.get(params.id) : null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [referee, setReferee] = useState(() => cachedData?.referee || null);
  const [evaluations, setEvaluations] = useState(() => cachedData?.evaluations || []);
  const [loading, setLoading] = useState(() => !cachedData?.referee);
  const [evalsLoading, setEvalsLoading] = useState(() => !cachedData);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    const cached = globalRefereeDetailCache.get(params.id);
    if (cached) {
      setReferee(cached.referee);
      setEvaluations(cached.evaluations);
      setLoading(false);
      setEvalsLoading(false);
    } else {
      setReferee(null);
      setEvaluations([]);
      setLoading(true);
      setEvalsLoading(true);
    }

    const fetchRefereeData = async () => {
      // Launch referee doc and both evaluation queries immediately at t = 0
      const refereeDocRef = doc(db, 'users', params.id);
      const evalsQuerySingle = query(
        collection(db, 'evaluations'),
        where('refereeId', '==', params.id)
      );
      const evalsQueryGroup = query(
        collection(db, 'evaluations'),
        where('refereeIds', 'array-contains', params.id)
      );

      const refereePromise = getDoc(refereeDocRef);
      const evalsPromise = Promise.all([
        getDocs(evalsQuerySingle),
        getDocs(evalsQueryGroup),
      ]);

      // Step 1: Unblock header, banner, and profile stats as soon as referee doc resolves
      let refereeData = null;
      try {
        const refereeDocSnap = await refereePromise;
        if (cancelled) {
          evalsPromise.catch(() => {});
          return;
        }

        if (!refereeDocSnap.exists()) {
          toast.error("Referee not found");
          setReferee(null);
          setLoading(false);
          setEvalsLoading(false);
          evalsPromise.catch(() => {});
          return;
        }

        refereeData = { id: refereeDocSnap.id, ...refereeDocSnap.data() };
        setReferee(refereeData);
        setLoading(false);
      } catch (error) {
        evalsPromise.catch(() => {});
        if (cancelled) return;
        console.error("Error fetching referee:", error);
        toast.error("Failed to load referee details.");
        setLoading(false);
        setEvalsLoading(false);
        return;
      }

      // Step 2: Render evaluation rows immediately using denormalized/cached evaluator names
      try {
        const [snapSingle, snapGroup] = await evalsPromise;
        if (cancelled) return;

        const evalDocsMap = new Map();
        snapSingle.docs.forEach((d) => evalDocsMap.set(d.id, d));
        snapGroup.docs.forEach((d) => evalDocsMap.set(d.id, d));
        const combinedDocs = Array.from(evalDocsMap.values());

        const missingEvaluatorIds = new Set();
        const rawEvals = combinedDocs.map((docSnapshot) => {
          const evalData = docSnapshot.data();

          // Prefer referee-specific official score before falling back to top-level totalScore
          const refScores = getScoresForReferee(evalData, params.id);
          const officialScore = getOfficialTotalScore(refScores);
          const totalScore = officialScore > 0
            ? officialScore
            : (evalData.totalScore ?? evalData.overallScore ?? evalData.score ?? 0);

          const denormalizedName = typeof evalData.evaluatorName === 'string'
            ? evalData.evaluatorName.trim()
            : '';

          let resolvedName = null;
          if (denormalizedName && denormalizedName !== 'Unknown') {
            resolvedName = denormalizedName;
            if (evalData.evaluatorId) {
              globalEvaluatorNameCache.set(evalData.evaluatorId, denormalizedName);
            }
          } else if (evalData.evaluatorId && globalEvaluatorNameCache.has(evalData.evaluatorId)) {
            resolvedName = globalEvaluatorNameCache.get(evalData.evaluatorId);
          } else if (evalData.evaluatorId) {
            missingEvaluatorIds.add(evalData.evaluatorId);
            resolvedName = null;
          } else {
            resolvedName = 'Unknown';
          }

          return {
            id: docSnapshot.id,
            ...evalData,
            totalScore,
            evaluatorName: resolvedName,
            date: evalData.createdAt?.seconds
              ? new Date(evalData.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'N/A',
            timestamp: evalData.createdAt?.seconds || 0,
          };
        });

        rawEvals.sort((a, b) => b.timestamp - a.timestamp);
        setEvaluations(rawEvals);
        setEvalsLoading(false);

        if (missingEvaluatorIds.size === 0) {
          globalRefereeDetailCache.set(params.id, {
            referee: refereeData,
            evaluations: rawEvals,
          });
          return;
        }

        // Step 3: Batch fetch only missing legacy evaluator names in chunks of 30
        const missingIds = Array.from(missingEvaluatorIds);
        const chunks = [];
        for (let i = 0; i < missingIds.length; i += 30) {
          chunks.push(missingIds.slice(i, i + 30));
        }

        try {
          const chunkSnapshots = await Promise.all(
            chunks.map((chunk) =>
              getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
            )
          );
          if (cancelled) return;

          const fetchedIds = new Set();
          chunkSnapshots.forEach((snap) => {
            snap.docs.forEach((uDoc) => {
              fetchedIds.add(uDoc.id);
              globalEvaluatorNameCache.set(uDoc.id, uDoc.data().displayName || 'Unknown');
            });
          });

          // Cache 'Unknown' for deleted/missing IDs so we don't re-query them
          missingIds.forEach((id) => {
            if (!fetchedIds.has(id)) {
              globalEvaluatorNameCache.set(id, 'Unknown');
            }
          });

          const resolvedEvals = rawEvals.map((ev) => ({
            ...ev,
            evaluatorName: ev.evaluatorName ?? (ev.evaluatorId ? globalEvaluatorNameCache.get(ev.evaluatorId) || 'Unknown' : 'Unknown'),
          }));

          setEvaluations(resolvedEvals);
          globalRefereeDetailCache.set(params.id, {
            referee: refereeData,
            evaluations: resolvedEvals,
          });
        } catch (nameErr) {
          if (cancelled) return;
          console.error("Error resolving evaluator names:", nameErr);
          toast.error("Failed to resolve some evaluator names.");
          const fallbackEvals = rawEvals.map((ev) => ({
            ...ev,
            evaluatorName: ev.evaluatorName ?? 'Unknown',
          }));
          setEvaluations(fallbackEvals);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching evaluations:", error);
        toast.error("Failed to load referee evaluations.");
        setEvalsLoading(false);
      }
    };

    fetchRefereeData();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Show pre-aggregated referee stats while evaluations are loading, then exact totals once loaded
  const isEvalsPending = evalsLoading && evaluations.length === 0;
  const totalScoreFromEvals = evaluations.reduce((acc, curr) => acc + (Number(curr.totalScore) || 0), 0);
  const preAggregatedAvg =
    typeof referee?.evaluationsCount === 'number' &&
    referee.evaluationsCount > 0 &&
    typeof referee?.totalScoreSum === 'number'
      ? (referee.totalScoreSum / referee.evaluationsCount).toFixed(1)
      : (referee?.avgScore ?? '—');

  const avgScoreCalculated = isEvalsPending
    ? preAggregatedAvg
    : (evaluations.length > 0
        ? (totalScoreFromEvals / evaluations.length).toFixed(1)
        : (preAggregatedAvg === '—' ? 0 : preAggregatedAvg));
  const totalEvaluationsDisplay = isEvalsPending
    ? (referee?.evaluationsCount ?? referee?.evaluations ?? '—')
    : evaluations.length;
  const evaluatorsCountDisplay = isEvalsPending
    ? '—'
    : new Set(evaluations.map((e) => e.evaluatorId).filter(Boolean)).size;

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  };

  const renderSortIcon = (columnKey) => {
    if (sortConfig.key === columnKey) {
      return sortConfig.direction === 'asc' ? (
        <HiChevronUp className='w-3.5 h-3.5 text-white inline-block transition-transform shrink-0' />
      ) : (
        <HiChevronDown className='w-3.5 h-3.5 text-white inline-block transition-transform shrink-0' />
      );
    }
    return (
      <HiSelector className='w-3.5 h-3.5 text-[#9ca3af]/60 group-hover:text-white inline-block transition-colors shrink-0' />
    );
  };

  const sortedEvaluations = useMemo(() => {
    const list = [...evaluations];
    if (!sortConfig.key) return list;

    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;

    const parseTierNumber = (tier) => {
      if (!tier) return -1;
      const num = parseInt(String(tier).replace(/\D/g, ''), 10);
      return isNaN(num) ? -1 : num;
    };

    return list.sort((a, b) => {
      let comparison = 0;

      switch (key) {
        case 'date': {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          comparison = timeA - timeB;
          break;
        }
        case 'evaluatorName':
          comparison = (a.evaluatorName || '').localeCompare(b.evaluatorName || '', undefined, { sensitivity: 'base' });
          break;
        case 'totalScore': {
          const scoreA = Number(a.totalScore) || 0;
          const scoreB = Number(b.totalScore) || 0;
          comparison = scoreA - scoreB;
          break;
        }
        case 'tier': {
          const tierA = parseTierNumber(a.tier);
          const tierB = parseTierNumber(b.tier);
          if (tierA !== tierB) {
            comparison = tierA - tierB;
          } else {
            comparison = (a.tier || '').localeCompare(b.tier || '');
          }
          break;
        }
        default:
          comparison = 0;
      }

      return comparison * factor;
    });
  }, [evaluations, sortConfig]);

  // Stats configuration
  const stats = [
    {
      id: 'tier',
      label: 'Current Tier',
      value: referee?.tier || 'N/A',
      type: 'badge',
    },
    {
      id: 'score',
      label: 'Average Score',
      value: avgScoreCalculated,
      suffix: avgScoreCalculated === '—' ? undefined : '/40',
      type: 'number',
    },
    {
      id: 'evaluations',
      label: 'Total Evaluations',
      value: totalEvaluationsDisplay,
      subtitle: 'completed',
      type: 'number',
    },
    {
      id: 'evaluators',
      label: 'Evaluators',
      value: evaluatorsCountDisplay,
      subtitle: 'assigned',
      type: 'number',
    },
  ];

  // Handler for viewing evaluation details
  const handleViewMore = (evaluationId) => {
    // Navigate to evaluation detail page
    router.push(`/admin/evaluations/${evaluationId}`);
  };

  if (loading) {
    return (
      <div className='flex min-h-screen bg-[#1a1a1a]'>
        <Toaster />
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className='flex-1 lg:ml-64'>
          <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-4 lg:px-8 lg:py-6 flex items-center gap-4'>
            <BackButton variant='solid' className='shrink-0' />
            <button
              onClick={() => setSidebarOpen(true)}
              className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
            >
              <HiMenu className='w-6 h-6' />
            </button>
            <h1 className='text-fluid-3xl font-semibold text-white heading'>
              Referee Profile
            </h1>
          </header>

          <div className='p-4 lg:p-8'>
            <div className='max-w-7xl mx-auto animate-pulse'>
              <div className='bg-[#2a2a2a] rounded-[20px] px-6 py-6 mb-6 border border-[#3a3a3a]'>
                <div className='h-8 w-56 bg-[#3a3a3a] rounded mb-2' />
                <div className='h-4 w-48 bg-[#3a3a3a] rounded' />
              </div>

              <div className='mb-6'>
                <div className='p-4 border border-[#3a3a3a] rounded-[20px] overflow-hidden'>
                  <div className='grid grid-cols-2 lg:grid-cols-4 bg-[#3a3a3a] overflow-hidden rounded-[20px] gap-[3px]'>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className='p-6 lg:p-8 bg-[#2a2a2a]'>
                        <div className='h-4 w-24 bg-[#3a3a3a] rounded mb-3' />
                        <div className='h-9 w-16 bg-[#3a3a3a] rounded mb-1' />
                        <div className='h-3 w-14 bg-[#3a3a3a] rounded' />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className='bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a]'>
                <div className='h-6 w-40 bg-[#3a3a3a] rounded mb-6' />
                <div className='space-y-4'>
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className='h-10 bg-[#3a3a3a]/70 rounded' />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!referee) {
      return (
          <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-white">
              <p>Referee not found.</p>
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
            Referee Profile
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            {/* Referee Info Banner */}
            <div className='bg-accent  rounded-[20px] px-6 py-6 mb-6'>
              <h2 className='text-fluid-3xl font-bold text-white heading mb-1'>
                {referee.displayName}
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
                      <th
                        onClick={() => handleSort('date')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Date'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>DATE</span>
                          {renderSortIcon('date')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('evaluatorName')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Evaluator Name'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>EVALUATOR NAME</span>
                          {renderSortIcon('evaluatorName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('totalScore')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Total Score'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>TOTAL SCORE</span>
                          {renderSortIcon('totalScore')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('tier')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Tier Assigned'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>TIER ASSIGNED</span>
                          {renderSortIcon('tier')}
                        </div>
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
                    {evalsLoading && evaluations.length === 0 ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={idx} className='border-b border-[#3a3a3a] animate-pulse'>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-24 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-32 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-14 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-6 w-20 bg-[#3a3a3a] rounded-full' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-36 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-20 bg-[#3a3a3a] rounded' /></td>
                        </tr>
                      ))
                    ) : sortedEvaluations.length > 0 ? (
                        sortedEvaluations.map((evaluation) => (
                        <tr
                            key={evaluation.id}
                            className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors'
                        >
                            <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body whitespace-nowrap'>
                            {evaluation.date}
                            </td>
                            <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body whitespace-nowrap'>
                            {evaluation.evaluatorName ?? '...'}
                            </td>
                            <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body font-medium whitespace-nowrap'>
                            {evaluation.totalScore > 0 ? `${evaluation.totalScore}/40` : (evaluation.totalScore || 'N/A')}
                            </td>
                            <td className='py-3 lg:py-4 px-2 lg:px-4'>
                            <span className='inline-block px-4 py-1.5 rounded-full text-[11px] lg:text-[13px] font-semibold whitespace-nowrap bg-[#e5e7eb] text-[#374151]'>
                                {evaluation.tier || 'N/A'}
                            </span>
                            </td>
                            <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body max-w-[200px] truncate'>
                            {evaluation.comments?.general || 'No comments'}
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
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" className="text-center py-8 text-[#9ca3af]">No evaluations found for this referee.</td>
                        </tr>
                    )}
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
