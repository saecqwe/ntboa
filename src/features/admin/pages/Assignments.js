'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiX, HiPlus, HiFilter, HiChevronUp, HiChevronDown } from 'react-icons/hi';
import { FiUsers, FiUser, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';

const AssignmentsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Assignment Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState(null);
  const [selectedReferees, setSelectedReferees] = useState([]);
  const [evaluatorSearch, setEvaluatorSearch] = useState('');
  const [refereeSearch, setRefereeSearch] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Data State
  const [evaluators, setEvaluators] = useState([]);
  const [referees, setReferees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterDate, setFilterDate] = useState('');
  const [filterReferee, setFilterReferee] = useState('');
  const [filterEvaluator, setFilterEvaluator] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

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
      
      // Fetch locations
      const locationsQuery = query(collection(db, 'locations'));
      const locationsSnapshot = await getDocs(locationsQuery);
      setLocationsList(locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name)));

      setLoading(false);
    };

    fetchData();
  }, []);

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = d2.toDate ? d2.toDate() : new Date(d2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const assignedRefereeIdsForSelectedDateAndEvaluator = useMemo(() => {
    if (!selectedEvaluator || !date) return new Set();
    const ids = new Set();
    assignments
      .filter(a => a.evaluatorId === selectedEvaluator.id && isSameDay(a.scheduledDate, date))
      .forEach(a => {
        if (Array.isArray(a.refereeIds)) {
          a.refereeIds.forEach(id => ids.add(id));
        }
      });
    return ids;
  }, [selectedEvaluator, assignments, date]);

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

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(dateObj.getTime())) return '-';
    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getRefereeNames = (ids) => {
    if (!ids || !Array.isArray(ids)) return '-';
    return ids.map(id => referees.find(r => r.id === id)?.displayName || 'Unknown').join(', ');
  };

  const handleAssign = async () => {
    if (!selectedEvaluator || selectedReferees.length === 0 || !date || !time) return;
    
    try {
      const scheduledDate = new Date(`${date}T${time}`);
      
      const newAssignment = {
        evaluatorId: selectedEvaluator.id,
        refereeIds: selectedReferees,
        location,
        scheduledDate,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'assignments'), newAssignment);

      setAssignments(prev => [...prev, { id: docRef.id, ...newAssignment }]);
      
      setSelectedReferees([]);
      setLocation('');
      // Keep date/time to make next assignment easier? Or clear? 
      // User said "first thing is date", so keeping date might be helpful, but let's clear for safety to avoid accidental double books if logic fails.
      // Actually, UX-wise, if I'm assigning for a day, I might want to keep the date.
      // Let's clear time but keep date? Or clear both. Let's clear both for now.
      setTime('');
      alert('Assignment created successfully!');
    } catch (error) {
      console.error("Error creating assignment:", error);
      alert("Failed to create assignment.");
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await deleteDoc(doc(db, 'assignments', assignmentId));
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (error) {
      console.error("Error removing assignment:", error);
    }
  };

  // Group assignments by date for display
  const groupedAssignments = useMemo(() => {
    const groups = {};
    displayedAssignments.forEach(assignment => {
      const dateObj = assignment.scheduledDate?.toDate ? assignment.scheduledDate.toDate() : new Date(assignment.scheduledDate);
      const dateKey = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
            dateObj,
            items: []
        };
      }
      groups[dateKey].items.push(assignment);
    });

    // Sort groups by date
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.dateObj - a.dateObj) // Newest dates first
      .map(([key, value]) => ({ date: key, items: value.items }));
  }, [displayedAssignments]);

  return (
    <div className='min-h-screen bg-gradient-primary flex overflow-x-hidden'>
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className='flex-1 lg:ml-64 min-w-0 overflow-x-hidden'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 lg:px-8 py-4 lg:py-6 flex items-center gap-4 sticky top-0 z-20'>
          <BackButton variant='solid' className='shrink-0' />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors shrink-0'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-2xl md:text-fluid-3xl font-semibold text-white heading min-w-0 truncate flex-1'>
            Assignments
          </h1>

          <button 
            onClick={() => setIsCreating(!isCreating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isCreating ? 'bg-white/10 text-white' : 'bg-accent text-white hover:opacity-90'}`}
          >
            {isCreating ? <HiChevronUp className="w-5 h-5" /> : <HiPlus className="w-5 h-5" />}
            <span className="hidden sm:inline">{isCreating ? 'Hide Form' : 'New Assignment'}</span>
          </button>
        </header>

        {/* Content */}
        <div className='p-4 sm:p-6 lg:p-8 min-w-0'>
          <div className='max-w-7xl mx-auto space-y-6 w-full'>
            
            {/* Create Assignment Section (Collapsible) */}
            {isCreating && (
              <div className='bg-[#1f1f1f] border border-[#3a3a3a] rounded-[20px] p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-200'>
                <div className='flex items-center justify-between'>
                  <h2 className='text-fluid-xl font-bold text-white'>Create New Assignment</h2>
                </div>

                {/* Step 1: Date & Time & Location */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                      <FiCalendar /> Date
                    </label>
                    <input
                      type='date'
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f97316] outline-none border border-[#3a3a3a] scheme-dark'
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                      <FiClock /> Time
                    </label>
                    <input
                      type='time'
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f97316] outline-none border border-[#3a3a3a] scheme-dark'
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                      <FiMapPin /> Location
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#f97316] outline-none border border-[#3a3a3a] appearance-none'
                    >
                      <option value="">Select Location</option>
                      {locationsList.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 2: Selection Grid */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                  {/* Select Evaluator */}
                  <div className='rounded-xl overflow-hidden border border-[#3a3a3a] flex flex-col h-[300px]'>
                    <div className='bg-[#2a2a2a] p-4 border-b border-[#3a3a3a]'>
                      <div className='flex items-center justify-between mb-3'>
                        <h3 className='font-semibold text-white flex items-center gap-2'>
                          <FiUsers className='text-[#f97316]' /> Select Evaluator
                        </h3>
                        <span className='text-xs text-[#9ca3af]'>
                           {selectedEvaluator ? '1 Selected' : 'None Selected'}
                        </span>
                      </div>
                      <input
                        type='text'
                        placeholder='Search evaluators...'
                        value={evaluatorSearch}
                        onChange={(e) => setEvaluatorSearch(e.target.value)}
                        className='w-full bg-[#1f1f1f] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#f97316]'
                      />
                    </div>
                    <div className='overflow-y-auto flex-1 p-2 bg-[#1f1f1f]'>
                      {filteredEvaluators.map((evaluator) => (
                        <div
                          key={evaluator.id}
                          onClick={() => handleEvaluatorSelect(evaluator)}
                          className={`p-3 rounded-lg cursor-pointer mb-1 flex justify-between items-center transition-all ${
                            selectedEvaluator?.id === evaluator.id
                              ? 'bg-[#f97316]/20 border border-[#f97316]/50'
                              : 'hover:bg-[#2a2a2a] border border-transparent'
                          }`}
                        >
                          <div>
                            <div className='text-white font-medium'>{evaluator.displayName}</div>
                            <div className='text-xs text-[#9ca3af]'>{evaluator.email}</div>
                          </div>
                          {selectedEvaluator?.id === evaluator.id && (
                            <div className='w-2 h-2 rounded-full bg-[#f97316]' />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Select Referee */}
                  <div className='rounded-xl overflow-hidden border border-[#3a3a3a] flex flex-col h-[300px]'>
                    <div className='bg-[#2a2a2a] p-4 border-b border-[#3a3a3a]'>
                      <div className='flex items-center justify-between mb-3'>
                        <h3 className='font-semibold text-white flex items-center gap-2'>
                          <FiUser className='text-[#f97316]' /> Select Referees
                        </h3>
                         <span className='text-xs text-[#9ca3af]'>
                           {selectedReferees.length} Selected
                        </span>
                      </div>
                      <input
                        type='text'
                        placeholder='Search referees...'
                        value={refereeSearch}
                        onChange={(e) => setRefereeSearch(e.target.value)}
                        className='w-full bg-[#1f1f1f] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#f97316]'
                      />
                    </div>
                    <div className='overflow-y-auto flex-1 p-2 bg-[#1f1f1f]'>
                      {filteredReferees.map((referee) => {
                        const isAlreadyAssigned = assignedRefereeIdsForSelectedDateAndEvaluator.has(referee.id);
                        return (
                          <div
                            key={referee.id}
                            onClick={() => handleRefereeToggle(referee.id)}
                            className={`p-3 rounded-lg cursor-pointer mb-1 flex justify-between items-center transition-all ${
                              selectedReferees.includes(referee.id)
                                ? 'bg-[#f97316] text-white'
                                : 'hover:bg-[#2a2a2a] text-white'
                            }`}
                          >
                            <div className='flex-1 min-w-0'>
                              <div className='font-medium flex items-center gap-2'>
                                {referee.displayName}
                                {isAlreadyAssigned && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${selectedReferees.includes(referee.id) ? 'bg-white/20 border-white/40' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'}`}>
                                    Assigned (This Date)
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs truncate ${selectedReferees.includes(referee.id) ? 'text-white/80' : 'text-[#9ca3af]'}`}>
                                {referee.tier} • {referee.email}
                              </div>
                            </div>
                            {selectedReferees.includes(referee.id) && (
                              <HiPlus className='w-4 h-4 rotate-45' />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className='flex justify-end pt-4 border-t border-[#3a3a3a]'>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedEvaluator || selectedReferees.length === 0 || !date || !time}
                    className='bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-8 py-3 font-semibold text-white transition-all shadow-lg flex items-center gap-2'
                  >
                    Confirm Assignment
                  </button>
                </div>
              </div>
            )}

            {/* Assignments List */}
            <div className='bg-[#1f1f1f] rounded-[20px] p-4 sm:p-6 lg:p-8 min-w-0 border border-[#3a3a3a]'>
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6'>
                <h2 className='text-fluid-xl font-semibold text-white shrink-0'>
                  Scheduled Assignments
                </h2>
                
                {/* Filters */}
                <div className='flex flex-wrap items-center gap-2'>
                    {/* Location Filter */}
                    <div className='flex items-center gap-2 bg-[#2a2a2a] p-1 rounded-lg border border-[#3a3a3a] flex-1 min-w-[200px]'>
                        <span className='pl-3 text-sm text-[#9ca3af] flex items-center gap-2'>
                            <FiMapPin />
                        </span>
                        <select 
                            value={filterLocation} 
                            onChange={(e) => setFilterLocation(e.target.value)}
                            className="bg-transparent text-white text-sm px-2 py-1.5 outline-none w-full appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-[#2a2a2a]">All Locations</option>
                            {locationsList.map(loc => (
                                <option key={loc.id} value={loc.name} className="bg-[#2a2a2a]">{loc.name}</option>
                            ))}
                        </select>
                         {filterLocation && (
                            <button onClick={() => setFilterLocation('')} className="p-1 hover:bg-white/10 rounded text-[#9ca3af] hover:text-white">
                                <HiX />
                            </button>
                        )}
                    </div>

                    {/* Evaluator Filter */}
                    <div className='flex items-center gap-2 bg-[#2a2a2a] p-1 rounded-lg border border-[#3a3a3a] flex-1 min-w-[150px]'>
                        <span className='pl-3 text-sm text-[#9ca3af] flex items-center gap-2'>
                            <FiUsers />
                        </span>
                        <input 
                            type="text" 
                            placeholder="Filter Evaluator"
                            value={filterEvaluator} 
                            onChange={(e) => setFilterEvaluator(e.target.value)}
                            className="bg-transparent text-white text-sm px-2 py-1.5 outline-none w-full"
                        />
                         {filterEvaluator && (
                            <button onClick={() => setFilterEvaluator('')} className="p-1 hover:bg-white/10 rounded text-[#9ca3af] hover:text-white">
                                <HiX />
                            </button>
                        )}
                    </div>

                     {/* Referee Filter */}
                    <div className='flex items-center gap-2 bg-[#2a2a2a] p-1 rounded-lg border border-[#3a3a3a] flex-1 min-w-[150px]'>
                        <span className='pl-3 text-sm text-[#9ca3af] flex items-center gap-2'>
                            <FiUser />
                        </span>
                        <input 
                            type="text" 
                            placeholder="Filter Referee"
                            value={filterReferee} 
                            onChange={(e) => setFilterReferee(e.target.value)}
                            className="bg-transparent text-white text-sm px-2 py-1.5 outline-none w-full"
                        />
                         {filterReferee && (
                            <button onClick={() => setFilterReferee('')} className="p-1 hover:bg-white/10 rounded text-[#9ca3af] hover:text-white">
                                <HiX />
                            </button>
                        )}
                    </div>

                    {/* Date Filter */}
                    <div className='flex items-center gap-2 bg-[#2a2a2a] p-1 rounded-lg border border-[#3a3a3a] shrink-0'>
                        <span className='pl-3 text-sm text-[#9ca3af] flex items-center gap-2'>
                            <FiCalendar />
                        </span>
                        <input 
                            type="date" 
                            value={filterDate} 
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-transparent text-white text-sm px-2 py-1.5 outline-none scheme-dark"
                        />
                        {filterDate && (
                            <button onClick={() => setFilterDate('')} className="p-1 hover:bg-white/10 rounded text-[#9ca3af] hover:text-white">
                            <HiX />
                            </button>
                        )}
                    </div>
                </div>
              </div>

              {loading ? (
                <div className='text-white text-center p-8'>Loading assignments...</div>
              ) : groupedAssignments.length === 0 ? (
                <div className='text-[#9ca3af] text-center p-8'>No assignments found matching your filters.</div>
              ) : (
                <div className='space-y-8'>
                  {groupedAssignments.map(({ date, items }) => (
                    <div key={date} className='space-y-4'>
                      <div className='flex items-center gap-4'>
                        <h3 className='text-lg font-bold text-[#f97316] uppercase tracking-wide border-b border-[#f97316]/30 pb-1'>
                          {date}
                        </h3>
                        <span className='text-sm text-[#9ca3af] bg-[#2a2a2a] px-2 py-0.5 rounded-full'>{items.length} Games</span>
                      </div>
                      
                      <div className='overflow-x-auto -mx-4 sm:-mx-6 lg:mx-0 rounded-xl border border-[#3a3a3a]'>
                        <table className='w-full'>
                          <thead className='bg-[#2a2a2a]'>
                            <tr>
                              <th className='text-left py-3 px-6 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider w-[150px]'>Time</th>
                              <th className='text-left py-3 px-6 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider'>Evaluator</th>
                              <th className='text-left py-3 px-6 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider'>Referees</th>
                              <th className='text-left py-3 px-6 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider'>Location</th>
                              <th className='text-right py-3 px-6 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider w-[80px]'>Action</th>
                            </tr>
                          </thead>
                          <tbody className='divide-y divide-[#2a2a2a] bg-[#1a1a1a]'>
                            {items.map((assignment) => (
                              <tr key={assignment.id} className='hover:bg-[#2a2a2a]/50 transition-colors'>
                                <td className='py-4 px-6 text-sm text-white whitespace-nowrap font-medium'>
                                  {formatDate(assignment.scheduledDate).split(', ').pop()} {/* Show only Time/Year part? Actually format is Month Day, Year, Time. Let's just extract time if possible or use full string. logic: formatDate returns full string. */}
                                  {(() => {
                                      const d = assignment.scheduledDate?.toDate ? assignment.scheduledDate.toDate() : new Date(assignment.scheduledDate);
                                      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                  })()}
                                </td>
                                <td className='py-4 px-6 text-sm text-white'>
                                  <div className='flex items-center gap-2'>
                                     <div className='w-6 h-6 rounded-full bg-[#333] flex items-center justify-center text-xs text-[#f97316] font-bold'>
                                        {evaluators.find(e => e.id === assignment.evaluatorId)?.displayName?.charAt(0) || '?'}
                                     </div>
                                     {evaluators.find(e => e.id === assignment.evaluatorId)?.displayName}
                                  </div>
                                </td>
                                <td className='py-4 px-6 text-sm text-white'>
                                  <div className='flex flex-wrap gap-1'>
                                    {assignment.refereeIds && assignment.refereeIds.map(rid => {
                                        const rName = referees.find(r => r.id === rid)?.displayName || 'Unknown';
                                        return (
                                            <span key={rid} className='bg-[#2a2a2a] text-white/90 px-2 py-0.5 rounded text-xs border border-[#3a3a3a]'>
                                                {rName}
                                            </span>
                                        )
                                    })}
                                  </div>
                                </td>
                                <td className='py-4 px-6 text-sm text-white'>
                                  {assignment.location || '-'}
                                </td>
                                <td className='py-4 px-6 text-right'>
                                  <button
                                    onClick={() => handleRemoveAssignment(assignment.id)}
                                    className='text-[#ef4444] hover:bg-[#ef4444]/10 p-2 rounded-lg transition-colors'
                                    title="Delete Assignment"
                                  >
                                    <HiX className='w-4 h-4' />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentsPage;
