'use client';

import React, { useState, useRef, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiChevronDown, HiCheck, HiSearch, HiCalendar } from 'react-icons/hi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const scoreCategories = [
  { label: 'Court Presence', key: 'courtPresence', max: 5 },
  { label: 'Communication', key: 'communication', max: 5 },
  { label: 'Game Management', key: 'gameManagement', max: 5 },
  { label: 'Rules Knowledge', key: 'rulesKnowledge', max: 5 },
  { label: 'Physical Fitness', key: 'physicalFitness', max: 5 },
  { label: 'Professionalism', key: 'professionalism', max: 5 },
];

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
  const [evaluations, setEvaluations] = useState([]);
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    thisWeek: 0,
    avgScore: 0,
  });
  const [loading, setLoading] = useState(true);
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
        const evalDate = new Date(e.createdAt.seconds * 1000);
        return evalDate.getDate() === d.getDate() && evalDate.getMonth() === d.getMonth() && evalDate.getFullYear() === d.getFullYear();
      }).length,
    };
  }).reverse();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const evaluationsQuery = query(collection(db, 'evaluations'));
      const evaluationsSnapshot = await getDocs(evaluationsQuery);
      const evaluationsData = await Promise.all(
        evaluationsSnapshot.docs.map(async (evalDoc) => {
          const evaluation = evalDoc.data();
          const refereeDoc = await getDoc(doc(db, 'users', evaluation.refereeId));
          const evaluatorDoc = await getDoc(doc(db, 'users', evaluation.evaluatorId));
          return {
            id: doc.id,
            ...evaluation,
            refereeName: refereeDoc.data()?.displayName || 'Unknown',
            evaluatorName: evaluatorDoc.data()?.displayName || 'Unknown',
            tier: refereeDoc.data()?.tier || 'N/A',
            tierColor: getTierColor(refereeDoc.data()?.tier || 'N/A'),
          };
        })
      );
      setEvaluations(evaluationsData);

      // Calculate stats
      const totalEvaluations = evaluationsData.length;
      const now = new Date();
      const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const thisWeekEvaluations = evaluationsData.filter(e => new Date(e.createdAt.seconds * 1000) > oneWeekAgo);
      const totalScore = evaluationsData.reduce((acc, cur) => acc + cur.totalScore, 0);
      const avgScore = totalEvaluations > 0 ? (totalScore / totalEvaluations).toFixed(1) : 0;

      setStats({
        totalEvaluations,
        thisWeek: thisWeekEvaluations.length,
        avgScore,
      });

      setLoading(false);
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
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedEvaluation(null);
  };

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((evaluation) => {
    const matchesSearch =
      evaluation.refereeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evaluation.evaluatorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = selectedTier === 'All Tiers' || evaluation.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className='flex-1 lg:ml-64 overflow-y-auto'>
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
            <div className='flex flex-col sm:flex-row gap-4 mb-6'>
              {/* Search Input */}
              <div className='flex-1 relative'>
                <HiSearch className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]' />
                <input
                  type='text'
                  placeholder='Search by official or evaluator...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-[#2a2a2a] text-white placeholder-[#6b7280] rounded-lg pl-10 pr-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a]'
                />
              </div>

              {/* Tier Filter Dropdown */}
              <div className='relative w-full sm:w-[200px]' ref={tierDropdownRef}>
                <button
                  onClick={() => setShowTierDropdown(!showTierDropdown)}
                  className='w-full bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] hover:border-[#4a4a4a] flex items-center justify-between gap-2'
                >
                  <span className='flex items-center gap-2'>
                    <svg className='w-5 h-5 text-[#6b7280]' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' />
                    </svg>
                    {selectedTier}
                  </span>
                  <HiChevronDown
                    className={`w-5 h-5 text-white transition-transform duration-300 ${showTierDropdown ? 'rotate-180' : ''
                      }`}
                  />
                </button>

                {showTierDropdown && (
                  <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                    {tierOptions.map((tier) => (
                      <button
                        key={tier}
                        onClick={() => handleTierSelect(tier)}
                        className={`w-full px-4 py-3 text-fluid-base text-body text-left transition-all flex items-center justify-between ${selectedTier === tier
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
              <div className='relative w-full sm:w-[200px]' ref={timeDropdownRef}>
                <button
                  onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                  className='w-full bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] hover:border-[#4a4a4a] flex items-center justify-between gap-2'
                >
                  <span className='flex items-center gap-2'>
                    <HiCalendar className='w-5 h-5 text-[#6b7280]' />
                    {selectedTime}
                  </span>
                  <HiChevronDown
                    className={`w-5 h-5 text-white transition-transform duration-300 ${showTimeDropdown ? 'rotate-180' : ''
                      }`}
                  />
                </button>

                {showTimeDropdown && (
                  <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                    {timeOptions.map((time) => (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        className={`w-full px-4 py-3 text-fluid-base text-body text-left transition-all flex items-center justify-between ${selectedTime === time
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

            {/* Evaluations Table */}
            <div className='bg-[#2a2a2a] rounded-[20px] overflow-hidden border border-[#3a3a3a] mb-6'>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-accent'>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        DATE
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        EVALUATOR NAME
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        OFFICIAL NAME
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        TOTAL SCORE
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        TIER
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
                    ) : filteredEvaluations.length > 0 ? (
                      filteredEvaluations.map((evaluation) => (
                        <tr
                          key={evaluation.id}
                          onClick={() => handleViewEvaluation(evaluation)}
                          className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer'
                        >
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {new Date(evaluation.createdAt.seconds * 1000).toLocaleDateString()}
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
            {/* Header */}
            <div className='bg-accent rounded-t-[20px] px-6 py-5'>
              <h2 className='text-fluid-3xl font-bold text-white heading mb-2'>
                {selectedEvaluation.refereeName}
              </h2>
              <p className='text-fluid-base text-white/90 text-body'>
                {new Date(selectedEvaluation.createdAt.seconds * 1000).toLocaleDateString()} • Evaluator: {selectedEvaluation.evaluatorName}
              </p>
            </div>

            {/* Content */}
            <div className='p-6'>
              {/* Category Scores */}
              <h3 className='text-fluid-2xl font-semibold text-white heading mb-4'>
                Category Scores
              </h3>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6'>
                {scoreCategories.map((category) => {
                  const score = selectedEvaluation.scores?.[category.key] || 0;
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
                      {selectedEvaluation.totalScore}/{scoreCategories.reduce((acc, cat) => acc + cat.max, 0)}
                    </div>
                  </div>

                  {/* Previous Tier */}
                  <div>
                    <div className='text-fluid-base text-white/80 text-body mb-1'>
                      Previous Tier
                    </div>
                    <div className='text-fluid-4xl font-bold text-white heading'>
                      {selectedEvaluation.previousTier || 'N/A'}
                    </div>
                  </div>

                  {/* Suggested Tier */}
                  <div>
                    <div className='text-fluid-base text-white/80 text-body mb-1'>
                      Suggested Tier
                    </div>
                    <div className='text-fluid-4xl font-bold text-white heading'>
                      {selectedEvaluation.suggestedTier || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments */}
              <h3 className='text-fluid-2xl font-semibold text-white heading mb-4'>
                Comments
              </h3>

              <div className='space-y-4 mb-6'>
                {Object.entries(selectedEvaluation.comments).map(([category, comment]) => (
                  <div
                    key={category}
                    className='bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]'
                  >
                    <div className='text-fluid-lg font-semibold text-white text-body mb-2 capitalize'>
                      {category.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div className='text-fluid-base text-[#9ca3af] text-body'>
                      {comment}
                    </div>
                  </div>
                ))}
              </div>

              <div className='flex gap-3'>
                <button
                  onClick={handleCloseModal}
                  className='flex-1 bg-[#2a2a2a] hover:bg-[#333333] border border-[#3a3a3a] text-white px-6 py-3 rounded-lg font-medium transition-all text-fluid-lg'
                >
                  Close
                </button>
                <button
                  onClick={() => router.push(`/admin/evaluations/${selectedEvaluation.id}`)}
                  className='flex-1 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all text-fluid-lg'
                >
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationsPage;

