'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AdminSidebar from '@/components/layout/AdminSidebar';
import BackButton from '@/components/ui/BackButton';
import { HiMenu, HiX } from 'react-icons/hi';
import { FiUsers, FiUser } from 'react-icons/fi';

const EVALUATORS = [
  { id: 1, name: 'John Smith', email: 'jsmith@gmail.org', assignedReferees: 2 },
  { id: 2, name: 'Emily Johnson', email: 'ejohnson@ntboa.org', assignedReferees: 2 },
  { id: 3, name: 'Michael Davis', email: 'mdavis@ntboa.org', assignedReferees: 2 },
];

const REFEREES = [
  { id: 1, name: 'Michael Johnson', email: 'mjohnson@ntboa.org', tier: 'Tier 150' },
  { id: 2, name: 'Sarah Williams', email: 'swilliams@ntboa.org', tier: 'Tier 150' },
  { id: 3, name: 'David Brown', email: 'dbrown@ntboa.org', tier: 'Tier 150' },
  { id: 4, name: 'Jennifer Davis', email: 'jdavis@ntboa.org', tier: 'Tier 150' },
  { id: 5, name: 'Robert Miller', email: 'rmiller@ntboa.org', tier: 'Tier 150' },
];

const CURRENT_ASSIGNMENTS = [
  { id: 1, evaluator: 'John Smith', assignedReferees: '2 Referees', totalCompleted: 8 },
  { id: 2, evaluator: 'Emily Johnson', assignedReferees: '2 Referees', totalCompleted: 5 },
];

const AssignmentsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState(null);
  const [selectedReferees, setSelectedReferees] = useState([]);
  const [evaluatorSearch, setEvaluatorSearch] = useState('');
  const [refereeSearch, setRefereeSearch] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [evaluators, setEvaluators] = useState([]);
  const [referees, setReferees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Fetch evaluators
      const evaluatorsQuery = query(collection(db, 'users'), where('role', '==', 'evaluator'));
      const evaluatorsSnapshot = await getDocs(evaluatorsQuery);
      setEvaluators(evaluatorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch referees
      const refereesQuery = query(collection(db, 'users'), where('role', '==', 'referee'));
      const refereesSnapshot = await getDocs(refereesQuery);
      setReferees(refereesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch assignments
      const assignmentsQuery = query(collection(db, 'assignments'));
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      setAssignments(assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredEvaluators = evaluators.filter((evaluator) =>
    evaluator.displayName.toLowerCase().includes(evaluatorSearch.toLowerCase())
  );

  const filteredReferees = referees.filter((referee) =>
    referee.displayName.toLowerCase().includes(refereeSearch.toLowerCase())
  );

  const handleEvaluatorSelect = (evaluator) => {
    setSelectedEvaluator(evaluator);
  };

  const handleRefereeToggle = (refereeId) => {
    setSelectedReferees((prev) =>
      prev.includes(refereeId)
        ? prev.filter((id) => id !== refereeId)
        : [...prev, refereeId]
    );
  };

  const handleAssign = async () => {
    if (!selectedEvaluator || selectedReferees.length === 0) return;
    await addDoc(collection(db, 'assignments'), {
      evaluatorId: selectedEvaluator.id,
      refereeIds: selectedReferees,
      location,
      scheduledDate: new Date(dateTime),
      status: 'pending',
    });
    setSelectedReferees([]);
    setLocation('');
    setDateTime('');
  };

  const handleRemoveAssignment = async (assignmentId) => {
    await deleteDoc(doc(db, 'assignments', assignmentId));
  };

  return (
    <div className='min-h-screen bg-gradient-primary flex overflow-x-hidden'>
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className='flex-1 lg:ml-64 min-w-0 overflow-x-hidden'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 lg:px-8 py-4 lg:py-6 flex items-center gap-4'>
          <BackButton variant='solid' className='shrink-0' />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors shrink-0'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-2xl md:text-fluid-3xl font-semibold text-white heading min-w-0 truncate'>
            Assign Referees to Evaluators
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 sm:p-6 lg:p-8 min-w-0'>
          <div className='max-w-7xl mx-auto space-y-4 lg:space-y-6 w-full'>
            {/* Top Banner */}
            <div className='bg-accent rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 lg:p-8'>
              <h2 className='md:text-fluid-2xl font-bold text-white mb-2'>
                Assign Referees to Evaluators
              </h2>
              <p className='text-fluid-base text-white/90'>
                Select an evaluator and assign referees they can evaluate
              </p>
            </div>

            {/* Selection Grid */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 w-full'>
              {/* Select Evaluator */}
              <div className='rounded-[16px] sm:rounded-[20px] overflow-hidden border border-[#3a3a3a] flex flex-col min-w-0 w-full'>
                {/* Header with Orange Gradient */}
                <div className='bg-accent p-4 sm:p-6'>
                  <div className='flex items-center gap-2 mb-3 sm:mb-4'>
                    <FiUsers className='w-4 h-4 sm:w-5 sm:h-5 text-white' />
                    <h3 className='text-fluid-xl font-semibold text-white'>
                      Select Evaluator
                    </h3>
                  </div>

                  {/* Search Input */}
                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search'
                      value={evaluatorSearch}
                      onChange={(e) => setEvaluatorSearch(e.target.value)}
                      className='w-full bg-white/30 text-white placeholder-white/70 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-fluid-base focus:outline-none focus:ring-2 focus:ring-white/50 border-0 transition-all'
                    />
                  </div>
                </div>

                {/* Evaluators List */}
                <div className='bg-[#1f1f1f] p-0 h-[200px] sm:h-[240px] lg:h-[280px] overflow-y-auto flex-1'>
                  {loading ? <p className='text-white p-4'>Loading...</p> : filteredEvaluators.map((evaluator) => (
                    <div
                      key={evaluator.id}
                      onClick={() => handleEvaluatorSelect(evaluator)}
                      className={`p-3 sm:p-4 cursor-pointer transition-all relative ${
                        selectedEvaluator?.id === evaluator.id
                          ? 'bg-[#2a2a2a] border-l-2 sm:border-l-4 border-white'
                          : 'bg-[#1f1f1f] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      <div className='flex items-start justify-between gap-2 sm:gap-4'>
                        <div className='flex-1 min-w-0'>
                          <div className='text-fluid-base font-medium text-white mb-1 truncate'>
                            {evaluator.displayName}
                          </div>
                          <div className='text-fluid-sm text-[#9ca3af] truncate'>
                            {evaluator.email}
                          </div>
                        </div>
                        <div className='text-right shrink-0'>
                          <div className='text-fluid-sm text-[#9ca3af] mb-1 whitespace-nowrap'>
                            Assigned Referees
                          </div>
                          <div className='text-fluid-lg font-bold text-white'>
                            {evaluator.assignedReferees}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Select Referee */}
              <div className='rounded-[16px] sm:rounded-[20px] overflow-hidden border border-[#3a3a3a] flex flex-col min-w-0 w-full'>
                {/* Header with Orange Gradient */}
                <div className='bg-accent p-4 sm:p-6'>
                  <div className='flex items-center gap-2 mb-3 sm:mb-4'>
                    <FiUser className='w-4 h-4 sm:w-5 sm:h-5 text-white' />
                    <h3 className='text-fluid-xl font-semibold text-white'>
                      Select Referee
                    </h3>
                  </div>

                  {/* Search Input */}
                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search'
                      value={refereeSearch}
                      onChange={(e) => setRefereeSearch(e.target.value)}
                      className='w-full bg-white/30 text-white placeholder-white/70 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-fluid-base focus:outline-none focus:ring-2 focus:ring-white/50 border-0 transition-all'
                    />
                  </div>
                </div>

                {/* Referees List */}
                <div className='bg-[#1f1f1f] p-0 h-[200px] sm:h-[240px] lg:h-[280px] overflow-y-auto flex-1'>
                  {loading ? <p className='text-white p-4'>Loading...</p> : filteredReferees.map((referee) => (
                    <div
                      key={referee.id}
                      onClick={() => handleRefereeToggle(referee.id)}
                      className='p-3 sm:p-4 cursor-pointer transition-all bg-[#1f1f1f] hover:bg-[#2a2a2a]'
                    >
                      <div className='flex items-center gap-2 sm:gap-3 md:gap-4'>
                        {/* Checkbox */}
                        <div className='shrink-0'>
                          <div
                            className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center transition-all ${
                              selectedReferees.includes(referee.id)
                                ? 'bg-[#f97316] border-[#f97316]'
                                : 'bg-transparent border-[#6b7280]'
                            }`}
                          >
                            {selectedReferees.includes(referee.id) && (
                              <svg
                                className='w-2.5 h-2.5 sm:w-3 sm:h-3 text-white'
                                fill='none'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                              >
                                <path d='M5 13l4 4L19 7'></path>
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className='flex-1 min-w-0'>
                          <div className='text-fluid-base font-medium text-white mb-1 truncate'>
                            {referee.displayName}
                          </div>
                          <div className='text-fluid-sm text-[#9ca3af] truncate'>
                            {referee.email}
                          </div>
                        </div>

                        {/* Tier Badge */}
                        <div className='shrink-0'>
                          <span className='inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-fluid-sm font-medium bg-[#6b7280] text-white whitespace-nowrap'>
                            {referee.tier}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Inputs */}
            <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 w-full'>
              <input
                type='text'
                placeholder='Enter Location'
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className='flex-1 min-w-0 bg-[#4a4a4a] text-white placeholder-[#9ca3af] rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-fluid-base focus:outline-none focus:ring-2 focus:ring-[#f97316] border-0 transition-all w-full'
              />
              <div className='relative flex-1 min-w-0 w-full'>
                <input
                  type='datetime-local'
                  placeholder='Select Date / Time'
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className='w-full bg-[#4a4a4a] text-white placeholder-[#9ca3af] rounded-lg sm:rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-fluid-base focus:outline-none focus:ring-2 focus:ring-[#f97316] border-0 transition-all scheme-dark'
                />
              </div>
              <button
                onClick={handleAssign}
                disabled={!selectedEvaluator || selectedReferees.length === 0}
                className='bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded-xl px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 text-fluid-base font-semibold text-white transition-all active:scale-[0.98] shadow-lg w-full sm:w-auto shrink-0'
              >
                <span className='hidden md:inline'>
                  Assign {selectedReferees.length} Referees to Evaluator
                </span>
                <span className='hidden sm:inline md:hidden'>
                  Assign {selectedReferees.length} Referee
                  {selectedReferees.length !== 1 ? 's' : ''}
                </span>
                <span className='sm:hidden'>
                  Assign ({selectedReferees.length})
                </span>
              </button>
            </div>

            {/* Current Assignments Table */}
            <div className='bg-[#1f1f1f] rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 lg:p-8 w-full min-w-0'>
              <h2 className='text-fluid-xl font-semibold text-white mb-4 sm:mb-6'>
                Current Assignments
              </h2>

              <div className='overflow-x-auto -mx-4 sm:-mx-6 lg:mx-0 w-full'>
                <div className='inline-block min-w-full align-middle'>
                  <div className='overflow-hidden'>
                    <table className='w-full'>
                      <thead className='bg-[#3a3a3a]'>
                        <tr>
                          <th className='text-left py-3 sm:py-4 px-3 sm:px-4 lg:px-6 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                            EVALUATOR
                          </th>
                          <th className='text-left py-3 sm:py-4 px-3 sm:px-4 lg:px-6 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                            ASSIGNED REFEREES
                          </th>
                          <th className='text-left py-3 sm:py-4 px-3 sm:px-4 lg:px-6 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                            TOTAL COMPLETED
                          </th>
                          <th className='text-left py-3 sm:py-4 px-3 sm:px-4 lg:px-6 text-fluid-sm font-semibold text-[#9ca3af] uppercase tracking-wider whitespace-nowrap'>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody className='bg-[#1f1f1f]'>
                        {loading ? <tr><td colSpan='4' className='text-white text-center p-4'>Loading...</td></tr> : assignments.map((assignment) => (
                          <tr
                            key={assignment.id}
                            className='border-b border-[#2a2a2a] last:border-0'
                          >
                            <td className='py-3 sm:py-4 lg:py-5 px-3 sm:px-4 lg:px-6 text-fluid-base text-white whitespace-nowrap'>
                              {evaluators.find(e => e.id === assignment.evaluatorId)?.displayName}
                            </td>
                            <td className='py-3 sm:py-4 lg:py-5 px-3 sm:px-4 lg:px-6 text-fluid-base text-white whitespace-nowrap'>
                              {assignment.refereeIds.length} Referees
                            </td>
                            <td className='py-3 sm:py-4 lg:py-5 px-3 sm:px-4 lg:px-6 text-fluid-base text-white whitespace-nowrap'>
                              {assignment.totalCompleted || 0}
                            </td>
                            <td className='py-3 sm:py-4 lg:py-5 px-3 sm:px-4 lg:px-6'>
                              <button
                                onClick={() =>
                                  handleRemoveAssignment(assignment.id)
                                }
                                className='text-[#ef4444] hover:text-[#dc2626] transition-colors'
                              >
                                <HiX className='w-4 h-4 sm:w-5 sm:h-5' />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentsPage;
