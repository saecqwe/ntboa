'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiOutlineUsers, HiOutlineDocumentText, HiMenu, HiOutlineSearch } from 'react-icons/hi';
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



const AdminDashboardPage = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allEvaluations, setAllEvaluations] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState([
    {
      id: 1,
      title: 'Total Officials',
      value: '0',
      icon: HiOutlineUsers,
      bgClass: 'bg-[#e0f2fe]',
      iconClass: 'text-[#0ea5e9]',
      link: '/admin/referees',
    },
    {
      id: 2,
      title: 'Evaluations This Week',
      value: '0',
      icon: HiOutlineDocumentText,
      bgClass: 'bg-[#dbeafe]',
      iconClass: 'text-[#3b82f6]',
      link: '/admin/evaluations',
    },
    {
      id: 3,
      title: 'Average Rating',
      value: '0',
      suffix: '/40',
      icon: HiStar,
      bgClass: 'bg-[#fef3c7]',
      iconClass: 'text-[#f59e0b]',
      link: '/admin/evaluators',
    },
    {
      id: 4,
      title: 'Top Tier Officials',
      icon: FaTrophy,
      bgClass: 'bg-[#e9d5ff]',
      iconClass: 'text-[#a855f7]',
      list: [],
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch All Users to build a lookup map
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const userMap = {};
        const referees = [];
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          userMap[doc.id] = data;
          if (data.role === 'referee') {
            referees.push(data);
          }
        });

        const refereesCount = referees.length;
        // Logic for top tier: simply taking the first 3 referees found for now
        const topReferees = referees.slice(0, 3).map((r) => r.displayName || 'Unknown');

        // 2. Fetch All Evaluations
        const evaluationsQuery = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'));
        const evaluationsSnapshot = await getDocs(evaluationsQuery);

        const evaluationsData = evaluationsSnapshot.docs.map((doc) => {
          const data = doc.data();
          const referee = userMap[data.refereeId];
          const evaluator = userMap[data.evaluatorId];
          return {
            id: doc.id,
            ...data,
            refereeName: referee?.displayName || 'Unknown',
            evaluatorName: evaluator?.displayName || 'Unknown',
            tier: referee?.tier || 'N/A',
            createdAtDate: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
          };
        });

        const evaluationsCount = evaluationsData.length;

        // Calculate Average Score
        const totalScore = evaluationsData.reduce((acc, cur) => acc + (cur.totalScore || 0), 0);
        const averageScore = evaluationsCount > 0 ? (totalScore / evaluationsCount).toFixed(1) : '0.0';

        // Calculate Evaluations This Week
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const evaluationsThisWeek = evaluationsData.filter(ev => ev.createdAtDate >= oneWeekAgo).length;

        // 3. Process Chart Data (Last 7 Days)
        const days = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('en-US', { weekday: 'short' });
          days[key] = 0;
        }

        evaluationsData.forEach((ev) => {
          const date = ev.createdAtDate;
          const key = date.toLocaleDateString('en-US', { weekday: 'short' });

          if (Object.prototype.hasOwnProperty.call(days, key) && date >= oneWeekAgo) {
            days[key]++;
          }
        });

        const newChartData = Object.keys(days).map((day) => ({
          day,
          evaluations: days[day],
        }));

        setAllEvaluations(evaluationsData);
        setChartData(newChartData);

        setStats([
          {
            id: 1,
            title: 'Total Officials',
            value: refereesCount.toString(),
            icon: HiOutlineUsers,
            bgClass: 'bg-[#e0f2fe]',
            iconClass: 'text-[#0ea5e9]',
            link: '/admin/referees',
          },
          {
            id: 2,
            title: 'Evaluations This Week',
            value: evaluationsThisWeek.toString(),
            icon: HiOutlineDocumentText,
            bgClass: 'bg-[#dbeafe]',
            iconClass: 'text-[#3b82f6]',
            link: '/admin/evaluations',
          },
          {
            id: 3,
            title: 'Average Rating',
            value: averageScore.toString(),
            suffix: '/40',
            icon: HiStar,
            bgClass: 'bg-[#fef3c7]',
            iconClass: 'text-[#f59e0b]',
            link: '/admin/evaluators',
          },
          {
            id: 4,
            title: 'Top Tier Officials',
            icon: FaTrophy,
            bgClass: 'bg-[#e9d5ff]',
            iconClass: 'text-[#a855f7]',
            list: topReferees,
          },
        ]);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter evaluations based on search term
  const filteredEvaluations = allEvaluations
    .filter((ev) =>
      ev.refereeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.evaluatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.tier.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 10); // Show top 10 recent matching results

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
              {stats.map(({ id, title, value, suffix, icon: Icon, bgClass, iconClass, list, link }) => {
                const CardContent = (
                  <div className={`bg-[#2a2a2a] rounded-[20px] p-6 border-t-4 border-accent h-full ${link ? 'hover:bg-[#333333] transition-colors' : ''}`}>
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
                );

                return link ? (
                  <Link href={link} key={id} className="block h-full">
                    {CardContent}
                  </Link>
                ) : (
                  <div key={id} className="h-full">
                    {CardContent}
                  </div>
                );
              })}
            </div>

            {/* Bottom Section - Table and Chart */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6'>
              {/* Recent Evaluations Table */}
              <div className='lg:col-span-2 bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a]'>
                <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 lg:mb-6 gap-4'>
                  <h2 className='text-fluid-xl font-semibold text-white text-body'>
                    Recent Evaluations
                  </h2>

                  {/* Search Input */}
                  <div className='relative w-full sm:w-64'>
                    <div className='absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                      <HiOutlineSearch className='w-5 h-5 text-[#9ca3af]' />
                    </div>
                    <input
                      type='text'
                      placeholder='Search evaluations...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className='w-full bg-[#1a1a1a] border border-[#3a3a3a] text-white placeholder-[#6b7280] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] transition-all'
                    />
                  </div>
                </div>

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
                          {loading ? (
                            <tr>
                              <td colSpan='5' className='text-center py-12'>
                                <p className='text-[15px] text-[#6b7280] text-body'>
                                  Loading recent evaluations...
                                </p>
                              </td>
                            </tr>
                          ) : filteredEvaluations.length > 0 ? (
                            filteredEvaluations.map((evaluation, index) => (
                              <tr
                                key={evaluation.id || index}
                                onClick={() => router.push(`/admin/evaluations/${evaluation.id}`)}
                                className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer'
                              >
                                <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                  {evaluation.createdAtDate.toLocaleDateString()}
                                </td>
                                <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                  {evaluation.evaluatorName}
                                </td>
                                <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                  {evaluation.refereeName}
                                </td>
                                <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body font-medium whitespace-nowrap'>
                                  {evaluation.totalScore}/40
                                </td>
                                <td className='py-3 lg:py-4 px-2 lg:px-4'>
                                  <span
                                    className={`inline-block px-3 lg:px-4 py-1 lg:py-1.5 rounded-full text-fluid-sm font-semibold whitespace-nowrap`}
                                  >
                                    {evaluation.tier}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan='5' className='text-center py-12'>
                                <p className='text-[15px] text-[#6b7280] text-body'>
                                  {searchTerm ? 'No evaluations found matching search.' : 'No recent evaluations found.'}
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluations per Week Chart */}
              <div className='bg-[#2a2a2a] rounded-[20px] p-4 lg:p-6 border border-[#3a3a3a]'>
                <h2 className='text-fluid-xl font-semibold text-white text-body mb-4 lg:mb-6'>
                  Evaluations this Week
                </h2>

                <div className='h-[250px] lg:h-[300px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#3a3a3a' />
                      <XAxis
                        dataKey='day'
                        stroke='#6b7280'
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke='#6b7280'
                        style={{ fontSize: '12px' }}
                        allowDecimals={false}
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
