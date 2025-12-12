'use client';

import React, { useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import BackButton from '@/components/BackButton';
import { HiOutlineUsers, HiOutlineDocumentText, HiMenu } from 'react-icons/hi';
import { HiStar } from 'react-icons/hi2';
import { FaTrophy } from 'react-icons/fa';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const CHART_DATA = [
  { week: 'Week 1', evaluations: 5 },
  { week: 'Week 2', evaluations: 8 },
  { week: 'Week 3', evaluations: 12 },
  { week: 'Week 4', evaluations: 7 },
  { week: 'Week 5', evaluations: 15 },
  { week: 'Week 6', evaluations: 10 },
];

const STATS = [
  {
    id: 1,
    title: 'Total Officials',
    value: '5',
    icon: HiOutlineUsers,
    bgClass: 'bg-[#e0f2fe]',
    iconClass: 'text-[#0ea5e9]',
  },
  {
    id: 2,
    title: 'Total Evaluations',
    value: '3',
    icon: HiOutlineDocumentText,
    bgClass: 'bg-[#dbeafe]',
    iconClass: 'text-[#3b82f6]',
  },
  {
    id: 3,
    title: 'Average Rating',
    value: '36.0',
    suffix: '/40',
    icon: HiStar,
    bgClass: 'bg-[#fef3c7]',
    iconClass: 'text-[#f59e0b]',
  },
  {
    id: 4,
    title: 'Top Tier Officials',
    icon: FaTrophy,
    bgClass: 'bg-[#e9d5ff]',
    iconClass: 'text-[#a855f7]',
    list: ['Sarah Williams', 'Robert Miller', 'Michael Johnson'],
  },
];

const RECENT_EVALUATIONS = [
  {
    date: 'Oct 27, 2025',
    evaluator: 'John Smith',
    official: 'Michael Johnson',
    score: '37/40',
    tier: 'Tier 150',
    tierClass: 'bg-[#dbeafe] text-[#1e40af]',
  },
  {
    date: 'Oct 24, 2025',
    evaluator: 'John Smith',
    official: 'Sarah Williams',
    score: '39/40',
    tier: 'Tier 100',
    tierClass: 'bg-[#fef3c7] text-[#92400e]',
  },
  {
    date: 'Oct 19, 2025',
    evaluator: 'John Smith',
    official: 'David Brown',
    score: '32/40',
    tier: 'Tier 250',
    tierClass: 'bg-[#e0e7ff] text-[#3730a3]',
  },
];

const AdminDashboardPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className='flex-1 lg:ml-64'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-4 lg:px-8 lg:py-6 flex items-center gap-3'>
          <BackButton variant='solid' className='shrink-0' />
          {/* Hamburger Menu - Mobile Only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-3xl font-semibold text-white heading'>
            Dashboard Overview
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8'>
              {STATS.map(({ id, title, value, suffix, icon: Icon, bgClass, iconClass, list }) => (
                <div
                  key={id}
                  className='bg-[#2a2a2a] rounded-[20px] p-6 border-t-4 border-accent'
                >
                  <div
                    className={`w-14 h-14 ${bgClass} rounded-[16px] flex items-center justify-center mb-4`}
                  >
                    <Icon className={`w-7 h-7 ${iconClass}`} />
                  </div>

                  <div className='text-fluid-base text-[#9ca3af] text-body mb-2 font-medium'>
                    {title}
                  </div>

                  {list ? (
                    <ul className='space-y-1.5'>
                      {list.map((name, index) => (
                        <li
                          key={index}
                          className='text-fluid-base text-white text-body flex items-center gap-2'
                        >
                          <span className='w-1.5 h-1.5 bg-white rounded-full' />
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className='text-fluid-4xl font-bold text-white heading'>
                      {value}
                      {suffix && <span className='text-fluid-2xl text-[#6b7280]'>{suffix}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Section - Table and Chart */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6'>
              {/* Recent Evaluations Table */}
              <div className='lg:col-span-2 bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a]'>
                <h2 className='text-fluid-xl font-semibold text-white text-body mb-4 lg:mb-6'>
                  Recent Evaluations
                </h2>

                <div className='overflow-x-auto -mx-4 lg:mx-0'>
                  <div className='inline-block min-w-full align-middle'>
                    <div className='overflow-hidden'>
                      <table className='w-full'>
                        <thead>
                          <tr className='border-b border-[#3a3a3a]'>
                            <th className='text-left py-3 px-2 lg:px-4 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                              Date
                            </th>
                            <th className='text-left py-3 px-2 lg:px-4 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                              Evaluator
                            </th>
                            <th className='text-left py-3 px-2 lg:px-4 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                              Official
                            </th>
                            <th className='text-left py-3 px-2 lg:px-4 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                              Score
                            </th>
                            <th className='text-left py-3 px-2 lg:px-4 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                              Tier
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {RECENT_EVALUATIONS.map((evaluation, index) => (
                            <tr
                              key={index}
                              className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors'
                            >
                              <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                {evaluation.date}
                              </td>
                              <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                {evaluation.evaluator}
                              </td>
                              <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                {evaluation.official}
                              </td>
                              <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body font-medium whitespace-nowrap'>
                                {evaluation.score}
                              </td>
                              <td className='py-3 lg:py-4 px-2 lg:px-4'>
                                <span
                                  className={`inline-block px-3 lg:px-4 py-1 lg:py-1.5 rounded-full text-fluid-sm font-semibold whitespace-nowrap ${evaluation.tierClass}`}
                                >
                                  {evaluation.tier}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluations per Week Chart */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a]'>
                <h2 className='text-fluid-xl font-semibold text-white text-body mb-4 lg:mb-6'>
                  Evaluations per Week
                </h2>

                <div className='h-[250px] lg:h-[300px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={CHART_DATA}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#3a3a3a' />
                      <XAxis
                        dataKey='week'
                        stroke='#6b7280'
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke='#6b7280'
                        style={{ fontSize: '12px' }}
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
                        stroke='#06b6d4'
                        strokeWidth={2}
                        dot={{ fill: '#06b6d4', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
