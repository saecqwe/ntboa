'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { safeGoBack } from '@/lib/navigationHistory';
import { HiMenu, HiArrowLeft, HiChevronUp, HiChevronDown, HiSelector } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import {
  getEvaluationOfficials,
  getScoresForOfficial,
  getOfficialTotalScore,
} from '@/lib/evaluationUtils';

// Module-level caches across tab navigations
const globalEvaluatorDetailCache = new Map();
const globalRefereeNameCache = new Map();

const EvaluatorDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const cachedData = params?.id ? globalEvaluatorDetailCache.get(params.id) : null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [evaluator, setEvaluator] = useState(() => cachedData?.evaluator || null);
  const [evaluations, setEvaluations] = useState(() => cachedData?.evaluations || []);
  const [loading, setLoading] = useState(() => !cachedData?.evaluator);
  const [evalsLoading, setEvalsLoading] = useState(() => !cachedData);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    const cached = globalEvaluatorDetailCache.get(params.id);
    if (cached) {
      setEvaluator(cached.evaluator);
      setEvaluations(cached.evaluations);
      setLoading(false);
      setEvalsLoading(false);
    } else {
      setEvaluator(null);
      setEvaluations([]);
      setLoading(true);
      setEvalsLoading(true);
    }

    const fetchEvaluatorData = async () => {
      const evaluatorDocRef = doc(db, 'users', params.id);
      const evalsQuery = query(
        collection(db, 'evaluations'),
        where('evaluatorId', '==', params.id)
      );

      const evaluatorPromise = getDoc(evaluatorDocRef);
      const evalsPromise = getDocs(evalsQuery);

      // Step 1: Unblock header, banner, and profile card as soon as evaluator doc resolves
      let evaluatorData = null;
      try {
        const evaluatorDocSnap = await evaluatorPromise;
        if (cancelled) {
          evalsPromise.catch(() => {});
          return;
        }

        if (!evaluatorDocSnap.exists()) {
          toast.error('Evaluator not found');
          setEvaluator(null);
          setLoading(false);
          setEvalsLoading(false);
          evalsPromise.catch(() => {});
          return;
        }

        const data = evaluatorDocSnap.data();
        evaluatorData = {
          id: evaluatorDocSnap.id,
          ...data,
          joinedDate: data.createdAt?.seconds
            ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A',
        };
        setEvaluator(evaluatorData);
        setLoading(false);
      } catch (error) {
        evalsPromise.catch(() => {});
        if (cancelled) return;
        console.error('Error fetching evaluator:', error);
        toast.error('Failed to load evaluator details.');
        setLoading(false);
        setEvalsLoading(false);
        return;
      }

      // Step 2: Render evaluations immediately using denormalized/cached referee names
      try {
        const evalsSnap = await evalsPromise;
        if (cancelled) return;

        const missingRefereeIds = new Set();
        const rawEvals = evalsSnap.docs.map((docSnapshot) => {
          const evalData = docSnapshot.data();
          const officials = getEvaluationOfficials(evalData);

          // Collect real referee IDs (excluding synthetic official_* keys)
          const refereeIdSet = new Set();
          officials.forEach((off) => {
            if (off.id && !String(off.id).startsWith('official_')) {
              refereeIdSet.add(off.id);
            }
          });
          if (Array.isArray(evalData.refereeIds)) {
            evalData.refereeIds.forEach((id) => {
              if (id && !String(id).startsWith('official_')) refereeIdSet.add(id);
            });
          }
          if (evalData.refereeId && !String(evalData.refereeId).startsWith('official_')) {
            refereeIdSet.add(evalData.refereeId);
          }

          // Resolve referee display name(s)
          let refereeDisplay = null;
          if (Array.isArray(evalData.refereeNames) && evalData.refereeNames.length > 0) {
            refereeDisplay = evalData.refereeNames.filter(Boolean).join(', ');
          } else if (Array.isArray(evalData.officials) && evalData.officials.length > 0) {
            const names = evalData.officials.map((o) => o?.name).filter(Boolean);
            if (names.length > 0) refereeDisplay = names.join(', ');
          }

          if (!refereeDisplay) {
            const denormalizedName =
              typeof evalData.refereeName === 'string' ? evalData.refereeName.trim() : '';
            if (denormalizedName && denormalizedName !== 'Unknown') {
              refereeDisplay = denormalizedName;
              if (evalData.refereeId) {
                globalRefereeNameCache.set(evalData.refereeId, denormalizedName);
              }
            } else if (evalData.refereeId && globalRefereeNameCache.has(evalData.refereeId)) {
              refereeDisplay = globalRefereeNameCache.get(evalData.refereeId);
            } else if (evalData.refereeId) {
              missingRefereeIds.add(evalData.refereeId);
              refereeDisplay = null;
            } else {
              refereeDisplay = 'Unknown';
            }
          }

          // Compute per-official average score (out of 40)
          const officialScores = officials
            .map((off) => getOfficialTotalScore(getScoresForOfficial(evalData, off.index)))
            .filter((s) => s > 0);

          let avgScore = 0;
          if (officialScores.length > 0) {
            const sum = officialScores.reduce((acc, s) => acc + s, 0);
            avgScore =
              officialScores.length === 1
                ? officialScores[0]
                : Number((sum / officialScores.length).toFixed(1));
          } else {
            const fallback = Number(evalData.totalScore ?? evalData.overallScore ?? evalData.score ?? 0);
            avgScore = Number.isFinite(fallback) ? fallback : 0;
          }

          return {
            id: docSnapshot.id,
            ...evalData,
            refereeIdsList: Array.from(refereeIdSet),
            refereeDisplay,
            avgScore,
            locationDisplay: evalData.location || 'N/A',
            tierDisplay: evalData.tier
              ? String(evalData.tier).startsWith('Tier ')
                ? evalData.tier
                : `Tier ${evalData.tier}`
              : 'N/A',
            date: evalData.createdAt?.seconds
              ? new Date(evalData.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'N/A',
            timestamp: evalData.createdAt?.seconds || 0,
          };
        });

        rawEvals.sort((a, b) => b.timestamp - a.timestamp);
        setEvaluations(rawEvals);
        setEvalsLoading(false);

        if (missingRefereeIds.size === 0) {
          globalEvaluatorDetailCache.set(params.id, {
            evaluator: evaluatorData,
            evaluations: rawEvals,
          });
          return;
        }

        // Step 3: Batch fetch missing legacy referee names in chunks of 30
        const missingIds = Array.from(missingRefereeIds);
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
              globalRefereeNameCache.set(uDoc.id, uDoc.data().displayName || 'Unknown');
            });
          });

          missingIds.forEach((id) => {
            if (!fetchedIds.has(id)) {
              globalRefereeNameCache.set(id, 'Unknown');
            }
          });

          const resolvedEvals = rawEvals.map((ev) => ({
            ...ev,
            refereeDisplay:
              ev.refereeDisplay ??
              (ev.refereeId ? globalRefereeNameCache.get(ev.refereeId) || 'Unknown' : 'Unknown'),
          }));

          setEvaluations(resolvedEvals);
          globalEvaluatorDetailCache.set(params.id, {
            evaluator: evaluatorData,
            evaluations: resolvedEvals,
          });
        } catch (nameErr) {
          if (cancelled) return;
          console.error('Error resolving referee names:', nameErr);
          toast.error('Failed to resolve some referee names.');
          const fallbackEvals = rawEvals.map((ev) => ({
            ...ev,
            refereeDisplay: ev.refereeDisplay ?? 'Unknown',
          }));
          setEvaluations(fallbackEvals);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching evaluator evaluations:', error);
        toast.error('Failed to load evaluator evaluations.');
        setEvalsLoading(false);
      }
    };

    fetchEvaluatorData();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const isEvalsPending = evalsLoading && evaluations.length === 0;
  const totalEvaluationsDisplay = isEvalsPending
    ? (evaluator?.evaluationsMade ?? '—')
    : evaluations.length;

  const avgScoreGiven = useMemo(() => {
    if (isEvalsPending) return '—';
    if (evaluations.length === 0) return 0;
    const sum = evaluations.reduce((acc, ev) => acc + (Number(ev.avgScore) || 0), 0);
    return (sum / evaluations.length).toFixed(1);
  }, [evaluations, isEvalsPending]);

  const uniqueRefereesCount = useMemo(() => {
    if (isEvalsPending) return '—';
    const set = new Set();
    evaluations.forEach((ev) => {
      (ev.refereeIdsList || []).forEach((rid) => set.add(rid));
    });
    return set.size;
  }, [evaluations, isEvalsPending]);

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
        case 'date':
          comparison = (a.timestamp || 0) - (b.timestamp || 0);
          break;
        case 'refereeDisplay':
          comparison = (a.refereeDisplay || '').localeCompare(b.refereeDisplay || '', undefined, {
            sensitivity: 'base',
          });
          break;
        case 'location':
          comparison = (a.locationDisplay || '').localeCompare(b.locationDisplay || '', undefined, {
            sensitivity: 'base',
          });
          break;
        case 'avgScore':
          comparison = (Number(a.avgScore) || 0) - (Number(b.avgScore) || 0);
          break;
        case 'tier': {
          const tierA = parseTierNumber(a.tierDisplay);
          const tierB = parseTierNumber(b.tierDisplay);
          if (tierA !== tierB) {
            comparison = tierA - tierB;
          } else {
            comparison = (a.tierDisplay || '').localeCompare(b.tierDisplay || '');
          }
          break;
        }
        default:
          comparison = 0;
      }

      return comparison * factor;
    });
  }, [evaluations, sortConfig]);

  const isSuspended = evaluator?.status === 'Disabled';

  const stats = [
    {
      id: 'status',
      label: 'Status',
      value: isSuspended ? 'Suspended' : 'Active',
      type: 'badge',
    },
    {
      id: 'evaluations',
      label: 'Total Evaluations',
      value: totalEvaluationsDisplay,
      subtitle: 'submitted',
      type: 'number',
    },
    {
      id: 'avgScore',
      label: 'Average Score Given',
      value: avgScoreGiven,
      suffix: avgScoreGiven === '—' ? undefined : '/40',
      type: 'number',
    },
    {
      id: 'referees',
      label: 'Referees Evaluated',
      value: uniqueRefereesCount,
      subtitle: 'unique officials',
      type: 'number',
    },
  ];

  const handleViewMore = (evaluationId) => {
    router.push(`/admin/evaluations/${evaluationId}`);
  };

  if (loading) {
    return (
      <div className='flex min-h-screen bg-[#1a1a1a]'>
        <Toaster />
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
              Evaluator Profile
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

  if (!evaluator) {
    return (
      <div className='min-h-screen bg-[#1a1a1a] flex items-center justify-center text-white'>
        <p>Evaluator not found.</p>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
      <Toaster />
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
            Evaluator Profile
          </h1>
        </header>

        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            {/* Evaluator Info Banner */}
            <div className='bg-accent rounded-[20px] px-6 py-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
              <div>
                <div className='flex items-center gap-3 mb-1'>
                  <h2 className='text-fluid-3xl font-bold text-white heading'>
                    {evaluator.displayName}
                  </h2>
                  {isSuspended && (
                    <span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-red-900/60 text-red-100 border border-red-300/40'>
                      Suspended
                    </span>
                  )}
                </div>
                <p className='text-fluid-base text-white/80 text-body'>
                  {evaluator.email}
                </p>
              </div>
              <div className='text-fluid-sm text-white/90 text-body font-medium'>
                Joined {evaluator.joinedDate}
              </div>
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
                        <span
                          className={`inline-block px-5 py-2 rounded-full text-fluid-base font-semibold ${
                            isSuspended
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-[#e5e7eb] text-[#374151]'
                          }`}
                        >
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

            {/* Submitted Evaluations Table */}
            <div className='bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a] mb-6'>
              <h2 className='text-fluid-xl font-semibold text-white text-body mb-4 lg:mb-6'>
                Submitted Evaluations
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
                        onClick={() => handleSort('refereeDisplay')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Referee'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>REFEREE(S)</span>
                          {renderSortIcon('refereeDisplay')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('location')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Location'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>LOCATION</span>
                          {renderSortIcon('location')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('avgScore')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Score'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>SCORE</span>
                          {renderSortIcon('avgScore')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('tier')}
                        className='text-left py-3 px-2 lg:px-4 text-[11px] lg:text-[13px] font-semibold text-[#9ca3af] hover:text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors group'
                        title='Sort by Tier'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>TIER</span>
                          {renderSortIcon('tier')}
                        </div>
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
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-36 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-28 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-14 bg-[#3a3a3a] rounded' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-6 w-20 bg-[#3a3a3a] rounded-full' /></td>
                          <td className='py-4 px-2 lg:px-4'><div className='h-4 w-20 bg-[#3a3a3a] rounded' /></td>
                        </tr>
                      ))
                    ) : sortedEvaluations.length > 0 ? (
                      sortedEvaluations.map((evaluation) => (
                        <tr
                          key={evaluation.id}
                          onClick={() => handleViewMore(evaluation.id)}
                          className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer'
                        >
                          <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body whitespace-nowrap'>
                            {evaluation.date}
                          </td>
                          <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body max-w-[240px] truncate'>
                            {evaluation.refereeDisplay ?? '...'}
                          </td>
                          <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body max-w-[200px] truncate'>
                            {evaluation.locationDisplay}
                          </td>
                          <td className='py-3 lg:py-4 px-2 lg:px-4 text-[12px] lg:text-[14px] text-white text-body font-medium whitespace-nowrap'>
                            {evaluation.avgScore > 0 ? `${evaluation.avgScore}/40` : (evaluation.avgScore || 'N/A')}
                          </td>
                          <td className='py-3 lg:py-4 px-2 lg:px-4'>
                            <span className='inline-block px-4 py-1.5 rounded-full text-[11px] lg:text-[13px] font-semibold whitespace-nowrap bg-[#e5e7eb] text-[#374151]'>
                              {evaluation.tierDisplay}
                            </span>
                          </td>
                          <td className='py-3 lg:py-4 px-2 lg:px-4'>
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewMore(evaluation.id);
                              }}
                              className='text-[12px] lg:text-[14px] text-[#fbbf24] hover:text-[#f59e0b] font-medium transition-colors cursor-pointer'
                            >
                              View More
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan='6' className='text-center py-8 text-[#9ca3af]'>
                          No evaluations submitted by this evaluator yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type='button'
              onClick={() => safeGoBack(router, pathname, '/admin/evaluators')}
              className='flex items-center gap-2 text-white hover:text-[#9ca3af] transition-colors text-fluid-base text-body cursor-pointer'
            >
              <HiArrowLeft className='w-5 h-5' />
              Back to Evaluators List
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EvaluatorDetailPage;
