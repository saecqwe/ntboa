'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiX, HiPlus, HiChevronUp, HiChevronDown, HiSearch } from 'react-icons/hi';
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
      try {
        const evaluatorsQuery = query(collection(db, 'users'), where('role', '==', 'evaluator'));
        const evaluatorsSnapshot = await getDocs(evaluatorsQuery);
        setEvaluators(evaluatorsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));

        const refereesQuery = query(collection(db, 'users'), where('role', '==', 'referee'));
        const refereesSnapshot = await getDocs(refereesQuery);
        setReferees(refereesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));

        const assignmentsQuery = query(collection(db, 'assignments'));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        setAssignments(assignmentsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
        
        const locationsQuery = query(collection(db, 'locations'));
        const locationsSnapshot = await getDocs(locationsQuery);
        setLocationsList(locationsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Fetch error:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const displayedAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      const matchesLocation = !filterLocation || assignment.location === filterLocation;
      const evaluator = evaluators.find(e => e.id === assignment.evaluatorId);
      const matchesEvaluator = !filterEvaluator || 
        evaluator?.displayName?.toLowerCase().includes(filterEvaluator.toLowerCase());

      const matchesReferee = !filterReferee || assignment.refereeIds?.some(rid => {
        const ref = referees.find(r => r.id === rid);
        return ref?.displayName?.toLowerCase().includes(filterReferee.toLowerCase());
      });

      let matchesDate = true;
      if (filterDate) {
        const assignmentDate = assignment.scheduledDate?.toDate ? assignment.scheduledDate.toDate() : new Date(assignment.scheduledDate);
        const filterDateObj = new Date(filterDate);
        matchesDate = 
          assignmentDate.getFullYear() === filterDateObj.getFullYear() &&
          assignmentDate.getMonth() === filterDateObj.getMonth() &&
          assignmentDate.getDate() === filterDateObj.getDate();
      }

      return matchesLocation && matchesEvaluator && matchesReferee && matchesDate;
    });
  }, [assignments, filterLocation, filterEvaluator, filterReferee, filterDate, evaluators, referees]);

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = new Date(d2);
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

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        const value = `${hour}:${minute}`;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 || 12;
        const label = `${displayHour}:${minute} ${ampm}`;
        options.push({ value, label });
      }
    }
    return options;
  }, []);

  const filteredEvaluators = evaluators.filter((ev) =>
    ev.displayName?.toLowerCase().includes(evaluatorSearch.toLowerCase())
  );

  const filteredReferees = referees.filter((ref) =>
    ref.displayName?.toLowerCase().includes(refereeSearch.toLowerCase())
  );

  const handleEvaluatorSelect = (ev) => setSelectedEvaluator(ev);

  const handleRefereeToggle = (refereeId) => {
    setSelectedReferees((prev) =>
      prev.includes(refereeId) ? prev.filter((id) => id !== refereeId) : [...prev, refereeId]
    );
  };

  const handleAssign = async () => {
    const missingFields = [];
    if (!date) missingFields.push('Date');
    if (!time) missingFields.push('Time');
    if (!location) missingFields.push('Location');
    if (!selectedEvaluator) missingFields.push('Evaluator');
    if (selectedReferees.length === 0) missingFields.push('at least one Referee');

    if (missingFields.length > 0) {
      alert(`Please complete the following required fields:\n\n${missingFields.map(field => `• ${field}`).join('\n')}`);
      return;
    }

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

  const groupedAssignments = useMemo(() => {
    const groups = {};
    displayedAssignments.forEach(assignment => {
      const dateObj = assignment.scheduledDate?.toDate ? assignment.scheduledDate.toDate() : new Date(assignment.scheduledDate);
      const dateKey = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dateKey]) {
        groups[dateKey] = { dateObj, items: [] };
      }
      groups[dateKey].items.push(assignment);
    });
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.dateObj - a.dateObj)
      .map(([key, value]) => ({ date: key, items: value.items }));
  }, [displayedAssignments]);

  return (
    <div className='min-h-screen bg-[#1a1a1a] flex overflow-x-hidden'>
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className='flex-1 lg:ml-64 min-w-0 overflow-x-hidden'>
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 lg:px-8 py-4 lg:py-6 flex items-center gap-4 sticky top-0 z-20'>
          <BackButton variant='solid' className='shrink-0' />
          <button onClick={() => setIsSidebarOpen(true)} className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 shrink-0'>
            <HiMenu className='w-6 h-6' />
          </button>
          <h1 className='text-fluid-2xl md:text-fluid-3xl font-semibold text-white heading min-w-0 truncate flex-1'>Assignments</h1>
          <button 
            onClick={() => setIsCreating(!isCreating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isCreating ? 'bg-white/10 text-white' : 'bg-accent text-white hover:opacity-90'}`}
          >
            {isCreating ? <HiChevronUp className="w-5 h-5" /> : <HiPlus className="w-5 h-5" />}
            <span className="hidden sm:inline">{isCreating ? 'Hide Form' : 'New Assignment'}</span>
          </button>
        </header>

        <div className='p-4 sm:p-6 lg:p-8 min-w-0'>
          <div className='max-w-7xl mx-auto space-y-6 w-full'>
            
            {isCreating && (
              <div className='bg-[#1f1f1f] border border-[#3a3a3a] rounded-[20px] p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-200'>
                <h2 className='text-fluid-xl font-bold text-white'>Create New Assignment</h2>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'><FiCalendar /> Date <span className='text-red-500'>*</span></label>
                    <input type='date' value={date} onChange={(e) => setDate(e.target.value)} className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] scheme-dark focus:ring-2 focus:ring-accent outline-none' />
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'><FiClock /> Time <span className='text-red-500'>*</span></label>
                    <select value={time} onChange={(e) => setTime(e.target.value)} className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] outline-none appearance-none'>
                      <option value="">Select Time</option>
                      {timeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className='space-y-2'>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'><FiMapPin /> Location <span className='text-red-500'>*</span></label>
                    <select value={location} onChange={(e) => setLocation(e.target.value)} className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] outline-none appearance-none'>
                      <option value="">Select Location</option>
                      {locationsList.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                  <div className='rounded-xl border border-[#3a3a3a] flex flex-col h-[300px]'>
                    <div className='bg-[#2a2a2a] p-4 border-b border-[#3a3a3a]'>
                      <h3 className='font-semibold text-white flex items-center gap-2 mb-3'><FiUsers className='text-accent' /> Select Evaluator <span className='text-red-500'>*</span></h3>
                      <input type='text' placeholder='Search evaluators...' value={evaluatorSearch} onChange={(e) => setEvaluatorSearch(e.target.value)} className='w-full bg-[#1f1f1f] text-white text-sm rounded-lg px-3 py-2 outline-none' />
                    </div>
                    <div className='overflow-y-auto flex-1 p-2 bg-[#1f1f1f]'>
                      {filteredEvaluators.map((evUser) => (
                        <div key={evUser.id} onClick={() => handleEvaluatorSelect(evUser)} className={`p-3 rounded-lg cursor-pointer mb-1 flex justify-between items-center ${selectedEvaluator?.id === evUser.id ? 'bg-accent/20 border border-accent/50' : 'hover:bg-[#2a2a2a]'}`}>
                          <div className='text-white text-sm font-medium'>{evUser.displayName}</div>
                          {selectedEvaluator?.id === evUser.id && <div className='w-2 h-2 rounded-full bg-accent' />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='rounded-xl border border-[#3a3a3a] flex flex-col h-[300px]'>
                    <div className='bg-[#2a2a2a] p-4 border-b border-[#3a3a3a]'>
                      <h3 className='font-semibold text-white flex items-center gap-2 mb-3'><FiUser className='text-accent' /> Select Referees <span className='text-red-500'>*</span></h3>
                      <input type='text' placeholder='Search referees...' value={refereeSearch} onChange={(e) => setRefereeSearch(e.target.value)} className='w-full bg-[#1f1f1f] text-white text-sm rounded-lg px-3 py-2 outline-none' />
                    </div>
                    <div className='overflow-y-auto flex-1 p-2 bg-[#1f1f1f]'>
                      {filteredReferees.map((ref) => {
                        const isAssigned = assignedRefereeIdsForSelectedDateAndEvaluator.has(ref.id);
                        return (
                          <div key={ref.id} onClick={() => handleRefereeToggle(ref.id)} className={`p-3 rounded-lg cursor-pointer mb-1 flex justify-between items-center ${selectedReferees.includes(ref.id) ? 'bg-accent text-white' : 'hover:bg-[#2a2a2a] text-white'}`}>
                            <div className='flex-1 min-w-0'>
                              <div className='text-sm font-medium flex items-center gap-2'>{ref.displayName} {isAssigned && <span className='text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded'>Assigned</span>}</div>
                              <div className='text-xs text-[#9ca3af]'>{ref.tier}</div>
                            </div>
                            {selectedReferees.includes(ref.id) && <HiPlus className='w-4 h-4 rotate-45' />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className='flex justify-end pt-4 border-t border-[#3a3a3a]'>
                  <button onClick={handleAssign} className='bg-accent hover:opacity-90 rounded-xl px-8 py-3 font-semibold text-white transition-all shadow-lg'>Confirm Assignment</button>
                </div>
              </div>
            )}

            <div className='bg-[#1f1f1f] rounded-[20px] p-4 sm:p-6 lg:p-8 border border-[#3a3a3a]'>
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6'>
                <h2 className='text-fluid-xl font-semibold text-white'>Scheduled Assignments</h2>
                <div className='flex flex-wrap items-center gap-2'>
                  <div className="relative">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                    <input type='text' placeholder='Filter Evaluator' value={filterEvaluator} onChange={(e) => setFilterEvaluator(e.target.value)} className='bg-[#2a2a2a] text-white text-sm pl-10 pr-4 py-2 rounded-lg border border-[#3a3a3a] outline-none' />
                  </div>
                  <div className="relative">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                    <input type='text' placeholder='Filter Referee' value={filterReferee} onChange={(e) => setFilterReferee(e.target.value)} className='bg-[#2a2a2a] text-white text-sm pl-10 pr-4 py-2 rounded-lg border border-[#3a3a3a] outline-none' />
                  </div>
                  <input type='date' value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className='bg-[#2a2a2a] text-white text-sm px-4 py-2 rounded-lg border border-[#3a3a3a] outline-none scheme-dark' />
                </div>
              </div>

              {loading ? <div className='text-white text-center p-8'>Loading...</div> : (
                <div className='space-y-8'>
                  {groupedAssignments.map(({ date: groupDate, items }) => (
                    <div key={groupDate} className='space-y-4'>
                      <h3 className='text-lg font-bold text-accent uppercase tracking-wide border-b border-accent/30 pb-1'>{groupDate}</h3>
                      <div className='overflow-x-auto rounded-xl border border-[#3a3a3a]'>
                        <table className='w-full'>
                          <thead className='bg-[#2a2a2a]'>
                            <tr className='text-xs font-semibold text-[#9ca3af] uppercase'>
                              <th className='py-3 px-6 text-left'>Time</th>
                              <th className='py-3 px-6 text-left'>Evaluator</th>
                              <th className='py-3 px-6 text-left'>Referees</th>
                              <th className='py-3 px-6 text-left'>Location</th>
                              <th className='py-3 px-6 text-right'>Action</th>
                            </tr>
                          </thead>
                          <tbody className='divide-y divide-[#2a2a2a]'>
                            {items.map((asgn) => (
                              <tr key={asgn.id} className='hover:bg-[#2a2a2a]/50'>
                                <td className='py-4 px-6 text-sm text-white'>{(() => {
                                  const d = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
                                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                })()}</td>
                                <td className='py-4 px-6 text-sm text-white'>{evaluators.find(e => e.id === asgn.evaluatorId)?.displayName}</td>
                                <td className='py-4 px-6 text-sm text-white flex flex-wrap gap-1'>
                                  {asgn.refereeIds?.map(rid => <span key={rid} className='bg-[#2a2a2a] px-2 py-0.5 rounded text-xs'>{referees.find(r => r.id === rid)?.displayName || 'Unknown'}</span>)}
                                </td>
                                <td className='py-4 px-6 text-sm text-white'>{asgn.location}</td>
                                <td className='py-4 px-6 text-right'><button onClick={() => handleRemoveAssignment(asgn.id)} className='text-red-500'><HiX /></button></td>
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