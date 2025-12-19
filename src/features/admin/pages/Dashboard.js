'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
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

const AdminDashboardPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState([
    {
      id: 1,
      title: 'Total Officials',
      value: '0',
      icon: HiOutlineUsers,
      bgClass: 'bg-[#e0f2fe]',
      iconClass: 'text-[#0ea5e9]',
    },
    {
      id: 2,
      title: 'Total Evaluations',
      value: '0',
      icon: HiOutlineDocumentText,
      bgClass: 'bg-[#dbeafe]',
      iconClass: 'text-[#3b82f6]',
    },
    {
      id: 3,
      title: 'Average Rating',
      value: '0',
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
      list: [],
    },
  ]);
  const [recentEvaluations, setRecentEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch referees
      const refereesQuery = query(collection(db, 'referees'));
      const refereesSnapshot = await getDocs(refereesQuery);
      const refereesCount = refereesSnapshot.size;
      const topReferees = refereesSnapshot.docs.slice(0, 3).map(doc => doc.data().displayName);

      // Fetch evaluations
      const evaluationsQuery = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'));
      const evaluationsSnapshot = await getDocs(evaluationsQuery);
      const evaluationsCount = evaluationsSnapshot.size;
      const evaluationsData = evaluationsSnapshot.docs.map(doc => doc.data());

      // Calculate average score
      const totalScore = evaluationsData.reduce((acc, cur) => acc + cur.totalScore, 0);
      const averageScore = evaluationsCount > 0 ? (totalScore / evaluationsCount).toFixed(1) : 0;

      // Set stats
      setStats([
        {
          id: 1,
          title: 'Total Officials',
          value: refereesCount.toString(),
          icon: HiOutlineUsers,
          bgClass: 'bg-[#e0f2fe]',
          iconClass: 'text-[#0ea5e9]',
        },
        {
          id: 2,
          title: 'Total Evaluations',
          value: evaluationsCount.toString(),
          icon: HiOutlineDocumentText,
          bgClass: 'bg-[#dbeafe]',
          iconClass: 'text-[#3b82f6]',
        },
        {
          id: 3,
          title: 'Average Rating',
          value: averageScore.toString(),
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
          list: topReferees,
        },
      ]);

      // Fetch recent evaluations with referee and evaluator names
      const recentEvaluationsData = await Promise.all(
        evaluationsSnapshot.docs.slice(0, 5).map(async (doc) => {
          const evaluation = doc.data();
          const refereeDoc = await getDoc(doc(db, 'referees', evaluation.refereeId));
          const evaluatorDoc = await getDoc(doc(db, 'users', evaluation.evaluatorId));
          return {
            ...evaluation,
            id: doc.id,
            refereeName: refereeDoc.data()?.displayName || 'Unknown',
            evaluatorName: evaluatorDoc.data()?.displayName || 'Unknown',
            tier: refereeDoc.data()?.tier || 'N/A',
          };
        })
      );
      setRecentEvaluations(recentEvaluationsData);

      setLoading(false);
    };

    fetchData();
  }, []);

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
              {stats.map(({ id, title, value, suffix, icon: Icon, bgClass, iconClass, list }) => (
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
                          {loading ? (
                            <tr>
                              <td colSpan='5' className='text-center py-12'>
                                <p className='text-[15px] text-[#6b7280] text-body'>
                                  Loading recent evaluations...
                                </p>
                              </td>
                            </tr>
                          ) : recentEvaluations.length > 0 ? (
                            recentEvaluations.map((evaluation, index) => (
                              <tr
                                key={index}
                                className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors'
                              >
                                <td className='py-3 lg:py-4 px-2 lg:px-4 text-fluid-base text-white text-body whitespace-nowrap'>
                                  {new Date(evaluation.createdAt.seconds * 1000).toLocaleDateString()}
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
                                  No recent evaluations found.
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
