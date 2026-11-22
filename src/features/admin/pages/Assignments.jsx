'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiX, HiPlus, HiChevronUp, HiChevronDown, HiSearch, HiPencil } from 'react-icons/hi';
import { FiUsers, FiUser, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';
import EvaluationListSkeleton from '@/ui/skeletons/EvaluationListSkeleton';

// In-memory module cache across client tab navigations
let globalAssignmentsCache = {
  evaluators: [],
  referees: [],
  assignments: [],
  locationsList: [],
  includePast: false,
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

const getTierColor = (tier) => {
  if (!tier) return 'bg-[#374151] text-gray-200 border border-gray-600/30';
  switch (tier) {
    case 'Tier 100':
      return 'bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40';
    case 'Tier 150':
      return 'bg-gray-200/20 text-gray-200 border border-gray-400/40';
    case 'Tier 200':
      return 'bg-[#86efac]/20 text-[#86efac] border border-[#86efac]/40';
    case 'Tier 250':
      return 'bg-[#93c5fd]/20 text-[#93c5fd] border border-[#93c5fd]/40';
    case 'Tier 300':
      return 'bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/40';
    case 'Tier 350':
      return 'bg-[#f472b6]/20 text-[#f472b6] border border-[#f472b6]/40';
    default:
      return 'bg-gray-200/20 text-gray-200 border border-gray-400/40';
  }
};

const getInitials = (name) => {
  if (!name) return 'REF';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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

  // Friendly Roster Viewer State
  const [viewingRosterAssignment, setViewingRosterAssignment] = useState(null);

  // Floating Hover Popover State (Portal-rendered to prevent table overflow clipping)
  const [hoveredCrew, setHoveredCrew] = useState(null); // { assignment, rect }
  const hoverTimeoutRef = useRef(null);

  const handleCrewMouseEnter = (asgn, el) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = el.getBoundingClientRect();
    setHoveredCrew({ assignment: asgn, rect });
  };

  const handleCrewMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCrew(null);
    }, 230);
  };

  const handlePopoverMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handlePopoverMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCrew(null);
    }, 230);
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (hoveredCrew) setHoveredCrew(null);
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [hoveredCrew]);

  const renderFloatingCrewPopover = () => {
    if (!hoveredCrew || typeof document === 'undefined') return null;
    const { assignment, rect } = hoveredCrew;
    const refCount = assignment.refereeIds?.length || 0;
    if (refCount === 0) return null;

    const popoverWidth = 290;
    // Generous height estimate including padding and bottom edit button
    const estimatedHeight = Math.min(320, 130 + refCount * 40);

    // Calculate whether to place above or below trigger
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < estimatedHeight + 20 && rect.top > estimatedHeight;

    const top = placeAbove
      ? rect.top - estimatedHeight - 10
      : rect.bottom + 8;

    const left = Math.max(12, Math.min(rect.left, window.innerWidth - popoverWidth - 12));
    const arrowLeft = Math.max(16, Math.min(rect.left - left + 20, popoverWidth - 24));

    return createPortal(
      <div
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
        style={{
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${popoverWidth}px`,
          zIndex: 99999,
        }}
        className='bg-[#222222]/98 backdrop-blur-md border border-[#3d3d3d] rounded-2xl p-4 pb-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-auto'
      >
        {/* Invisible bridge to prevent mouse leaving when moving across gap */}
        <div
          className={`absolute left-0 right-0 h-4 pointer-events-auto ${placeAbove ? '-bottom-4' : '-top-4'
            }`}
        />

        {/* Decorative arrow pointer */}
        <div
          style={{
            position: 'absolute',
            left: `${arrowLeft}px`,
            [placeAbove ? 'bottom' : 'top']: '-5px',
          }}
          className={`w-2.5 h-2.5 bg-[#222222] border-[#3d3d3d] rotate-45 ${placeAbove ? 'border-b border-r' : 'border-t border-l'
            }`}
        />

        <div className='relative z-10'>
          {/* Header */}
          <div className='flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#353535]'>
            <span className='text-xs font-bold text-white flex items-center gap-1.5'>
              <FiUsers className='text-accent w-3.5 h-3.5' /> Officiating Crew
            </span>
            <span className='text-[10px] font-bold bg-accent/20 text-accent px-2 py-0.5 rounded-full'>
              {refCount} Officials
            </span>
          </div>

          {/* Crew List */}
          <div className='max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1'>
            {assignment.refereeIds.map((rid) => {
              const ref = referees.find((r) => r.id === rid);
              const initials = getInitials(ref?.displayName);
              return (
                <div key={rid} className='flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <div className='w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[10px] font-bold text-accent shrink-0'>
                      {initials}
                    </div>
                    <span className='text-xs text-gray-200 font-medium truncate'>
                      {ref?.displayName || 'Unknown Referee'}
                    </span>
                  </div>
                  {ref?.tier && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${getTierColor(ref.tier)}`}>
                      {ref.tier}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Action with extra margin and prominent easily-clickable edit button */}
          <div className='mt-3 pt-3 mb-1 border-t border-[#353535] flex items-center justify-between gap-2'>
            <span className='text-[11px] text-[#9ca3af]'>
              Manage crew
            </span>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                setHoveredCrew(null);
                setViewingRosterAssignment(assignment);
              }}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/40 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95'
            >
              <HiPencil className='w-3.5 h-3.5' />
              <span>Edit Crew</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Assignment Editing State
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editEvaluator, setEditEvaluator] = useState(null);
  const [editSelectedReferees, setEditSelectedReferees] = useState([]);
  const [editEvaluatorSearch, setEditEvaluatorSearch] = useState('');
  const [editRefereeSearch, setEditRefereeSearch] = useState('');
  const [editRefereeTabFilter, setEditRefereeTabFilter] = useState('all');
  const [isEditTimeDropdownOpen, setIsEditTimeDropdownOpen] = useState(false);
  const editTimeDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target)) {
        setIsTimeDropdownOpen(false);
      }
      if (editTimeDropdownRef.current && !editTimeDropdownRef.current.contains(event.target)) {
        setIsEditTimeDropdownOpen(false);
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
  const [showPastAssignments, setShowPastAssignments] = useState(() => globalAssignmentsCache.includePast);

  // In-memory module cache to instantly render when switching tabs
  const dataCacheRef = useRef(globalAssignmentsCache);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const hasStaticLists = globalAssignmentsCache.loaded;

      // If we already have cached data matching the current history scope, populate immediately
      if (hasStaticLists && globalAssignmentsCache.includePast === showPastAssignments) {
        setEvaluators(globalAssignmentsCache.evaluators);
        setReferees(globalAssignmentsCache.referees);
        setAssignments(globalAssignmentsCache.assignments);
        setLocationsList(globalAssignmentsCache.locationsList);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const assignmentsQuery = showPastAssignments
          ? query(collection(db, 'assignments'))
          : query(collection(db, 'assignments'), where('scheduledDate', '>=', thirtyDaysAgo));

        // Reuse cached evaluators/referees/locations when toggling history filter
        const [
          evaluatorsSnapshot,
          refereesSnapshot,
          assignmentsSnapshot,
          locationsSnapshot
        ] = await Promise.all([
          hasStaticLists ? Promise.resolve(null) : getDocs(query(collection(db, 'users'), where('role', '==', 'evaluator'))),
          hasStaticLists ? Promise.resolve(null) : getDocs(query(collection(db, 'users'), where('role', '==', 'referee'))),
          getDocs(assignmentsQuery),
          hasStaticLists ? Promise.resolve(null) : getDocs(query(collection(db, 'locations')))
        ]);

        if (!isMounted) return;

        const newEvaluators = evaluatorsSnapshot
          ? evaluatorsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          : globalAssignmentsCache.evaluators;
        const newReferees = refereesSnapshot
          ? refereesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          : globalAssignmentsCache.referees;
        const newAssignments = assignmentsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const newLocations = locationsSnapshot
          ? locationsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          : globalAssignmentsCache.locationsList;

        // Update in-memory global cache
        globalAssignmentsCache = {
          evaluators: newEvaluators,
          referees: newReferees,
          assignments: newAssignments,
          locationsList: newLocations,
          includePast: showPastAssignments,
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
  }, [showPastAssignments]);

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
        const parts = filterDate.split('-').map(Number);
        if (parts.length === 3) {
          const [fYear, fMonth, fDay] = parts;
          matchesDate =
            assignmentDate.getFullYear() === fYear &&
            assignmentDate.getMonth() + 1 === fMonth &&
            assignmentDate.getDate() === fDay;
        }
      }

      return matchesLocation && matchesEvaluator && matchesReferee && matchesDate;
    });
  }, [assignments, filterLocation, filterEvaluator, filterReferee, filterDate, evaluators, referees]);

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    if (typeof d2 === 'string' && d2.includes('-')) {
      const parts = d2.split('T')[0].split('-').map(Number);
      if (parts.length === 3) {
        const [y2, m2, day2] = parts;
        return (
          date1.getFullYear() === y2 &&
          date1.getMonth() + 1 === m2 &&
          date1.getDate() === day2
        );
      }
    }
    const date2 = d2.toDate ? d2.toDate() : new Date(d2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // ---------------------------------------------------------------------------
  // Global Conflict Detection Engine (90-120 minute window across all venues)
  // ---------------------------------------------------------------------------
  const CONFLICT_WINDOW_MINUTES = 105; // 1h 45m buffer for basketball games

  const getRefereeConflict = (targetDate, targetTime, refId, excludeAssignmentId = null) => {
    if (!targetDate || !targetTime || !refId) return null;
    const targetMs = new Date(`${targetDate}T${targetTime}`).getTime();
    if (isNaN(targetMs)) return null;

    const windowMs = CONFLICT_WINDOW_MINUTES * 60 * 1000;

    // 1. Direct Time Overlap Check (< 105 minute buffer)
    for (const asgn of assignments) {
      if (excludeAssignmentId && asgn.id === excludeAssignmentId) continue;
      if (!Array.isArray(asgn.refereeIds) || !asgn.refereeIds.includes(refId)) continue;

      const asgnDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
      const asgnMs = asgnDate.getTime();
      if (isNaN(asgnMs)) continue;

      const diffMs = Math.abs(targetMs - asgnMs);
      if (diffMs < windowMs) {
        const timeStr = asgnDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return {
          type: 'overlap',
          time: timeStr,
          location: asgn.location || 'Unknown venue',
          label: `Conflict: ${timeStr} @ ${asgn.location || 'Other game'}`,
        };
      }
    }

    // 2. Same Day Notice (earlier/later on the same day)
    for (const asgn of assignments) {
      if (excludeAssignmentId && asgn.id === excludeAssignmentId) continue;
      if (!Array.isArray(asgn.refereeIds) || !asgn.refereeIds.includes(refId)) continue;

      if (isSameDay(asgn.scheduledDate, targetDate)) {
        const asgnDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
        const timeStr = asgnDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return {
          type: 'same-day',
          time: timeStr,
          location: asgn.location || '',
          label: `Game today: ${timeStr}`,
        };
      }
    }

    return null;
  };

  const getEvaluatorConflict = (targetDate, targetTime, evaluatorId, excludeAssignmentId = null) => {
    if (!targetDate || !targetTime || !evaluatorId) return null;
    const targetMs = new Date(`${targetDate}T${targetTime}`).getTime();
    if (isNaN(targetMs)) return null;

    const windowMs = CONFLICT_WINDOW_MINUTES * 60 * 1000;

    for (const asgn of assignments) {
      if (excludeAssignmentId && asgn.id === excludeAssignmentId) continue;
      if (asgn.evaluatorId !== evaluatorId) continue;

      const asgnDate = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
      const asgnMs = asgnDate.getTime();
      if (isNaN(asgnMs)) continue;

      const diffMs = Math.abs(targetMs - asgnMs);
      if (diffMs < windowMs) {
        const timeStr = asgnDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return {
          type: 'overlap',
          time: timeStr,
          location: asgn.location || 'Unknown venue',
          label: `Conflict: ${timeStr} @ ${asgn.location || 'Other venue'}`,
        };
      }
    }

    return null;
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

    // Global Double-Booking Conflict Validation
    const overlappingMembers = [];
    const evConflict = getEvaluatorConflict(date, time, selectedEvaluator.id);
    if (evConflict?.type === 'overlap') {
      overlappingMembers.push(`• Evaluator: ${selectedEvaluator.displayName} (${evConflict.label})`);
    }
    selectedReferees.forEach((rid) => {
      const c = getRefereeConflict(date, time, rid);
      if (c?.type === 'overlap') {
        const ref = referees.find((r) => r.id === rid);
        overlappingMembers.push(`• Referee: ${ref?.displayName || 'Unknown'} (${c.label})`);
      }
    });

    if (overlappingMembers.length > 0) {
      const confirmMsg = `⚠️ Double-Booking Warning:\n\nThe following official(s) have an overlapping game scheduled within 1h 45m:\n\n${overlappingMembers.join('\n')}\n\nDo you want to proceed and assign anyway?`;
      if (!window.confirm(confirmMsg)) return;
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

  // ---------------------------------------------------------------------------
  // Edit Assignment Helpers & Handlers
  // ---------------------------------------------------------------------------
  const getAssignmentDateString = (scheduledDate) => {
    if (!scheduledDate) return getCurrentLocalDate();
    const d = scheduledDate.toDate ? scheduledDate.toDate() : new Date(scheduledDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getAssignmentTimeString = (scheduledDate) => {
    if (!scheduledDate) return '12:00';
    const d = scheduledDate.toDate ? scheduledDate.toDate() : new Date(scheduledDate);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleStartEdit = (asgn) => {
    setEditingAssignment(asgn);
    setEditDate(getAssignmentDateString(asgn.scheduledDate));
    setEditTime(getAssignmentTimeString(asgn.scheduledDate));
    setEditLocation(asgn.location || '');
    const currentEvaluator = evaluators.find((e) => e.id === asgn.evaluatorId) || null;
    setEditEvaluator(currentEvaluator);
    setEditSelectedReferees(Array.isArray(asgn.refereeIds) ? [...asgn.refereeIds] : []);
    setEditRefereeSearch('');
    setEditEvaluatorSearch('');
    setEditRefereeTabFilter('all');
    setIsEditTimeDropdownOpen(false);
  };

  const handleCloseEdit = () => {
    setEditingAssignment(null);
    setIsEditTimeDropdownOpen(false);
  };

  const handleEditRefereeToggle = (refereeId) => {
    const ref = referees.find((r) => r.id === refereeId);
    if (isUserDisabled(ref)) return;
    setEditSelectedReferees((prev) =>
      prev.includes(refereeId) ? prev.filter((id) => id !== refereeId) : [...prev, refereeId]
    );
  };

  const filteredEditEvaluators = useMemo(() => {
    return activeEvaluators.filter((ev) =>
      ev.displayName?.toLowerCase().includes(editEvaluatorSearch.toLowerCase())
    );
  }, [activeEvaluators, editEvaluatorSearch]);

  const filteredEditReferees = useMemo(() => {
    let base = activeReferees.filter((ref) =>
      ref.displayName?.toLowerCase().includes(editRefereeSearch.toLowerCase())
    );
    if (editRefereeTabFilter === 'selected') {
      base = base.filter((ref) => editSelectedReferees.includes(ref.id));
    }
    return base;
  }, [activeReferees, editRefereeSearch, editRefereeTabFilter, editSelectedReferees]);

  const assignedRefereeIdsForEditDateAndEvaluator = useMemo(() => {
    if (!editEvaluator || !editDate) return new Set();
    const ids = new Set();
    assignments
      .filter(a => a.id !== editingAssignment?.id && a.evaluatorId === editEvaluator.id && isSameDay(a.scheduledDate, editDate))
      .forEach(a => {
        if (Array.isArray(a.refereeIds)) {
          a.refereeIds.forEach(id => ids.add(id));
        }
      });
    return ids;
  }, [editEvaluator, assignments, editDate, editingAssignment]);

  const handleSaveEdit = async () => {
    if (!editingAssignment) return;
    const missingFields = [];
    if (!editDate) missingFields.push('Date');
    if (!editTime) missingFields.push('Time');
    if (!editLocation) missingFields.push('Location');
    if (!editEvaluator) missingFields.push('Evaluator');
    if (editSelectedReferees.length === 0) missingFields.push('at least one Referee');

    if (missingFields.length > 0) {
      alert(`Please complete the following required fields:\n\n${missingFields.map((field) => `• ${field}`).join('\n')}`);
      return;
    }

    if (editEvaluator && isUserDisabled(editEvaluator)) {
      alert('The selected evaluator account is suspended or deleted.');
      return;
    }

    const hasDisabledRef = editSelectedReferees.some((rid) => {
      const ref = referees.find((r) => r.id === rid);
      return isUserDisabled(ref);
    });
    if (hasDisabledRef) {
      alert('One or more selected referees are suspended or deleted.');
      return;
    }

    // Global Double-Booking Conflict Validation for Edit
    const overlappingMembers = [];
    const evConflict = getEvaluatorConflict(editDate, editTime, editEvaluator.id, editingAssignment.id);
    if (evConflict?.type === 'overlap') {
      overlappingMembers.push(`• Evaluator: ${editEvaluator.displayName} (${evConflict.label})`);
    }
    editSelectedReferees.forEach((rid) => {
      const c = getRefereeConflict(editDate, editTime, rid, editingAssignment.id);
      if (c?.type === 'overlap') {
        const ref = referees.find((r) => r.id === rid);
        overlappingMembers.push(`• Referee: ${ref?.displayName || 'Unknown'} (${c.label})`);
      }
    });

    if (overlappingMembers.length > 0) {
      const confirmMsg = `⚠️ Double-Booking Warning:\n\nThe following official(s) have an overlapping game scheduled within 1h 45m:\n\n${overlappingMembers.join('\n')}\n\nDo you want to proceed and save changes anyway?`;
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      const scheduledDate = new Date(`${editDate}T${editTime}`);
      const updatedData = {
        evaluatorId: editEvaluator.id,
        refereeIds: editSelectedReferees,
        location: editLocation,
        scheduledDate,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'assignments', editingAssignment.id), updatedData);

      setAssignments((prev) => {
        const next = prev.map((a) =>
          a.id === editingAssignment.id ? { ...a, ...updatedData } : a
        );
        globalAssignmentsCache.assignments = next;
        return next;
      });

      setEditingAssignment(null);
      alert('Assignment updated successfully!');
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment.');
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
                                className={`text-xs py-2 px-2 rounded-lg text-center font-medium transition-all ${isSelected
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
                  <div className='rounded-xl border border-[#3a3a3a] flex flex-col' style={{ height: '380px' }}>
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
                        const conflict = getEvaluatorConflict(date, time, evUser.id);
                        return (
                          <div
                            key={evUser.id}
                            onClick={() => handleEvaluatorSelect(evUser)}
                            className={`p-2.5 rounded-lg cursor-pointer mb-1 flex justify-between items-center transition-colors border ${isSelected
                              ? 'bg-accent/20 border-accent/50 text-white'
                              : conflict
                                ? 'bg-red-500/10 border-red-500/30 text-white hover:bg-red-500/20'
                                : 'hover:bg-[#2a2a2a] text-white border-transparent'
                              }`}
                          >
                            <div className='flex-1 min-w-0'>
                              <div className='text-white text-sm font-medium flex items-center gap-1.5 flex-wrap'>
                                <span>{evUser.displayName}</span>
                                {conflict && (
                                  <span className='text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap' title={conflict.label}>
                                    ⚠️ {conflict.label}
                                  </span>
                                )}
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
                  <div className='rounded-xl border border-[#3a3a3a] flex flex-col' style={{ height: '380px' }}>
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
                            className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${refereeTabFilter === 'all'
                              ? 'bg-[#2f2f2f] text-white'
                              : 'text-[#9ca3af] hover:text-white'
                              }`}
                          >
                            All
                          </button>
                          <button
                            type='button'
                            onClick={() => setRefereeTabFilter('selected')}
                            className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${refereeTabFilter === 'selected'
                              ? 'bg-accent text-white'
                              : 'text-[#9ca3af] hover:text-white'
                              }`}
                          >
                            Selected
                            {selectedReferees.length > 0 && (
                              <span className={`text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${refereeTabFilter === 'selected' ? 'bg-white/20' : 'bg-accent/80 text-white'
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
                        const conflict = getRefereeConflict(date, time, ref.id);
                        const isSelected = selectedReferees.includes(ref.id);
                        return (
                          <div
                            key={ref.id}
                            onClick={() => handleRefereeToggle(ref.id)}
                            className={`p-2.5 rounded-lg cursor-pointer mb-1 flex justify-between items-center transition-colors border ${isSelected
                              ? 'bg-accent/20 border-accent/50 text-white'
                              : conflict?.type === 'overlap'
                                ? 'bg-red-500/10 border-red-500/30 text-white hover:bg-red-500/20'
                                : 'hover:bg-[#2a2a2a] text-white border-transparent'
                              }`}
                          >
                            <div className='flex-1 min-w-0'>
                              <div className='text-sm font-medium flex items-center gap-1.5 flex-wrap'>
                                <span>{ref.displayName}</span>
                                {conflict?.type === 'overlap' && (
                                  <span className='text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap' title={conflict.label}>
                                    ⚠️ {conflict.label}
                                  </span>
                                )}
                                {conflict?.type === 'same-day' && (
                                  <span className='text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 rounded font-medium whitespace-nowrap' title={conflict.label}>
                                    📅 {conflict.label}
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
                <div className='flex items-center gap-3'>
                  <h2 className='text-fluid-xl font-semibold text-white'>Scheduled Assignments</h2>
                  <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white'>
                    {displayedAssignments.length}
                  </span>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <div className="relative">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                    <input
                      type='text'
                      placeholder='Filter Evaluator'
                      value={filterEvaluator}
                      onChange={(e) => setFilterEvaluator(e.target.value)}
                      className='bg-[#2a2a2a] text-white text-sm pl-10 pr-8 py-2 rounded-lg border border-[#3a3a3a] outline-none focus:border-accent'
                    />
                    {filterEvaluator && (
                      <button
                        type='button'
                        onClick={() => setFilterEvaluator('')}
                        className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white'
                      >
                        <HiX className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                    <input
                      type='text'
                      placeholder='Filter Referee'
                      value={filterReferee}
                      onChange={(e) => setFilterReferee(e.target.value)}
                      className='bg-[#2a2a2a] text-white text-sm pl-10 pr-8 py-2 rounded-lg border border-[#3a3a3a] outline-none focus:border-accent'
                    />
                    {filterReferee && (
                      <button
                        type='button'
                        onClick={() => setFilterReferee('')}
                        className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white'
                      >
                        <HiX className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type='date'
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className='bg-[#2a2a2a] text-white text-sm pl-3 pr-8 py-2 rounded-lg border border-[#3a3a3a] outline-none scheme-dark focus:border-accent'
                      title='Filter by date'
                    />
                    {filterDate && (
                      <button
                        type='button'
                        onClick={() => setFilterDate('')}
                        title='Clear date filter'
                        className='absolute right-2 text-[#9ca3af] hover:text-white p-0.5 rounded transition-colors'
                      >
                        <HiX className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowPastAssignments((prev) => !prev)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors font-medium whitespace-nowrap cursor-pointer ${
                      showPastAssignments
                        ? 'bg-accent/20 text-accent border-accent/40'
                        : 'bg-[#2a2a2a] text-[#9ca3af] hover:text-white border-[#3a3a3a]'
                    }`}
                    title='Toggle assignments older than 30 days'
                  >
                    {showPastAssignments ? 'Showing All History' : 'Show Past (>30d)'}
                  </button>
                  {(filterDate || filterEvaluator || filterReferee || filterLocation) && (
                    <button
                      type='button'
                      onClick={() => {
                        setFilterDate('');
                        setFilterEvaluator('');
                        setFilterReferee('');
                        setFilterLocation('');
                      }}
                      className='flex items-center gap-1 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 px-3 py-2 rounded-lg transition-colors font-medium'
                      title='Reset all active filters'
                    >
                      <HiX className='w-3.5 h-3.5' />
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <EvaluationListSkeleton />
              ) : groupedAssignments.length === 0 ? (
                <div className='text-center py-12 bg-[#2a2a2a]/30 border border-[#3a3a3a] rounded-xl p-8'>
                  <p className='text-base text-[#9ca3af] mb-4'>
                    {filterDate || filterEvaluator || filterReferee || filterLocation
                      ? 'No scheduled assignments match your current filters.'
                      : 'No scheduled assignments found.'}
                  </p>
                  {(filterDate || filterEvaluator || filterReferee || filterLocation) && (
                    <button
                      type='button'
                      onClick={() => {
                        setFilterDate('');
                        setFilterEvaluator('');
                        setFilterReferee('');
                        setFilterLocation('');
                      }}
                      className='inline-flex items-center gap-2 bg-accent hover:opacity-90 text-white text-sm px-4 py-2 rounded-lg font-medium transition-all shadow-md'
                    >
                      <HiX className='w-4 h-4' />
                      Show All Assignments
                    </button>
                  )}
                </div>
              ) : (
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
                            {items.map((asgn) => {
                              const refCount = asgn.refereeIds?.length || 0;
                              return (
                                <tr key={asgn.id} className='hover:bg-[#2a2a2a]/50 transition-colors'>
                                  <td className='py-4 px-6 text-sm text-white font-medium'>
                                    {(() => {
                                      const d = asgn.scheduledDate?.toDate ? asgn.scheduledDate.toDate() : new Date(asgn.scheduledDate);
                                      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    })()}
                                  </td>
                                  <td className='py-4 px-6 text-sm text-white'>
                                    {evaluators.find(e => e.id === asgn.evaluatorId)?.displayName || 'Unknown Evaluator'}
                                  </td>
                                  <td className='py-4 px-6 text-sm text-white'>
                                    <div className='inline-block'>
                                      <button
                                        type='button'
                                        onMouseEnter={(e) => handleCrewMouseEnter(asgn, e.currentTarget)}
                                        onMouseLeave={handleCrewMouseLeave}
                                        onClick={() => {
                                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                          setHoveredCrew(null);
                                          setViewingRosterAssignment(asgn);
                                        }}
                                        className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm'
                                      >
                                        <FiUsers className='w-3.5 h-3.5 text-accent' />
                                        <span>{refCount} {refCount === 1 ? 'Referee' : 'Referees'}</span>
                                      </button>
                                    </div>
                                  </td>
                                  <td className='py-4 px-6 text-sm text-white'>{asgn.location}</td>
                                  <td className='py-4 px-6 text-right whitespace-nowrap'>
                                    <div className='flex items-center justify-end gap-2'>
                                      <button
                                        onClick={() => handleStartEdit(asgn)}
                                        className='p-1.5 text-[#22c55e] hover:bg-[#22c55e]/10 rounded-lg transition-colors'
                                        title='Edit Assignment'
                                      >
                                        <HiPencil className='w-4 h-4' />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveAssignment(asgn.id)}
                                        className='p-1.5 text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors'
                                        title='Delete Assignment'
                                      >
                                        <HiX className='w-4 h-4' />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
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

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150'>
          <div className='bg-[#1f1f1f] border border-[#3a3a3a] rounded-[24px] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden'>
            {/* Modal Header */}
            <div className='p-6 border-b border-[#3a3a3a] flex items-center justify-between shrink-0 bg-[#252525]'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent'>
                  <HiPencil className='w-5 h-5' />
                </div>
                <div>
                  <h3 className='text-lg font-bold text-white'>Edit Assignment</h3>
                  <p className='text-xs text-[#9ca3af]'>Update game assignment details, evaluator, or referee roster</p>
                </div>
              </div>
              <button
                onClick={handleCloseEdit}
                className='text-[#9ca3af] hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors'
              >
                <HiX className='w-5 h-5' />
              </button>
            </div>

            {/* Modal Body */}
            <div className='p-6 overflow-y-auto space-y-6 custom-scrollbar'>
              {/* Date, Time, Location */}
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                    <FiCalendar /> Date <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='date'
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] scheme-dark focus:ring-2 focus:ring-accent outline-none'
                  />
                </div>

                <div className='space-y-2 relative' ref={editTimeDropdownRef}>
                  <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                    <FiClock /> Time <span className='text-red-500'>*</span>
                  </label>
                  <div className='relative flex items-center'>
                    <input
                      type='time'
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] scheme-dark focus:ring-2 focus:ring-accent outline-none pr-10'
                    />
                    <button
                      type='button'
                      title='Choose from time list'
                      onClick={() => setIsEditTimeDropdownOpen((prev) => !prev)}
                      className='absolute right-2.5 p-1 text-[#9ca3af] hover:text-white rounded-md hover:bg-white/10 transition-colors'
                    >
                      <HiChevronDown className={`w-5 h-5 transition-transform duration-150 ${isEditTimeDropdownOpen ? "rotate-180 text-accent" : ""}`} />
                    </button>
                  </div>

                  {isEditTimeDropdownOpen && (
                    <div className='absolute left-0 right-0 top-full mt-1 z-50 bg-[#262626] border border-[#3a3a3a] rounded-xl shadow-2xl overflow-hidden'>
                      <div className='p-2.5 bg-[#202020] border-b border-[#3a3a3a] flex items-center justify-between text-xs text-[#9ca3af]'>
                        <span className='font-medium text-white'>Select Time Slot</span>
                        <span className='text-accent'>15 min intervals</span>
                      </div>
                      <div className='max-h-48 overflow-y-auto p-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5 hide-scrollbar'>
                        {timeOptions.map((opt) => {
                          const isSelected = editTime === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type='button'
                              onClick={() => {
                                setEditTime(opt.value);
                                setIsEditTimeDropdownOpen(false);
                              }}
                              className={`text-xs py-2 px-2 rounded-lg text-center font-medium transition-all ${isSelected
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
                  <label className='text-sm text-[#9ca3af] font-medium flex items-center gap-2'>
                    <FiMapPin /> Location <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className='w-full bg-[#2a2a2a] text-white rounded-xl px-4 py-3 border border-[#3a3a3a] outline-none appearance-none'
                  >
                    <option value="">Select Location</option>
                    {locationsList.map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Evaluator & Referees Selection */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {/* Evaluator Selection */}
                <div className='border border-[#3a3a3a] rounded-xl p-4 flex flex-col bg-[#242424] max-h-[380px]'>
                  <div className='flex justify-between items-center mb-3 pb-2 border-b border-[#3a3a3a]'>
                    <label className='text-sm text-white font-medium flex items-center gap-2'>
                      <FiUser /> Evaluator <span className='text-red-500'>*</span>
                    </label>
                    {editEvaluator && (
                      <span className='text-xs bg-accent/20 text-accent px-2 py-0.5 rounded font-medium truncate max-w-[150px]'>
                        {editEvaluator.displayName}
                      </span>
                    )}
                  </div>
                  <div className='relative mb-3'>
                    <HiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] w-4 h-4' />
                    <input
                      type='text'
                      placeholder='Search evaluators...'
                      value={editEvaluatorSearch}
                      onChange={(e) => setEditEvaluatorSearch(e.target.value)}
                      className='w-full bg-[#1c1c1c] text-white text-sm rounded-lg pl-9 pr-8 py-2 outline-none border border-transparent focus:border-accent/40'
                    />
                    {editEvaluatorSearch && (
                      <button onClick={() => setEditEvaluatorSearch('')} className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white'>
                        <HiX className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                  <div className='overflow-y-auto flex-1 p-1 custom-scrollbar space-y-1'>
                    {filteredEditEvaluators.map((ev) => {
                      const isSelected = editEvaluator?.id === ev.id;
                      const conflict = getEvaluatorConflict(editDate, editTime, ev.id, editingAssignment.id);
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setEditEvaluator(ev)}
                          className={`p-2.5 rounded-lg cursor-pointer flex justify-between items-center transition-colors border ${isSelected
                            ? 'bg-accent/20 border-accent/50 text-white'
                            : conflict
                              ? 'bg-red-500/10 border-red-500/30 text-white hover:bg-red-500/20'
                              : 'hover:bg-[#2e2e2e] text-white border-transparent'
                            }`}
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium text-sm flex items-center gap-1.5 flex-wrap'>
                              <span>{ev.displayName}</span>
                              {conflict && (
                                <span className='text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap' title={conflict.label}>
                                  ⚠️ {conflict.label}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <span className='text-xs text-accent font-semibold ml-1'>Selected</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Referees Selection */}
                <div className='border border-[#3a3a3a] rounded-xl p-4 flex flex-col bg-[#242424] max-h-[380px]'>
                  <div className='flex justify-between items-center mb-3 pb-2 border-b border-[#3a3a3a]'>
                    <label className='text-sm text-white font-medium flex items-center gap-2'>
                      <FiUsers /> Referees <span className='text-red-500'>*</span>
                    </label>
                    <span className='text-xs bg-accent/20 text-accent px-2 py-0.5 rounded font-medium'>
                      {editSelectedReferees.length} Selected
                    </span>
                  </div>

                  <div className='flex gap-1 mb-2 bg-[#1c1c1c] p-0.5 rounded-lg border border-[#3a3a3a]'>
                    <button
                      type='button'
                      onClick={() => setEditRefereeTabFilter('all')}
                      className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${editRefereeTabFilter === 'all'
                        ? 'bg-accent text-white'
                        : 'text-[#9ca3af] hover:text-white'
                        }`}
                    >
                      All ({activeReferees.length})
                    </button>
                    <button
                      type='button'
                      onClick={() => setEditRefereeTabFilter('selected')}
                      className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${editRefereeTabFilter === 'selected'
                        ? 'bg-accent text-white'
                        : 'text-[#9ca3af] hover:text-white'
                        }`}
                    >
                      Selected ({editSelectedReferees.length})
                    </button>
                  </div>

                  <div className='relative mb-2'>
                    <HiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] w-4 h-4' />
                    <input
                      type='text'
                      placeholder='Search referees...'
                      value={editRefereeSearch}
                      onChange={(e) => setEditRefereeSearch(e.target.value)}
                      className='w-full bg-[#1c1c1c] text-white text-sm rounded-lg pl-9 pr-8 py-2 outline-none border border-transparent focus:border-accent/40'
                    />
                    {editRefereeSearch && (
                      <button onClick={() => setEditRefereeSearch('')} className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-white'>
                        <HiX className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>

                  <div className='overflow-y-auto flex-1 p-1 custom-scrollbar space-y-1'>
                    {filteredEditReferees.map((ref) => {
                      const conflict = getRefereeConflict(editDate, editTime, ref.id, editingAssignment.id);
                      const isSelected = editSelectedReferees.includes(ref.id);
                      return (
                        <div
                          key={ref.id}
                          onClick={() => handleEditRefereeToggle(ref.id)}
                          className={`p-2.5 rounded-lg cursor-pointer flex justify-between items-center transition-colors border ${isSelected
                            ? 'bg-accent/20 border-accent/50 text-white'
                            : conflict?.type === 'overlap'
                              ? 'bg-red-500/10 border-red-500/30 text-white hover:bg-red-500/20'
                              : 'hover:bg-[#2e2e2e] text-white border-transparent'
                            }`}
                        >
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium flex items-center gap-1.5 flex-wrap'>
                              <span>{ref.displayName}</span>
                              {conflict?.type === 'overlap' && (
                                <span className='text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap' title={conflict.label}>
                                  ⚠️ {conflict.label}
                                </span>
                              )}
                              {conflict?.type === 'same-day' && (
                                <span className='text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 rounded font-medium whitespace-nowrap' title={conflict.label}>
                                  📅 {conflict.label}
                                </span>
                              )}
                            </div>
                            {ref.tier && <div className='text-xs text-[#9ca3af] mt-0.5'>{ref.tier}</div>}
                          </div>
                          {isSelected && <HiX className='w-4 h-4 text-accent shrink-0 ml-1' />}
                        </div>
                      );
                    })}
                    {filteredEditReferees.length === 0 && (
                      <div className='p-4 text-center text-xs text-[#9ca3af]'>
                        {editRefereeTabFilter === 'selected'
                          ? 'No referees selected yet'
                          : 'No referees match your search'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className='p-6 border-t border-[#3a3a3a] flex items-center justify-end gap-3 bg-[#252525] shrink-0'>
              <button
                type='button'
                onClick={handleCloseEdit}
                className='px-5 py-2.5 rounded-xl border border-[#3a3a3a] text-white hover:bg-white/10 transition-colors text-sm font-medium'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleSaveEdit}
                className='px-6 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white transition-all text-sm font-semibold shadow-lg'
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Officiating Crew Popover (Portal to body so it is never trapped/clipped by table) */}
      {renderFloatingCrewPopover()}

      {/* Friendly Officiating Crew Modal */}
      {viewingRosterAssignment && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150'>
          <div className='bg-[#1f1f1f] border border-[#3a3a3a] rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150'>
            {/* Header */}
            <div className='p-6 border-b border-[#3a3a3a] bg-[#252525] flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='w-11 h-11 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-inner'>
                  <FiUsers className='w-5 h-5' />
                </div>
                <div>
                  <div className='flex items-center gap-2'>
                    <h3 className='text-lg font-bold text-white'>Officiating Crew</h3>
                    <span className='px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent text-white'>
                      {viewingRosterAssignment.refereeIds?.length || 0}
                    </span>
                  </div>
                  <p className='text-xs text-[#9ca3af] mt-0.5 flex items-center gap-2'>
                    <span>{(() => {
                      const d = viewingRosterAssignment.scheduledDate?.toDate ? viewingRosterAssignment.scheduledDate.toDate() : new Date(viewingRosterAssignment.scheduledDate);
                      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    })()}</span>
                    <span>•</span>
                    <span className='text-white font-medium'>{viewingRosterAssignment.location || 'Location'}</span>
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setViewingRosterAssignment(null)}
                className='text-[#9ca3af] hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors'
              >
                <HiX className='w-5 h-5' />
              </button>
            </div>

            {/* Crew List */}
            <div className='p-6 max-h-[380px] overflow-y-auto space-y-2.5 custom-scrollbar'>
              {viewingRosterAssignment.refereeIds && viewingRosterAssignment.refereeIds.length > 0 ? (
                viewingRosterAssignment.refereeIds.map((rid) => {
                  const ref = referees.find((r) => r.id === rid);
                  const initials = getInitials(ref?.displayName);
                  return (
                    <div
                      key={rid}
                      className='flex items-center justify-between p-3 rounded-xl bg-[#262626] border border-[#353535] hover:border-[#454545] transition-all'
                    >
                      <div className='flex items-center gap-3 min-w-0'>
                        <div className='w-9 h-9 rounded-full bg-gradient-to-br from-accent/30 to-[#333] border border-accent/30 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm'>
                          {initials}
                        </div>
                        <div className='min-w-0'>
                          <div className='text-sm font-semibold text-white truncate'>
                            {ref?.displayName || 'Unknown Referee'}
                          </div>
                          {ref?.email && (
                            <div className='text-[11px] text-[#9ca3af] truncate'>
                              {ref.email}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className='shrink-0 ml-3'>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getTierColor(ref?.tier)}`}>
                          {ref?.tier || 'Tier 100'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className='text-center py-8 text-sm text-[#9ca3af]'>
                  No referees assigned yet to this game.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='p-5 border-t border-[#3a3a3a] bg-[#252525] flex items-center justify-between gap-3'>
              <button
                type='button'
                onClick={() => setViewingRosterAssignment(null)}
                className='px-4 py-2.5 rounded-xl border border-[#3a3a3a] text-sm text-[#9ca3af] hover:text-white hover:bg-white/5 transition-colors font-medium'
              >
                Close
              </button>
              <button
                type='button'
                onClick={() => {
                  const asgnToEdit = viewingRosterAssignment;
                  setViewingRosterAssignment(null);
                  handleStartEdit(asgnToEdit);
                }}
                className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-semibold transition-all shadow-md active:scale-95'
              >
                <HiPencil className='w-4 h-4' />
                Edit Crew
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;