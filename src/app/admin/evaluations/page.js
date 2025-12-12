'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import BackButton from '@/components/BackButton';
import { HiMenu, HiChevronDown, HiCheck, HiSearch, HiCalendar } from 'react-icons/hi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

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
  const chartData = [
    { week: 0, evaluations: 3 },
    { week: 1, evaluations: 2 },
    { week: 2, evaluations: 1 },
    { week: 3, evaluations: 4 },
    { week: 4, evaluations: 1 },
    { week: 5, evaluations: 4 },
    { week: 6, evaluations: 0 },
  ];

  // Mock data for evaluations
  const evaluations = [
    {
      id: 1,
      date: 'Oct 27, 2025',
      evaluatorName: 'John Smith',
      officialName: 'Michael Johnson',
      game: 'Lakers vs Warriors',
      totalScore: '37/40',
      tier: 'Tier 150',
      tierColor: 'bg-[#e5e7eb] text-[#374151]',
      previousTier: 'Tier 120',
      suggestedTier: 'Tier 150',
      categoryScores: [
        { category: 'Professional Presence', score: 5 },
        { category: 'Communication', score: 4 },
        { category: 'Rule Knowledge', score: 1 },
        { category: 'Mechanics', score: 3 },
        { category: 'Game Management', score: 4 },
        { category: 'Court Coverage', score: 5 },
        { category: 'Consistency', score: 5 },
        { category: 'Decision Making', score: 2 },
      ],
      comments: [
        { category: 'Professional Presence', comment: 'Excellent command of the court' },
        { category: 'Communication', comment: 'Clear and concise' },
      ],
    },
    {
      id: 2,
      date: 'Oct 24, 2025',
      evaluatorName: 'John Smith',
      officialName: 'Sarah Williams',
      game: 'Celtics vs Heat',
      totalScore: '39/40',
      tier: 'Tier 100',
      tierColor: 'bg-[#fbbf24] text-[#78350f]',
      previousTier: 'Tier 100',
      suggestedTier: 'Tier 100',
      categoryScores: [
        { category: 'Professional Presence', score: 5 },
        { category: 'Communication', score: 5 },
        { category: 'Rule Knowledge', score: 5 },
        { category: 'Mechanics', score: 5 },
        { category: 'Game Management', score: 5 },
        { category: 'Court Coverage', score: 5 },
        { category: 'Consistency', score: 5 },
        { category: 'Decision Making', score: 4 },
      ],
      comments: [
        { category: 'Professional Presence', comment: 'Outstanding performance' },
      ],
    },
    {
      id: 3,
      date: 'Oct 19, 2025',
      evaluatorName: 'John Smith',
      officialName: 'David Brown',
      game: 'Bulls vs Nets',
      totalScore: '32/40',
      tier: 'Tier 250',
      tierColor: 'bg-[#93c5fd] text-[#1e3a8a]',
      previousTier: 'Tier 250',
      suggestedTier: 'Tier 250',
      categoryScores: [
        { category: 'Professional Presence', score: 4 },
        { category: 'Communication', score: 4 },
        { category: 'Rule Knowledge', score: 4 },
        { category: 'Mechanics', score: 4 },
        { category: 'Game Management', score: 4 },
        { category: 'Court Coverage', score: 4 },
        { category: 'Consistency', score: 4 },
        { category: 'Decision Making', score: 4 },
      ],
      comments: [
        { category: 'Professional Presence', comment: 'Good overall performance' },
      ],
    },
  ];

  // Stats
  const stats = {
    totalEvaluations: 3,
    thisWeek: 0,
    avgScore: 36.0,
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tierDropdownRef.current && !tierDropdownRef.current.contains(event.target)) {
        setShowTierDropdown(false);
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target)) {
        setShowTimeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
      evaluation.officialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                    className={`w-5 h-5 text-white transition-transform duration-300 ${
                      showTierDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showTierDropdown && (
                  <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                    {tierOptions.map((tier) => (
                      <button
                        key={tier}
                        onClick={() => handleTierSelect(tier)}
                        className={`w-full px-4 py-3 text-fluid-base text-body text-left transition-all flex items-center justify-between ${
                          selectedTier === tier
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
                    className={`w-5 h-5 text-white transition-transform duration-300 ${
                      showTimeDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showTimeDropdown && (
                  <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                    {timeOptions.map((time) => (
                      <button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        className={`w-full px-4 py-3 text-fluid-base text-body text-left transition-all flex items-center justify-between ${
                          selectedTime === time
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
                    {filteredEvaluations.map((evaluation) => (
                      <tr
                        key={evaluation.id}
                        onClick={() => handleViewEvaluation(evaluation)}
                        className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer'
                      >
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                          {evaluation.date}
                        </td>
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                          {evaluation.evaluatorName}
                        </td>
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body'>
                          <div className='font-medium'>{evaluation.officialName}</div>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer - Pagination and Count */}
            <div className='flex flex-col sm:flex-row items-center justify-between gap-4'>
              <p className='text-fluid-base text-white text-body'>
                Showing {filteredEvaluations.length} to {filteredEvaluations.length} of {evaluations.length} evaluations
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
                {selectedEvaluation.officialName}
              </h2>
              <p className='text-fluid-base text-white/90 text-body'>
                {selectedEvaluation.date} • Evaluator: {selectedEvaluation.evaluatorName}
              </p>
            </div>

            {/* Content */}
            <div className='p-6'>
              {/* Category Scores */}
              <h3 className='text-fluid-2xl font-semibold text-white heading mb-4'>
                Category Scores
              </h3>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
                {selectedEvaluation.categoryScores.map((item, index) => (
                  <div
                    key={index}
                    className='bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-fluid-base text-white text-body'>
                        {item.category}
                      </span>
                      <span className='text-fluid-base font-semibold text-white text-body'>
                        {item.score}/5
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className='w-full bg-[#4a4a4a] rounded-full h-2 overflow-hidden'>
                      <div
                        className='bg-accent h-full rounded-full transition-all duration-300'
                        style={{ width: `${(item.score / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
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
                      {selectedEvaluation.totalScore}
                    </div>
                  </div>

                  {/* Previous Tier */}
                  <div>
                    <div className='text-fluid-base text-white/80 text-body mb-1'>
                      Previous Tier
                    </div>
                    <div className='text-fluid-4xl font-bold text-white heading'>
                      {selectedEvaluation.previousTier}
                    </div>
                  </div>

                  {/* Suggested Tier */}
                  <div>
                    <div className='text-fluid-base text-white/80 text-body mb-1'>
                      Suggested Tier
                    </div>
                    <div className='text-fluid-4xl font-bold text-white heading'>
                      {selectedEvaluation.suggestedTier}
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments */}
              <h3 className='text-fluid-2xl font-semibold text-white heading mb-4'>
                Comments
              </h3>

              <div className='space-y-4 mb-6'>
                {selectedEvaluation.comments.map((item, index) => (
                  <div
                    key={index}
                    className='bg-[#2a2a2a] rounded-lg p-4 border border-[#3a3a3a]'
                  >
                    <div className='text-fluid-lg font-semibold text-white text-body mb-2'>
                      {item.category}
                    </div>
                    <div className='text-fluid-base text-[#9ca3af] text-body'>
                      {item.comment}
                    </div>
                  </div>
                ))}
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className='w-full bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all text-fluid-lg'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationsPage;

