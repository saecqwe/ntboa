'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiX, HiPlus, HiChevronUp, HiChevronDown, HiSearch } from 'react-icons/hi';
import { FiUsers, FiUser, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';
import EvaluationListSkeleton from '@/ui/skeletons/EvaluationListSkeleton';

// In-memory module cache across client tab navigations
let globalAssignmentsCache = {
  evaluators: [],
  referees: [],
  assignments: [],
  locationsList: [],
  loaded: false,
  timestamp: 0,
};

// Helpers for default date and time
const getCurrentLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextHourTime = () => {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  const h = String(nextHour.getHours()).padStart(2, '0');
  const m = String(nextHour.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const AssignmentsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Assignment Creation State - default date to today and time to next hour
  const [isCreating, setIsCreating] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState(null);
  const [selectedReferees, setSelectedReferees] = useState([]);
  const [evaluatorSearch, setEvaluatorSearch] = useState('');
  const [refereeSearch, setRefereeSearch] = useState('');
  const [refereeTabFilter, setRefereeTabFilter] = useState('all'); // 'all' | 'selected'
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => getCurrentLocalDate());
  const [time, setTime] = useState(() => getNextHourTime());
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const timeDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target)) {
        setIsTimeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, "0");
        const minute = m.toString().padStart(2, "0");
        const value = hour + ":" + minute;
        const ampm = h >= 12 ? "PM" : "AM";
        const displayHour = h % 12 || 12;
        const label = displayHour + ":" + minute + " " + ampm;
        options.push({ value, label });
      }
    }
    return options;
  }, []);

  // Data State - initialized immediately from cache if available
  const [evaluators, setEvaluators] = useState(() => globalAssignmentsCache.evaluators);
  const [referees, setReferees] = useState(() => globalAssignmentsCache.referees);
  const [assignments, setAssignments] = useState(() => globalAssignmentsCache.assignments);
  const [locationsList, setLocationsList] = useState(() => globalAssignmentsCache.locationsList);
  const [loading, setLoading] = useState(() => !globalAssignmentsCache.loaded);

  // Filter State
  const [filterDate, setFilterDate] = useState('');
  const [filterReferee, setFilterReferee] = useState('');
  const [filterEvaluator, setFilterEvaluator] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  // In-memory module cache to instantly render when switching tabs
  const dataCacheRef = useRef(globalAssignmentsCache);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      // If we already have cached data, populate immediately and don't block the screen with full loader
      if (globalAssignmentsCache.loaded) {
        setEvaluators(globalAssignmentsCache.evaluators);
        setReferees(globalAssignmentsCache.referees);
        setAssignments(globalAssignmentsCache.assignments);
        setLocationsList(globalAssignmentsCache.locationsList);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        // Parallelize all 4 Firestore collection queries with Promise.all
        const [
          evaluatorsSnapshot,
          refereesSnapshot,
          assignmentsSnapshot,
          locationsSnapshot
        ] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'evaluator'))),
          getDocs(query(collection(db, 'users'), where('role', '==', 'referee'))),
          getDocs(query(collection(db, 'assignments'))),
          getDocs(query(collection(db, 'locations')))
        ]);

        if (!isMounted) return;

        const newEvaluators = evaluatorsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const newReferees = refereesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const newAssignments = assignmentsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const newLocations = locationsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Update in-memory global cache
        globalAssignmentsCache = {
          evaluators: newEvaluators,
          referees: newReferees,
          assignments: newAssignments,
          locationsList: newLocations,
          loaded: true,
          timestamp: Date.now(),
        };

        setEvaluators(newEvaluators);
        setReferees(newReferees);
        setAssignments(newAssignments);
        setLocationsList(newLocations);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
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

  const isUserDisabled = (user) => {
    if (!user) return true;
    if (user.status) {
      const s = String(user.status).toLowerCase().trim();
      if (['disabled', 'suspended', 'deleted', 'inactive'].includes(s)) {
        return true;
      }
    }
    if (user.isSuspended === true || user.suspended === true) return true;
    if (user.isDeleted === true || user.deleted === true) return true;
    if (user.isDisabled === true || user.disabled === true) return true;
    if (user.isActive === false || user.active === false) return true;
    return false;
  };

  const activeEvaluators = useMemo(() => {
    return evaluators.filter((ev) => !isUserDisabled(ev));
  }, [evaluators]);

  const activeReferees = useMemo(() => {
    return referees.filter((ref) => !isUserDisabled(ref));
  }, [referees]);

  const filteredEvaluators = useMemo(() => {
    return activeEvaluators.filter((ev) =>
      ev.displayName?.toLowerCase().includes(evaluatorSearch.toLowerCase())
    );
  }, [activeEvaluators, evaluatorSearch]);

  const filteredReferees = useMemo(() => {
    let base = activeReferees.filter((ref) =>
      ref.displayName?.toLowerCase().includes(refereeSearch.toLowerCase())
    );
    if (refereeTabFilter === 'selected') {
      base = base.filter((ref) => selectedReferees.includes(ref.id));
    }
    return base;
  }, [activeReferees, refereeSearch, refereeTabFilter, selectedReferees]);

  // Ensure selected evaluator and referees do not retain any suspended or deleted accounts
  useEffect(() => {
    setSelectedEvaluator((prev) => (prev && isUserDisabled(prev) ? null : prev));
    setSelectedReferees((prev) =>
      prev.filter((rid) => {
        const ref = referees.find((r) => r.id === rid);
        return !isUserDisabled(ref);
      })
    );
  }, [evaluators, referees]);

  const handleEvaluatorSelect = (ev) => {
    if (isUserDisabled(ev)) return;
    setSelectedEvaluator(ev);
  };

  const handleRefereeToggle = (refereeId) => {
    const ref = referees.find((r) => r.id === refereeId);
    if (isUserDisabled(ref)) return;
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

    if (selectedEvaluator && isUserDisabled(selectedEvaluator)) {
      alert('The selected evaluator account is suspended or deleted.');
      return;
    }

    const hasDisabledRef = selectedReferees.some((rid) => {
      const ref = referees.find((r) => r.id === rid);
      return isUserDisabled(ref);
    });
    if (hasDisabledRef) {
      alert('One or more selected referees are suspended or deleted.');
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
      const createdItem = { id: docRef.id, ...newAssignment };
      setAssignments(prev => {
        const next = [...prev, createdItem];
        globalAssignmentsCache.assignments = next;
        return next;
      });
      setSelectedReferees([]);
      // Retaining last assigned location and time for multi-assignment convenience
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
      setAssignments(prev => {
        const next = prev.filter(a => a.id !== assignmentId);
        globalAssignmentsCache.assignments = next;
        return next;
      });
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
            onClick={() => {
              if (!isCreating) {
                if (!date) setDate(getCurrentLocalDate());
                if (!time) setTime(getNextHourTime());
              }
              setIsCreating(!isCreating);
            }}
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
                  <div className='space-y-2 relative' ref={timeDropdownRef}>
                    <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                      <FiClock /> Time <span className='text-red-500'>*</span>
                    </label>
                    <div className='relative flex items-center'>
                      <input
                        type='time'
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] scheme-dark focus:ring-2 focus:ring-accent outline-none pr-10'
                      />
                      <button
                        type='button'
                        title='Choose from time list'
                        onClick={() => setIsTimeDropdownOpen((prev) => !prev)}
                        className='absolute right-2.5 p-1 text-[#9ca3af] hover:text-white rounded-md hover:bg-white/10 transition-colors'
                      >
                        <HiChevronDown className={`w-5 h-5 transition-transform duration-150 ${isTimeDropdownOpen ? "rotate-180 text-accent" : ""}`} />
                      </button>
                    </div>

                    {isTimeDropdownOpen && (
                      <div className='absolute left-0 right-0 top-full mt-1 z-50 bg-[#262626] border border-[#3a3a3a] rounded-xl shadow-2xl overflow-hidden'>
                        <div className='p-2.5 bg-[#202020] border-b border-[#3a3a3a] flex items-center justify-between text-xs text-[#9ca3af]'>
                          <span className='font-medium text-white'>Select Time Slot</span>
                          <span className='text-accent'>15 min intervals</span>
                        </div>
                        <div className='max-h-48 overflow-y-auto p-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5 hide-scrollbar'>
                          {timeOptions.map((opt) => {
                            const isSelected = time === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type='button'
                                onClick={() => {
                                  setTime(opt.value);
                                  setIsTimeDropdownOpen(false);
                                }}
                                className={`text-xs py-2 px-2 rounded-lg text-center font-medium transition-all ${
                                  isSelected
                                    ? "bg-accent text-white font-semibold shadow-sm"
                                    : "bg-[#2f2f2f] text-gray-200 hover:bg-[#3a3a3a] hover:text-white"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                  {/* ── Evaluator Selector ── */}
                  <div className='rounded-xl border border-[#3a3a3a] flex flex-col' style={{height: '380px'}}>
                    <div className='bg-[#2a2a2a] p-3 border-b border-[#3a3a3a] shrink-0'>
                      <div className='flex items-center justify-between mb-2.5'>
                        <h3 className='font-semibold text-white flex items-center gap-2 text-sm'>
                          <FiUsers className='text-accent' /> Select Evaluator <span className='text-red-500'>*</span>
                        </h3>
                        <span className='text-[10px] text-[#9ca3af] bg-[#1f1f1f] px-2 py-0.5 rounded-full'>{filteredEvaluators.length} available</span>
                      </div>
                      <div className='relative'>
                        <HiSearch className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] w-3.5 h-3.5' />
                        <input
                          type='text'
                          placeholder='Search evaluators...'
                          value={evaluatorSearch}
                          onChange={(e) => setEvaluatorSearch(e.target.value)}
                          className='w-full bg-[#1f1f1f] text-white text-sm rounded-lg pl-8 pr-8 py-2 outline-none border border-transparent focus:border-accent/40'
                        />
                        {evaluatorSearch && (
                          <button onClick={() => setEvaluatorSearch('')} className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white'>
                            <HiX className='w-3.5 h-3.5' />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className='overflow-y-auto flex-1 p-2 bg-[#1f1f1f] custom-scrollbar overscroll-contain'>
                      {filteredEvaluators.map((evUser) => {
                        const isSelected = selectedEvaluator?.id === evUser.id;
                        return (
                          <div
                            key={evUser.id}
                            onClick={() => handleEvaluatorSelect(evUser)}
                            className={`p-2.5 rounded-lg cursor-pointer mb-1 flex justify-between items-center transition-colors ${
                              isSelected
                                ? 'bg-accent/20 border border-accent/50'
                                : 'hover:bg-[#2a2a2a] border border-transparent'
                            }`}
                          >
                            <div className='flex-1 min-w-0'>
                              <div className='text-white text-sm font-medium'>
                                {evUser.displayName}
                              </div>
                            </div>
                            {isSelected && <div className='w-2 h-2 rounded-full bg-accent shrink-0' />}
                          </div>
                        );
                      })}
                      {filteredEvaluators.length === 0 && (
                        <div className='p-4 text-center text-xs text-[#9ca3af]'>
                          {evaluatorSearch ? 'No evaluators match your search' : 'No active evaluators available'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Referee Selector ── */}
                  <div className='rounded-xl border border-[#3a3a3a] flex flex-col' style={{height: '380px'}}>
                    <div className='bg-[#2a2a2a] p-3 border-b border-[#3a3a3a] shrink-0'>
                      <div className='flex items-center justify-between mb-2.5'>
                        <h3 className='font-semibold text-white flex items-center gap-2 text-sm'>
                          <FiUser className='text-accent' /> Select Referees <span className='text-red-500'>*</span>
                        </h3>
                        {/* All / Selected tabs */}
                        <div className='flex items-center gap-1 bg-[#1f1f1f] rounded-lg p-0.5'>
                          <button
                            type='button'
                            onClick={() => setRefereeTabFilter('all')}
                            className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                              refereeTabFilter === 'all'
                                ? 'bg-[#2f2f2f] text-white'
                                : 'text-[#9ca3af] hover:text-white'
                            }`}
                          >
                            All
                          </button>
                          <button
                            type='button'
                            onClick={() => setRefereeTabFilter('selected')}
                            className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                              refereeTabFilter === 'selected'
                                ? 'bg-accent text-white'
                                : 'text-[#9ca3af] hover:text-white'
                            }`}
                          >
                            Selected
                            {selectedReferees.length > 0 && (
                              <span className={`text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${
                                refereeTabFilter === 'selected' ? 'bg-white/20' : 'bg-accent/80 text-white'
                              }`}>
                                {selectedReferees.length}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className='relative'>
                        <HiSearch className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] w-3.5 h-3.5' />
                        <input
                          type='text'
                          placeholder='Search referees...'
                          value={refereeSearch}
                          onChange={(e) => setRefereeSearch(e.target.value)}
                          className='w-full bg-[#1f1f1f] text-white text-sm rounded-lg pl-8 pr-8 py-2 outline-none border border-transparent focus:border-accent/40'
                        />
                        {refereeSearch && (
                          <button onClick={() => setRefereeSearch('')} className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white'>
                            <HiX className='w-3.5 h-3.5' />
                          </button>
                        )}
                      </div>
                      {/* Selected referee pills */}
                      {selectedReferees.length > 0 && refereeTabFilter === 'all' && (
                        <div className='flex flex-wrap gap-1 mt-2 max-h-[52px] overflow-y-auto custom-scrollbar'>
                          {selectedReferees.map(rid => {
                            const ref = referees.find(r => r.id === rid);
                            return (
                              <span key={rid} className='flex items-center gap-1 text-[10px] bg-accent/20 text-accent border border-accent/30 rounded-full px-2 py-0.5'>
                                {ref?.displayName || 'Unknown'}
                                <button type='button' onClick={() => handleRefereeToggle(rid)} className='hover:text-white'>
                                  <HiX className='w-2.5 h-2.5' />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className='overflow-y-auto flex-1 p-2 bg-[#1f1f1f] custom-scrollbar overscroll-contain'>
                      {filteredReferees.map((ref) => {
                        const isAssigned = assignedRefereeIdsForSelectedDateAndEvaluator.has(ref.id);
                        const isSelected = selectedReferees.includes(ref.id);
                        return (
                          <div
                            key={ref.id}
                            onClick={() => handleRefereeToggle(ref.id)}
                            className={`p-2.5 rounded-lg cursor-pointer mb-1 flex justify-between items-center transition-colors border ${
                              isSelected
                                ? 'bg-accent/20 border-accent/50 text-white'
                                : 'hover:bg-[#2a2a2a] text-white border-transparent'
                            }`}
                          >
                            <div className='flex-1 min-w-0'>
                              <div className='text-sm font-medium flex items-center gap-1.5 flex-wrap'>
                                {ref.displayName}
                                {isAssigned && (
                                  <span className='text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium whitespace-nowrap'>
                                    Assigned
                                  </span>
                                )}
                              </div>
                              {ref.tier && <div className='text-xs text-[#9ca3af] mt-0.5'>{ref.tier}</div>}
                            </div>
                            {isSelected && <HiX className='w-3.5 h-3.5 text-accent shrink-0 ml-1' />}
                          </div>
                        );
                      })}
                      {filteredReferees.length === 0 && (
                        <div className='p-4 text-center text-xs text-[#9ca3af]'>
                          {refereeTabFilter === 'selected'
                            ? 'No referees selected yet'
                            : refereeSearch
                              ? 'No referees match your search'
                              : 'No active referees available'}
                        </div>
                      )}
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

              {loading ? <EvaluationListSkeleton /> : (
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