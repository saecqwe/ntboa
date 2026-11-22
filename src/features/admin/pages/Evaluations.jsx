'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, limit, where, documentId } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import { HiMenu, HiChevronDown, HiCheck, HiSearch, HiCalendar, HiChevronUp, HiSelector, HiChevronRight } from 'react-icons/hi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

import {
  OFFICIAL_CATEGORIES,
  LEGACY_CATEGORIES,
  getCategoryScore,
  getEvaluationOfficials,
  getScoresForOfficial,
  getCommentsForOfficial,
  getOfficialTotalScore,
  normalizeTier,
} from '@/lib/evaluationUtils';

// ---------------------------------------------------------------------------
// Module-level cache — survives component unmounts (tab switches).
// ---------------------------------------------------------------------------
let globalEvaluationsCache = {
  evaluations: [],
  stats: { totalEvaluations: 0, thisWeek: 0, avgScore: 0 },
  loaded: false,
  timestamp: 0,
};

const getScoreColor = (score, max) => {
  if (!score) return 'text-gray-400';
  const percentage = (score / max) * 100;
  if (percentage >= 85) return 'text-[#22c55e]'; // Green
  if (percentage >= 70) return 'text-[#eab308]'; // Yellow
  return 'text-[#ef4444]'; // Red
};

const getScoreBackground = (score, max) => {
  if (!score) return 'bg-[#2a2a2a]';
  const percentage = (score / max) * 100;
  if (percentage >= 85) return 'bg-[#22c55e]/10 border-[#22c55e]/20';
  if (percentage >= 70) return 'bg-[#eab308]/10 border-[#eab308]/20';
  return 'bg-[#ef4444]/10 border-[#ef4444]/20';
};

const getTierColor = (tier) => {
  switch (tier) {
    case 'Tier 100': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'Tier 150': return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'Tier 200': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'Tier 250': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
  }
};

const EvaluationsPage = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('All Tiers');
  const [selectedTime, setSelectedTime] = useState('All Time');
  const [showTierDropdown, setShowTierDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [modalActiveTab, setModalActiveTab] = useState(0);

  // Initialize from module-level cache for instant tab switch renders
  const [evaluations, setEvaluations] = useState(() => globalEvaluationsCache.evaluations);
  const [stats, setStats] = useState(() => globalEvaluationsCache.stats);
  const [loading, setLoading] = useState(() => !globalEvaluationsCache.loaded);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const tierDropdownRef = useRef(null);
  const timeDropdownRef = useRef(null);

  // Tier options
  const tierOptions = [
    'All Tiers',
    'Tier 100',
    'Tier 150',
    'Tier 200',
    'Tier 250',
  ];

  // Time filter options
  const timeOptions = [
    'All Time',
    'This Week',
    'This Month',
    'Last 3 Months',
    'Last 6 Months',
    'This Year',
  ];

  // Chart data for Evaluations per Week
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      week: d.toLocaleDateString('en-US', { weekday: 'short' }),
      evaluations: evaluations.filter(e => {
        const evalDate = e.createdAtDate || (e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000) : null);
        if (!evalDate) return false;
        return evalDate.getDate() === d.getDate() && evalDate.getMonth() === d.getMonth() && evalDate.getFullYear() === d.getFullYear();
      }).length,
    };
  }).reverse();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const evaluationsQuery = query(
          collection(db, 'evaluations'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const evaluationsSnapshot = await getDocs(evaluationsQuery);

        // Collect only missing user IDs not already denormalized on evaluation docs
        const missingUserIds = new Set();
        evaluationsSnapshot.docs.forEach((evalDoc) => {
          const evaluation = evalDoc.data();
          const rId = evaluation.refereeId || (Array.isArray(evaluation.refereeIds) ? evaluation.refereeIds[0] : null);
          const eId = evaluation.evaluatorId;

          const hasRefName = Boolean(
            (typeof evaluation.refereeName === 'string' && evaluation.refereeName.trim() && evaluation.refereeName !== 'Unknown') ||
            (Array.isArray(evaluation.refereeNames) && evaluation.refereeNames.length > 0) ||
            (Array.isArray(evaluation.officials) && evaluation.officials.some((o) => o?.name))
          );
          const hasEvalName = Boolean(
            typeof evaluation.evaluatorName === 'string' &&
            evaluation.evaluatorName.trim() &&
            evaluation.evaluatorName !== 'Unknown'
          );

          if (!hasRefName && rId && !String(rId).startsWith('official_')) {
            missingUserIds.add(rId);
          }
          if (!hasEvalName && eId) {
            missingUserIds.add(eId);
          }
        });

        const userMap = {};
        const missingIds = Array.from(missingUserIds);
        if (missingIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < missingIds.length; i += 30) {
            chunks.push(missingIds.slice(i, i + 30));
          }
          const chunkSnaps = await Promise.all(
            chunks.map((chunk) =>
              getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
            )
          );
          chunkSnaps.forEach((snap) => {
            snap.forEach((uDoc) => {
              userMap[uDoc.id] = uDoc.data();
            });
          });
        }

        const evaluationsData = evaluationsSnapshot.docs.map((evalDoc) => {
          const evaluation = evalDoc.data();
          const rId = evaluation.refereeId || (Array.isArray(evaluation.refereeIds) ? evaluation.refereeIds[0] : null);
          const eId = evaluation.evaluatorId;
          const referee = rId ? userMap[rId] : null;
          const evaluator = eId ? userMap[eId] : null;
          const refName = referee?.displayName || evaluation.refereeName || (Array.isArray(evaluation.refereeNames) ? evaluation.refereeNames.join(', ') : 'Unknown');
          const evalName = evaluator?.displayName || evaluation.evaluatorName || 'Unknown';
          const tier = referee?.tier || evaluation.tier || 'N/A';

          // Normalize scores and calculate total if missing or zero
          let totalScore = evaluation.totalScore ?? evaluation.overallScore ?? evaluation.score;
          if (totalScore === undefined || totalScore === null || totalScore === 0) {
            let rawScores = evaluation.scores || evaluation.ratings || {};
            if (rawScores.official_0 && typeof rawScores.official_0 === 'object') {
              rawScores = rawScores.official_0;
            }
            const scoreValues = Object.values(rawScores).filter(v => typeof v === 'number');
            if (scoreValues.length > 0) {
              totalScore = scoreValues.reduce((a, b) => a + b, 0);
            } else {
              totalScore = 0;
            }
          }

          return {
            id: evalDoc.id,
            ...evaluation,
            totalScore,
            refereeName: refName,
            evaluatorName: evalName,
            tier: tier,
            tierColor: getTierColor(tier),
            createdAtDate: evaluation.createdAt?.seconds
              ? new Date(evaluation.createdAt.seconds * 1000)
              : (evaluation.gameDate ? new Date(evaluation.gameDate) : new Date()),
          };
        });

        // 3. Calculate stats
        const totalEvaluations = evaluationsData.length;
        const now = new Date();
        const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const thisWeekEvaluations = evaluationsData.filter(e => e.createdAtDate >= oneWeekAgo);
        const totalScore = evaluationsData.reduce((acc, cur) => acc + (cur.totalScore || 0), 0);
        const avgScore = totalEvaluations > 0 ? (totalScore / totalEvaluations).toFixed(1) : '0.0';

        const newStats = {
          totalEvaluations,
          thisWeek: thisWeekEvaluations.length,
          avgScore,
        };

        setEvaluations(evaluationsData);
        setStats(newStats);

        // Populate module-level cache
        globalEvaluationsCache = {
          evaluations: evaluationsData,
          stats: newStats,
          loaded: true,
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error('Error fetching evaluations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setShowTierDropdown(false);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setShowTimeDropdown(false);
  };

  const handleViewEvaluation = (evaluation) => {
    setSelectedEvaluation(evaluation);
    setModalActiveTab(0);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedEvaluation(null);
    setModalActiveTab(0);
  };

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((evaluation) => {
    const q = (searchQuery || '').toLowerCase();
    const refName = (evaluation.refereeName || '').toLowerCase();
    const evalName = (evaluation.evaluatorName || '').toLowerCase();
    const matchesSearch = !q || refName.includes(q) || evalName.includes(q);
    const matchesTier = selectedTier === 'All Tiers' || evaluation.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

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
        <HiChevronUp className='w-4 h-4 text-accent inline-block transition-transform shrink-0' />
      ) : (
        <HiChevronDown className='w-4 h-4 text-accent inline-block transition-transform shrink-0' />
      );
    }
    return (
      <HiSelector className='w-4 h-4 text-[#9ca3af]/50 group-hover:text-white inline-block transition-colors shrink-0' />
    );
  };

  const sortedEvaluations = useMemo(() => {
    const list = [...filteredEvaluations];
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
          const timeA = a.createdAtDate ? new Date(a.createdAtDate).getTime() : 0;
          const timeB = b.createdAtDate ? new Date(b.createdAtDate).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case 'evaluatorName':
          comparison = (a.evaluatorName || '').localeCompare(b.evaluatorName || '', undefined, { sensitivity: 'base' });
          break;
        case 'refereeName':
          comparison = (a.refereeName || '').localeCompare(b.refereeName || '', undefined, { sensitivity: 'base' });
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
  }, [filteredEvaluations, sortConfig]);

  return (
    <div className='flex min-h-screen bg-[#1a1a1a] overflow-x-hidden'>
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className='flex-1 min-w-0 lg:ml-64 overflow-y-auto'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-4 lg:px-8 lg:py-6 flex items-center gap-4'>
          {/* Hamburger Menu - Mobile Only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-3xl font-semibold text-white heading'>
            All Evaluations
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            {/* Top Section - Chart and Stats */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6'>
              {/* Evaluations per Week Chart */}
              <div className='lg:col-span-2 bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a]'>
                <h2 className='text-fluid-xl font-semibold text-white text-body mb-4 lg:mb-6'>
                  Evaluations per Week
                </h2>

                <div className='h-[250px] lg:h-[300px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#3a3a3a' />
                      <XAxis
                        dataKey='week'
                        stroke='#6b7280'
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke='#6b7280'
                        style={{ fontSize: '12px' }}
                        domain={[0, 4]}
                        ticks={[0, 1, 2, 3, 4]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #3a3a3a',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Line
                        type='monotone'
                        dataKey='evaluations'
                        stroke='#fff'
                        strokeWidth={2}
                        dot={{ fill: '#fff', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Stats */}
              <div className='bg-accent rounded-[20px] p-6 lg:p-8'>
                <h2 className='text-fluid-xl font-semibold text-white text-body mb-6'>
                  Quick Stats
                </h2>

                {/* Total Evaluations */}
                <div className='mb-6'>
                  <div className='text-fluid-base text-white/90 text-body mb-2'>
                    Total Evaluations
                  </div>
                  <div className='text-fluid-5xl font-bold text-white heading'>
                    {stats.totalEvaluations}
                  </div>
                </div>

                {/* This Week */}
                <div className='mb-6'>
                  <div className='text-fluid-base text-white/90 text-body mb-2'>
                    This Week
                  </div>
                  <div className='text-fluid-5xl font-bold text-white heading'>
                    {stats.thisWeek}
                  </div>
                </div>

                {/* Avg Score */}
                <div>
                  <div className='text-fluid-base text-white/90 text-body mb-2'>
                    Avg Score
                  </div>
                  <div className='text-fluid-5xl font-bold text-white heading'>
                    {stats.avgScore}
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className='flex flex-col md:flex-row gap-3 md:gap-4 mb-6'>
              {/* Search Input */}
              <div className='w-full md:flex-1 relative'>
                <HiSearch className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]' />
                <input
                  type='text'
                  placeholder='Search by official or evaluator...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-[#2a2a2a] text-white placeholder-[#6b7280] rounded-lg pl-10 pr-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a]'
                />
              </div>

              {/* Tier & Time Filter Dropdowns: Side-by-side on mobile (2 columns), flex row on desktop */}
              <div className='grid grid-cols-2 gap-3 md:flex md:gap-4 md:w-auto'>
                {/* Tier Filter Dropdown */}
                <div className='relative w-full md:w-[200px]' ref={tierDropdownRef}>
                  <button
                    onClick={() => setShowTierDropdown(!showTierDropdown)}
                    className='w-full bg-[#2a2a2a] text-white rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] hover:border-[#4a4a4a] flex items-center justify-between gap-1.5 sm:gap-2'
                  >
                    <span className='flex items-center gap-1.5 sm:gap-2 truncate'>
                      <svg className='w-4 h-4 sm:w-5 sm:h-5 text-[#6b7280] shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' />
                      </svg>
                      <span className='truncate'>{selectedTier}</span>
                    </span>
                    <HiChevronDown
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0 transition-transform duration-300 ${showTierDropdown ? 'rotate-180' : ''
                        }`}
                    />
                  </button>

                  {showTierDropdown && (
                    <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                      {tierOptions.map((tier) => (
                        <button
                          key={tier}
                          onClick={() => handleTierSelect(tier)}
                          className={`w-full px-4 py-3 text-sm sm:text-fluid-base text-body text-left transition-all flex items-center justify-between ${selectedTier === tier
                            ? 'bg-accent/20 text-white border-l-4 border-accent'
                            : 'text-white hover:bg-[#3a3a3a]'
                            }`}
                        >
                          <span>{tier}</span>
                          {selectedTier === tier && (
                            <HiCheck className='w-5 h-5 text-accent' />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Time Filter Dropdown */}
                <div className='relative w-full md:w-[200px]' ref={timeDropdownRef}>
                  <button
                    onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                    className='w-full bg-[#2a2a2a] text-white rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] hover:border-[#4a4a4a] flex items-center justify-between gap-1.5 sm:gap-2'
                  >
                    <span className='flex items-center gap-1.5 sm:gap-2 truncate'>
                      <HiCalendar className='w-4 h-4 sm:w-5 sm:h-5 text-[#6b7280] shrink-0' />
                      <span className='truncate'>{selectedTime}</span>
                    </span>
                    <HiChevronDown
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0 transition-transform duration-300 ${showTimeDropdown ? 'rotate-180' : ''
                        }`}
                    />
                  </button>

                  {showTimeDropdown && (
                    <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                      {timeOptions.map((time) => (
                        <button
                          key={time}
                          onClick={() => handleTimeSelect(time)}
                          className={`w-full px-4 py-3 text-sm sm:text-fluid-base text-body text-left transition-all flex items-center justify-between ${selectedTime === time
                            ? 'bg-accent/20 text-white border-l-4 border-accent'
                            : 'text-white hover:bg-[#3a3a3a]'
                            }`}
                        >
                          <span>{time}</span>
                          {selectedTime === time && (
                            <HiCheck className='w-5 h-5 text-accent' />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Evaluations Table (>= 768px) */}
            <div className='hidden md:block bg-[#2a2a2a] rounded-[20px] overflow-hidden border border-[#3a3a3a] mb-6'>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-[#202020] border-b-2 border-accent/80'>
                      <th
                        onClick={() => handleSort('date')}
                        className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Date'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>DATE</span>
                          {renderSortIcon('date')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('evaluatorName')}
                        className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Evaluator Name'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>EVALUATOR NAME</span>
                          {renderSortIcon('evaluatorName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('refereeName')}
                        className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Official Name'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>OFFICIAL NAME</span>
                          {renderSortIcon('refereeName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('totalScore')}
                        className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Total Score'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>TOTAL SCORE</span>
                          {renderSortIcon('totalScore')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('tier')}
                        className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Tier'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>TIER</span>
                          {renderSortIcon('tier')}
                        </div>
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        COMMENTS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr key="loading">
                        <td colSpan='6' className='text-center py-12'>
                          <p className='text-[15px] text-[#6b7280] text-body'>
                            Loading evaluations...
                          </p>
                        </td>
                      </tr>
                    ) : sortedEvaluations.length > 0 ? (
                      sortedEvaluations.map((evaluation) => (
                        <tr
                          key={evaluation.id}
                          onClick={() => handleViewEvaluation(evaluation)}
                          className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer'
                        >
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {evaluation.createdAtDate ? evaluation.createdAtDate.toLocaleDateString() : 'N/A'}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {evaluation.evaluatorName}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body'>
                            <div className='font-medium'>{evaluation.refereeName}</div>
                            <div className='text-[12px] text-[#6b7280]'>{evaluation.game}</div>
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {evaluation.totalScore}
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <span
                              className={`inline-block px-4 py-1.5 rounded-full text-fluid-sm font-semibold whitespace-nowrap ${evaluation.tierColor}`}
                            >
                              {evaluation.tier}
                            </span>
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <span className='text-fluid-base text-[#ef4444] font-medium'>
                              View More
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr key="no-results">
                        <td colSpan='6' className='text-center py-12'>
                          <p className='text-[15px] text-[#6b7280] text-body'>
                            No evaluations found.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className='block md:hidden mb-6 space-y-3'>
              {loading ? (
                <div className='bg-[#242424] border border-[#3a3a3a] rounded-2xl p-6 text-center text-[#6b7280] text-sm'>
                  Loading evaluations...
                </div>
              ) : sortedEvaluations.length > 0 ? (
                sortedEvaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    onClick={() => handleViewEvaluation(evaluation)}
                    className='group bg-[#242424] hover:bg-[#2a2a2a] border border-[#3a3a3a] hover:border-accent/40 rounded-2xl p-4 transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.99]'
                  >
                    {/* Card Top Row: Date on left, Tier badge on right */}
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-xs font-medium text-[#9ca3af]'>
                        {evaluation.createdAtDate ? evaluation.createdAtDate.toLocaleDateString() : 'N/A'}
                      </span>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${evaluation.tierColor}`}
                      >
                        {evaluation.tier}
                      </span>
                    </div>

                    {/* Card Body: Official Name bold white, Evaluator directly underneath */}
                    <div className='my-3'>
                      <div className='text-base font-bold text-white group-hover:text-accent transition-colors'>
                        {evaluation.refereeName}
                      </div>
                      {evaluation.game && (
                        <div className='text-xs text-[#6b7280] mt-0.5'>
                          {evaluation.game}
                        </div>
                      )}
                      <div className='text-xs text-[#9ca3af] mt-1'>
                        Evaluator: <span className='text-gray-200 font-medium'>{evaluation.evaluatorName}</span>
                      </div>
                    </div>

                    {/* Card Footer: Total Score on left, View Details / Chevron on right */}
                    <div className='flex items-center justify-between pt-3 border-t border-[#3a3a3a]/70'>
                      <div className='text-xs text-[#9ca3af] flex items-center gap-1.5'>
                        <span>Total Score:</span>
                        <span className='text-sm font-bold text-white px-2 py-0.5 rounded bg-[#2e2e2e] border border-[#3e3e3e]'>
                          {evaluation.totalScore}
                        </span>
                      </div>
                      <div className='flex items-center gap-1 text-xs text-accent font-semibold group-hover:translate-x-0.5 transition-transform'>
                        <span>View Details</span>
                        <HiChevronRight className='w-4 h-4' />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className='bg-[#242424] border border-[#3a3a3a] rounded-2xl p-8 text-center text-[#9ca3af]'>
                  <p className='text-sm'>No evaluations found.</p>
                  {(searchQuery || selectedTier !== 'All Tiers' || selectedTime !== 'All Time') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedTier('All Tiers');
                        setSelectedTime('All Time');
                      }}
                      className='mt-3 text-xs text-accent hover:underline'
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Pagination and Count */}
            <div className='flex flex-col sm:flex-row items-center justify-between gap-4'>
              <p className='text-fluid-base text-white text-body'>
                Showing {filteredEvaluations.length} of {evaluations.length} evaluations
              </p>

              <div className='flex gap-3'>
                <button
                  className='px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] text-white rounded-lg text-fluid-base text-body hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  disabled
                >
                  Previous
                </button>
                <button
                  className='px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] text-white rounded-lg text-fluid-base text-body hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  disabled
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Evaluation Detail Modal */}
      {showDetailModal && selectedEvaluation && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Overlay */}
          <div
            className='absolute inset-0 bg-black/70'
            onClick={handleCloseModal}
          ></div>

          {/* Modal */}
          <div className='relative bg-[#1a1a1a] rounded-[20px] w-full max-w-4xl max-h-[90vh] overflow-y-auto hide-scrollbar z-10'>
            {(() => {
              const modalOfficials = getEvaluationOfficials(selectedEvaluation);
              const activeOfficial = modalOfficials[modalActiveTab] || modalOfficials[0] || { name: selectedEvaluation.refereeName, tier: selectedEvaluation.tier };
              const activeScores = getScoresForOfficial(selectedEvaluation, activeOfficial.index ?? modalActiveTab);
              const activeComments = getCommentsForOfficial(selectedEvaluation, activeOfficial.index ?? modalActiveTab);
              const activeTotalScore = getOfficialTotalScore(activeScores) || selectedEvaluation.totalScore || 0;

              const presentScoreKeys = Object.keys(activeScores);
              const hasOfficialCategories = OFFICIAL_CATEGORIES.some(c => presentScoreKeys.includes(c.key));
              const modalCategories = hasOfficialCategories ? OFFICIAL_CATEGORIES : LEGACY_CATEGORIES;
              const modalMaxScore = modalCategories.reduce((acc, cat) => acc + cat.max, 0);

              return (
                <>
                  {/* Header */}
                  <div className='bg-accent rounded-t-[20px] px-6 py-5'>
                    <h2 className='text-fluid-3xl font-bold text-white heading mb-2'>
                      {modalOfficials.length > 1
                        ? `${activeOfficial.name} (Official ${modalActiveTab + 1} of ${modalOfficials.length})`
                        : (activeOfficial.name || selectedEvaluation.refereeName || 'Evaluation')}
                    </h2>
                    <p className='text-fluid-base text-white/90 text-body'>
                      {selectedEvaluation.createdAtDate ? selectedEvaluation.createdAtDate.toLocaleDateString() : 'N/A'} • Evaluator: {selectedEvaluation.evaluatorName}
                    </p>
                  </div>

                  {/* Content */}
                  <div className='p-6'>
                    {/* Official Switcher Tabs if group evaluation */}
                    {modalOfficials.length > 1 && (
                      <div className='mb-6 bg-[#242424] p-3 rounded-2xl border border-[#3a3a3a]'>
                        <div className='text-xs text-[#9ca3af] font-semibold uppercase tracking-wider mb-2.5'>
                          Select Official in Group Evaluation:
                        </div>
                        <div className='flex items-center gap-2 overflow-x-auto pb-1'>
                          {modalOfficials.map((off, idx) => (
                            <button
                              key={off.id || idx}
                              type='button'
                              onClick={() => setModalActiveTab(idx)}
                              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${modalActiveTab === idx
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

                    {/* Category Scores */}
                    <div className='flex items-center justify-between mb-4'>
                      <h3 className='text-fluid-2xl font-semibold text-white heading'>
                        Category Scores
                      </h3>
                      {modalOfficials.length > 1 && (
                        <span className='text-xs text-white/80 bg-accent/20 border border-accent/40 px-3 py-1 rounded-full'>
                          Showing scores for: <strong className='text-white'>{activeOfficial.name}</strong>
                        </span>
                      )}
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6'>
                      {modalCategories.map((category) => {
                        const score = getCategoryScore(activeScores, category.key);
                        return (
                          <div
                            key={category.key}
                            className={`rounded-lg p-4 border ${getScoreBackground(score, category.max)}`}
                          >
                            <div className='flex items-center justify-between mb-2'>
                              <span className='text-fluid-base text-white text-body'>
                                {category.label}
                              </span>
                              <span className={`text-fluid-lg font-bold ${getScoreColor(score, category.max)}`}>
                                {score}/{category.max}
                              </span>
                            </div>
                            {/* Progress Bar */}
                            <div className='w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden'>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${score > 0 ? getScoreColor(score, category.max).replace('text-', 'bg-') : 'bg-transparent'}`}
                                style={{ width: `${(score / category.max) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary Section */}
                    <div className='bg-accent rounded-[20px] px-6 py-5 mb-6'>
                      <div className='grid grid-cols-3 gap-4'>
                        {/* Total Score */}
                        <div>
                          <div className='text-fluid-base text-white/80 text-body mb-1'>
                            Total Score
                          </div>
                          <div className='text-fluid-4xl font-bold text-white heading'>
                            {activeTotalScore}/{modalMaxScore}
                          </div>
                        </div>

                        {/* Current Tier */}
                        <div>
                          <div className='text-fluid-base text-white/80 text-body mb-1'>
                            Current Tier
                          </div>
                          <div className='text-fluid-4xl font-bold text-white heading'>
                            {activeOfficial.tier || selectedEvaluation.tier || 'N/A'}
                          </div>
                        </div>

                        {/* Suggested Tier */}
                        <div>
                          <div className='text-fluid-base text-white/80 text-body mb-1'>
                            Suggested Tier
                          </div>
                          <div className='text-fluid-4xl font-bold text-white heading'>
                            {activeOfficial.suggestedTier || normalizeTier(selectedEvaluation.suggestedTier || selectedEvaluation.tier) || activeOfficial.tier || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comments */}
                    <h3 className='text-fluid-2xl font-semibold text-white heading mb-4'>
                      Comments
                    </h3>

                    {/* Group / Crew Comment if any */}
                    {selectedEvaluation.groupComment && (
                      <div className='bg-[#2a2a2a] rounded-lg p-4 border border-accent/40 mb-4'>
                        <div className='text-fluid-lg font-semibold text-accent text-body mb-1'>
                          Crew / Game Comment
                        </div>
                        <div className='text-fluid-base text-white/90 text-body'>
                          {selectedEvaluation.groupComment}
                        </div>
                      </div>
                    )}

                    {/* Official Category Comments */}
                    <div className='space-y-4 mb-6'>
                      {typeof activeComments === 'object' && activeComments !== null ? (
                        Object.entries(activeComments).filter(([key, comment]) => typeof comment === 'string' && comment.trim().length > 0 && !key.startsWith('official_')).length > 0 ? (
                          Object.entries(activeComments)
                            .filter(([key, comment]) => typeof comment === 'string' && comment.trim().length > 0 && !key.startsWith('official_'))
                            .map(([category, comment]) => (
                              <div
                                key={category}
                                className='bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]'
                              >
                                <div className='text-fluid-lg font-semibold text-white text-body mb-1 capitalize'>
                                  {category.replace(/([A-Z])/g, ' $1')}
                                </div>
                                <div className='text-fluid-base text-[#9ca3af] text-body'>
                                  {comment}
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className='bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]'>
                            <p className='text-[#9ca3af] text-fluid-base'>No specific comments provided for {activeOfficial.name}.</p>
                          </div>
                        )
                      ) : (
                        <div className='bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]'>
                          <p className='text-fluid-base text-[#9ca3af] text-body'>
                            {typeof activeComments === 'string' && activeComments ? activeComments : 'No comments provided.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            <div className='px-6 pb-6 pt-0 flex gap-3'>
              <button
                onClick={handleCloseModal}
                className='flex-1 bg-[#2a2a2a] hover:bg-[#333333] border border-[#3a3a3a] text-white px-6 py-3 rounded-lg font-medium transition-all text-fluid-lg cursor-pointer'
              >
                Close
              </button>
              <button
                onClick={() => router.push(`/admin/evaluations/${selectedEvaluation.id}`)}
                className='flex-1 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all text-fluid-lg cursor-pointer'
              >
                View Full Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationsPage;

