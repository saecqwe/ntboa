'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, getDocs, orderBy, limit } from 'firebase/firestore';
import { createUser } from '@/features/authentication/services/authService';
import { db, functions } from '@/services/firebase/config';
import { httpsCallable } from 'firebase/functions';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import { HiMenu, HiPlus, HiPencil, HiTrash, HiX, HiChevronUp, HiChevronDown, HiSelector } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import { TIER_DATA, getScoresForReferee, getOfficialTotalScore, normalizeTier } from '@/lib/evaluationUtils';

// ---------------------------------------------------------------------------
// Module-level cache — survives component unmounts (tab switches).
// ---------------------------------------------------------------------------
let globalRefereesCache = {
  referees: [],
  loaded: false,
  timestamp: 0,
};

const RefereesPage = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
  const [editFormData, setEditFormData] = useState({ id: '', fullName: '', email: '', tier: '' });
  const [editingReferee, setEditingReferee] = useState(null);

  // Initialize from module-level cache for instant tab switch renders
  const [referees, setReferees] = useState(() => globalRefereesCache.referees);
  const [loading, setLoading] = useState(() => !globalRefereesCache.loaded);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'displayName', direction: 'asc' });

  // Ref to hold the onSnapshot unsubscribe so useEffect cleanup can reach it
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // Pure helper for race-free pre-aggregated stats from the referee document
    const applyPreAggregatedStats = (referee) => {
      const evalCount =
        typeof referee.evaluationsCount === 'number'
          ? referee.evaluationsCount
          : typeof referee.evaluations === 'number'
          ? referee.evaluations
          : 0;

      const avgScore =
        typeof referee.evaluationsCount === 'number' &&
        referee.evaluationsCount > 0 &&
        typeof referee.totalScoreSum === 'number'
          ? Number((referee.totalScoreSum / referee.evaluationsCount).toFixed(1))
          : typeof referee.avgScore === 'number'
          ? referee.avgScore
          : 0;

      return {
        ...referee,
        evaluations: evalCount,
        avgScore,
        suggestedTier: referee.suggestedTier || 'N/A',
      };
    };

    // Step 1: Set up real-time listener for referees FIRST — shows the list + pre-aggregated stats immediately
    const q = query(collection(db, 'users'), where('role', '==', 'referee'));
    
    // Track whether we've loaded enrichment data
    let enrichmentData = null;
    let enrichmentTriggered = false;

    const enrichReferees = (refereesList) => {
      const baseList = refereesList.map(applyPreAggregatedStats);
      if (!enrichmentData) return baseList;
      const { allEvaluations, allAssignments } = enrichmentData;

      return baseList.map(referee => {
        const hasPreAggregated = typeof referee.evaluationsCount === 'number';

        let evalCount = referee.evaluations;
        let avgScore = referee.avgScore;
        let suggestedTier = referee.suggestedTier;

        if (!hasPreAggregated && allEvaluations.length > 0) {
          const refereeEvals = allEvaluations.filter(e =>
            e.refereeId === referee.id ||
            (Array.isArray(e.refereeIds) && e.refereeIds.includes(referee.id)) ||
            (Array.isArray(e.officials) && e.officials.some(o => o.id === referee.id))
          );
          evalCount = refereeEvals.length;
          avgScore = refereeEvals.length > 0
            ? (refereeEvals.reduce((acc, curr) => {
                const score = getOfficialTotalScore(getScoresForReferee(curr, referee.id)) || curr.totalScore || 0;
                return acc + Number(score);
              }, 0) / refereeEvals.length).toFixed(1)
            : 0;
          const latestEval = refereeEvals[0];
          suggestedTier = referee.suggestedTier !== 'N/A'
            ? referee.suggestedTier
            : latestEval?.tier || 'N/A';
        }

        const myAssignments = allAssignments.filter(a =>
          a.refereeIds && a.refereeIds.includes(referee.id)
        );
        const futureAssignments = myAssignments
          .map(a => ({
            ...a,
            dateObj: a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate)
          }))
          .sort((a, b) => a.dateObj - b.dateObj);

        const nextGame = futureAssignments[0];
        const nextAssignmentData = nextGame ? {
          location: nextGame.location,
          game: 'Scheduled Match',
          dateTime: nextGame.dateObj.toISOString()
        } : null;

        return {
          ...referee,
          evaluations: evalCount,
          avgScore,
          suggestedTier,
          nextAssignment: nextAssignmentData,
        };
      });
    };

    // Step 2: Load future assignments (and legacy evaluations fallback ONLY if any referee lacks pre-aggregated counts)
    const loadEnrichmentData = async (needsEvalFallback) => {
      try {
        const now = new Date();
        // Only fetch future assignments instead of the entire collection
        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('scheduledDate', '>=', now)
        );

        const evalsPromise = needsEvalFallback
          ? getDocs(query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'), limit(200)))
          : Promise.resolve(null);

        const [evalsSnapshot, assignmentsSnapshot] = await Promise.all([
          evalsPromise,
          getDocs(assignmentsQuery)
        ]);

        const allEvaluations = evalsSnapshot
          ? evalsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
          : [];
        const allAssignments = assignmentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        enrichmentData = { allEvaluations, allAssignments };

        // Re-enrich current referees with the loaded data
        setReferees(prev => {
          const enriched = enrichReferees(prev);
          globalRefereesCache = {
            referees: enriched,
            loaded: true,
            timestamp: Date.now(),
          };
          return enriched;
        });
      } catch (error) {
        console.error('Error fetching enrichment data:', error);
      }
    };

    // Hoist unsubscribe into the ref so useEffect cleanup can call it
    unsubscribeRef.current = onSnapshot(q, (querySnapshot) => {
      const refereesList = [];
      querySnapshot.forEach((docSnap) => {
        refereesList.push({ id: docSnap.id, ...docSnap.data() });
      });

      if (!enrichmentTriggered) {
        enrichmentTriggered = true;
        const needsEvalFallback = refereesList.some((r) => typeof r.evaluationsCount !== 'number');
        loadEnrichmentData(needsEvalFallback);
      }

      const refereesWithStats = enrichReferees(refereesList);

      // Update module-level cache
      globalRefereesCache = {
        referees: refereesWithStats,
        loaded: true,
        timestamp: Date.now(),
      };

      setReferees(refereesWithStats);
      setLoading(false);
    });

    // Cleanup: unsubscribe from Firestore listener when component unmounts
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Filter referees based on search
  const filteredReferees = referees.filter((referee) => {
    const matchesSearch =
      (referee.displayName && referee.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (referee.email && referee.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  };

  const renderSortIcon = (columnKey) => {
    if (sortConfig.key === columnKey) {
      return sortConfig.direction === 'asc' ? (
        <HiChevronUp className='w-4 h-4 text-accent inline-block transition-transform shrink-0' />
      ) : (
        <HiChevronDown className='w-4 h-4 text-accent inline-block transition-transform shrink-0' />
      );
    }
    return (
      <HiSelector className='w-4 h-4 text-[#9ca3af]/50 group-hover:text-white inline-block transition-colors shrink-0' />
    );
  };

  // Sort referees based on sortConfig
  const sortedReferees = useMemo(() => {
    const list = [...filteredReferees];
    if (!sortConfig.key) return list;

    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;

    const parseTierNumber = (tier) => {
      if (!tier) return -1;
      const num = parseInt(String(tier).replace(/\D/g, ''), 10);
      return isNaN(num) ? -1 : num;
    };

    return list.sort((a, b) => {
      let comparison = 0;

      switch (key) {
        case 'displayName':
          comparison = (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' });
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '', undefined, { sensitivity: 'base' });
          break;
        case 'tier': {
          const tierA = parseTierNumber(a.tier);
          const tierB = parseTierNumber(b.tier);
          if (tierA !== tierB) {
            comparison = tierA - tierB;
          } else {
            comparison = (a.tier || '').localeCompare(b.tier || '');
          }
          break;
        }
        case 'suggestedTier': {
          const tierA = parseTierNumber(a.suggestedTier);
          const tierB = parseTierNumber(b.suggestedTier);
          if (tierA !== tierB) {
            comparison = tierA - tierB;
          } else {
            comparison = (a.suggestedTier || '').localeCompare(b.suggestedTier || '');
          }
          break;
        }
        case 'location': {
          const locA = a.nextAssignment?.location || '';
          const locB = b.nextAssignment?.location || '';
          if (!locA && !locB) comparison = 0;
          else if (!locA) return 1;
          else if (!locB) return -1;
          else comparison = locA.localeCompare(locB, undefined, { sensitivity: 'base' });
          break;
        }
        case 'gameTime': {
          const timeA = a.nextAssignment?.dateTime ? new Date(a.nextAssignment.dateTime).getTime() : 0;
          const timeB = b.nextAssignment?.dateTime ? new Date(b.nextAssignment.dateTime).getTime() : 0;
          if (!timeA && !timeB) comparison = 0;
          else if (!timeA) return 1;
          else if (!timeB) return -1;
          else comparison = timeA - timeB;
          break;
        }
        case 'avgScore': {
          const scoreA = Number(a.avgScore) || 0;
          const scoreB = Number(b.avgScore) || 0;
          comparison = scoreA - scoreB;
          break;
        }
        case 'evaluations': {
          const countA = Number(a.evaluations) || 0;
          const countB = Number(b.evaluations) || 0;
          comparison = countA - countB;
          break;
        }
        case 'status': {
          const statusA = a.status || 'Active';
          const statusB = b.status || 'Active';
          comparison = statusA.localeCompare(statusB, undefined, { sensitivity: 'base' });
          break;
        }
        default:
          comparison = 0;
      }

      if (comparison === 0 && key !== 'displayName') {
        comparison = (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' });
      }

      return comparison * factor;
    });
  }, [filteredReferees, sortConfig]);

  const handleAddReferee = () => {
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setFormData({
      fullName: '',
      email: '',
      password: '',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitReferee = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      // 1. Create User via Secondary App (to avoid Admin logout)
      const userCredential = await createUser(
        formData.email,
        formData.password
      );

      const uid = userCredential.user.uid;

      // 2. Update Firestore Document with specific dashboard fields
      // Since we are not using the Cloud Function anymore, we MUST set the entire document here
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        displayName: formData.fullName,
        email: formData.email,
        role: 'referee',
        tier: 'Tier 100', // Default tier
        photoURL: '',
        createdAt: serverTimestamp(),
        // Initialize stats fields
        avgScore: 0,
        evaluations: 0,
        evaluationsCount: 0,
        totalScoreSum: 0,
        status: 'Active',
        suggestedTier: '',
      });

      toast.success("Referee added successfully!");
      handleCloseAddModal();
    } catch (error) {
      console.error('Error creating new referee:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Email is already in use.");
      } else {
        toast.error("Failed to add referee: " + error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewReferee = (id) => {
    router.push(`/admin/referees/${id}`);
  };

  const handleEditReferee = (referee, e) => {
    e.stopPropagation();
    setEditingReferee(referee);
    setEditFormData({
      id: referee.id,
      fullName: referee.displayName || '',
      email: referee.email || '',
      tier: normalizeTier(referee.tier) || 'Tier 100',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingReferee(null);
    setEditFormData({
      id: '',
      fullName: '',
      email: '',
      tier: '',
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateReferee = async (e) => {
    e.preventDefault();
    if (!editingReferee) return;
    setActionLoading(true);

    const nextEmail = (editFormData.email || '').trim().toLowerCase();
    const currentEmail = (editingReferee.email || '').trim().toLowerCase();
    const emailChanged =
      editingReferee.status !== 'Disabled' &&
      Boolean(nextEmail) &&
      nextEmail !== currentEmail;

    try {
      if (emailChanged) {
        const updateUserEmailFn = httpsCallable(functions, 'updateUserEmail');
        await updateUserEmailFn({
          uid: editingReferee.id,
          newEmail: nextEmail,
        });
      }

      const refereeRef = doc(db, 'users', editingReferee.id);
      await updateDoc(refereeRef, {
        displayName: editFormData.fullName.trim(),
        tier: editFormData.tier,
      });

      toast.success(
        emailChanged
          ? 'Referee updated! Password is unchanged; they will sign in with the new email.'
          : 'Referee updated successfully!'
      );
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating referee:', error);
      toast.error(error?.message || 'Failed to update referee.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReferee = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this referee? Their account will be removed and disabled, but history is kept.')) {
      try {
        const suspendUserFn = httpsCallable(functions, 'suspendUser');
        await suspendUserFn({ uid: id });
        toast.success('Referee account removed successfully.');
      } catch (error) {
        console.error('Error removing referee:', error);
        toast.error('Failed to remove referee: ' + error.message);
      }
    }
  };

  const getTierColor = (tier) => {
    if (!tier) return 'bg-[#e5e7eb] text-[#374151]';
    switch (tier) {
      case 'Tier 100':
        return 'bg-[#fbbf24] text-[#78350f]';
      case 'Tier 150':
        return 'bg-[#e5e7eb] text-[#374151]';
      case 'Tier 200':
        return 'bg-[#86efac] text-[#166534]';
      case 'Tier 250':
        return 'bg-[#93c5fd] text-[#1e3a8a]';
      default:
        return 'bg-[#e5e7eb] text-[#374151]';
    }
  };

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
      <Toaster />
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className='flex-1 lg:ml-64 overflow-y-auto'>
        {/* Header */}
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-3.5 lg:px-6 lg:py-4 flex items-center gap-4'>
          {/* Hamburger Menu - Mobile Only */}
          <button
            type='button'
            onClick={() => setSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
            aria-label='Open navigation menu'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-2xl lg:text-fluid-3xl font-semibold text-white heading'>
            Master Roster
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-6 pb-20'>
          <div className='max-w-[1400px] mx-auto'>
            {/* Top Bar - Search, Sort and Add Button */}
            <div className='flex flex-col sm:flex-row gap-3 mb-4'>
              {/* Search Input */}
              <div className='flex-1 min-w-0'>
                <input
                  type='text'
                  placeholder='Search by name or email...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label='Search referees by name or email'
                  className='w-full bg-[#2a2a2a] text-white placeholder-[#6b7280] rounded-lg px-3.5 py-2.5 text-sm text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a]'
                />
              </div>

              {/* Compact Sort Control */}
              <div className='flex items-center gap-2'>
                <select
                  aria-label='Sort referees by'
                  value={sortConfig.key}
                  onChange={(e) =>
                    setSortConfig((prev) => ({
                      key: e.target.value,
                      direction: prev.key === e.target.value ? prev.direction : 'asc',
                    }))
                  }
                  className='bg-[#2a2a2a] text-white rounded-lg px-3 py-2.5 text-sm text-body border border-[#3a3a3a] focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                >
                  <option value='displayName'>Sort: Name</option>
                  <option value='tier'>Sort: Current Tier</option>
                  <option value='suggestedTier'>Sort: Suggested Tier</option>
                  <option value='avgScore'>Sort: Avg Score</option>
                  <option value='evaluations'>Sort: # of Evals</option>
                  <option value='gameTime'>Sort: Next Game</option>
                  <option value='status'>Sort: Status</option>
                  <option value='email'>Sort: Email</option>
                </select>
                <button
                  type='button'
                  onClick={() =>
                    setSortConfig((prev) => ({
                      ...prev,
                      direction: prev.direction === 'asc' ? 'desc' : 'asc',
                    }))
                  }
                  aria-label={`Sort direction: ${sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}. Click to toggle.`}
                  title={sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}
                  className='bg-[#2a2a2a] hover:bg-[#333333] text-white rounded-lg p-2.5 border border-[#3a3a3a] transition-colors cursor-pointer'
                >
                  {sortConfig.direction === 'asc' ? (
                    <HiChevronUp className='w-4 h-4 text-accent' />
                  ) : (
                    <HiChevronDown className='w-4 h-4 text-accent' />
                  )}
                </button>
              </div>

              {/* Add Referee Button */}
              <button
                type='button'
                onClick={handleAddReferee}
                className='flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-white px-4 py-2.5 rounded-lg font-semibold transition-all active:scale-[0.98] text-sm whitespace-nowrap cursor-pointer'
              >
                <HiPlus className='w-4 h-4' />
                Add Referee
              </button>
            </div>

            {/* Compact KPI Summary Strip */}
            <div className='bg-accent rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-3'>
              <div className='flex items-baseline gap-3'>
                <span className='text-xs uppercase tracking-wider text-white/85 font-medium'>
                  Total Referees
                </span>
                <span className='text-2xl lg:text-3xl font-bold text-white heading leading-tight tabular-nums'>
                  {referees.length}
                </span>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='bg-black/15 px-3 py-1.5 rounded-xl text-xs font-medium text-white/95 tabular-nums'>
                  Active: {referees.filter((r) => r.status !== 'Disabled').length}
                </span>
                <span className='bg-black/15 px-3 py-1.5 rounded-xl text-xs font-medium text-white/95 tabular-nums'>
                  Scheduled: {referees.filter((r) => Boolean(r.nextAssignment)).length}
                </span>
                {searchQuery.trim() && (
                  <span className='bg-black/25 px-3 py-1.5 rounded-xl text-xs font-semibold text-white tabular-nums'>
                    Matching: {filteredReferees.length}
                  </span>
                )}
              </div>
            </div>

            {/* Referees Table */}
            <div className='bg-[#2a2a2a] rounded-[20px] overflow-hidden border border-[#3a3a3a]'>
              <div
                tabIndex={0}
                role='region'
                aria-labelledby='master-roster-caption'
                className='responsive-table-wrapper table-scrollbar'
              >
                <table
                  className='responsive-data-table'
                  style={{
                    '--col-2': '"Tier"',
                    '--col-3': '"Avg Score"',
                    '--col-4': '"Next Game"',
                    '--col-5': '"Status"',
                    '--col-6': '"Actions"',
                  }}
                >
                  <caption id='master-roster-caption' className='sr-only'>
                    Master Roster of Referees
                  </caption>
                  <colgroup>
                    <col style={{ width: '31%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '9%' }} />
                  </colgroup>
                  <thead>
                    <tr className='bg-[#202020] border-b-2 border-accent/80'>
                      <th
                        scope='col'
                        onClick={() => handleSort('displayName')}
                        className='text-left py-3 px-3 lg:px-4 text-xs font-bold text-[#e5e7eb] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Referee Name'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>REFEREE</span>
                          {renderSortIcon('displayName')}
                        </div>
                      </th>
                      <th
                        scope='col'
                        onClick={() => handleSort('tier')}
                        className='text-left py-3 px-3 lg:px-4 text-xs font-bold text-[#e5e7eb] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Current Tier'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>TIER</span>
                          {renderSortIcon('tier')}
                        </div>
                      </th>
                      <th
                        scope='col'
                        onClick={() => handleSort('avgScore')}
                        className='text-left py-3 px-3 lg:px-4 text-xs font-bold text-[#e5e7eb] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Average Score'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>AVG SCORE</span>
                          {renderSortIcon('avgScore')}
                        </div>
                      </th>
                      <th
                        scope='col'
                        onClick={() => handleSort('gameTime')}
                        className='text-left py-3 px-3 lg:px-4 text-xs font-bold text-[#e5e7eb] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Next Game Time'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>NEXT GAME</span>
                          {renderSortIcon('gameTime')}
                        </div>
                      </th>
                      <th
                        scope='col'
                        onClick={() => handleSort('status')}
                        className='text-left py-3 px-3 lg:px-4 text-xs font-bold text-[#e5e7eb] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-white/5 transition-colors group'
                        title='Sort by Status'
                      >
                        <div className='flex items-center gap-1.5'>
                          <span>STATUS</span>
                          {renderSortIcon('status')}
                        </div>
                      </th>
                      <th
                        scope='col'
                        className='text-right py-3 px-3 lg:px-4 text-xs font-bold text-[#e5e7eb] uppercase tracking-wider whitespace-nowrap'
                      >
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr className='table-empty-row'>
                        <td colSpan={6} className='text-center py-12'>
                          <p className='text-sm text-[#9ca3af] text-body'>
                            Loading referees...
                          </p>
                        </td>
                      </tr>
                    ) : sortedReferees.length > 0 ? (
                      sortedReferees.map((referee) => (
                        <tr
                          key={referee.id}
                          onClick={() => handleViewReferee(referee.id)}
                          className={`border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer ${referee.status === 'Disabled' ? 'opacity-50 grayscale' : ''}`}
                        >
                          <th
                            scope='row'
                            className='py-3 px-3 lg:px-4 text-left font-normal align-middle min-w-0'
                          >
                            <div
                              className='text-sm font-semibold text-white text-body truncate'
                              title={referee.displayName}
                            >
                              {referee.displayName}
                            </div>
                            <div
                              className='text-xs text-[#9ca3af] text-body truncate mt-0.5'
                              title={referee.email}
                            >
                              {referee.email}
                            </div>
                          </th>
                          <td className='py-3 px-3 lg:px-4 align-middle'>
                            <div className='flex flex-col items-end md:items-start'>
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${getTierColor(
                                  referee.tier
                                )}`}
                              >
                                {referee.tier || 'N/A'}
                              </span>
                              {referee.suggestedTier && referee.suggestedTier !== 'N/A' && (() => {
                                const tierChanged =
                                  normalizeTier(referee.suggestedTier) !== normalizeTier(referee.tier);
                                return (
                                  <span
                                    title={`Recommended: ${referee.suggestedTier}`}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                                      tierChanged
                                        ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                                        : 'bg-white/5 text-[#d1d5db] border-white/15'
                                    }`}
                                  >
                                    {tierChanged ? `→ ${referee.suggestedTier}` : `Rec: ${referee.suggestedTier}`}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className='py-3 px-3 lg:px-4 align-middle'>
                            <div className='flex flex-col items-end md:items-start'>
                              <span className='text-sm font-semibold text-white tabular-nums whitespace-nowrap'>
                                {referee.evaluations > 0 ? referee.avgScore : '—'}
                              </span>
                              <span className='text-xs text-[#9ca3af] tabular-nums whitespace-nowrap mt-0.5'>
                                {referee.evaluations || 0}{' '}
                                {referee.evaluations === 1 ? 'eval' : 'evals'}
                              </span>
                            </div>
                          </td>
                          <td className='py-3 px-3 lg:px-4 align-middle min-w-0'>
                            {referee.nextAssignment ? (
                              <div className='min-w-0 max-w-full flex flex-col items-end md:items-start'>
                                <div
                                  className='text-sm font-medium text-white text-body truncate max-w-full'
                                  title={referee.nextAssignment.location}
                                >
                                  {referee.nextAssignment.location}
                                </div>
                                {referee.nextAssignment.dateTime && (
                                  <div className='text-xs text-[#9ca3af] whitespace-nowrap mt-0.5'>
                                    {new Date(
                                      referee.nextAssignment.dateTime
                                    ).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                    •{' '}
                                    {new Date(
                                      referee.nextAssignment.dateTime
                                    ).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className='text-xs text-[#6b7280] italic'>
                                Unscheduled
                              </span>
                            )}
                          </td>
                          <td className='py-3 px-3 lg:px-4 align-middle'>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${
                                referee.status === 'Disabled'
                                  ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {referee.status || 'Active'}
                            </span>
                          </td>
                          <td className='py-3 px-3 lg:px-4 align-middle text-right'>
                            <div className='flex items-center justify-end gap-1.5'>
                              <button
                                type='button'
                                onClick={(e) =>
                                  handleEditReferee(referee, e)
                                }
                                className='p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed'
                                title='Edit'
                                aria-label={`Edit ${referee.displayName}`}
                                disabled={referee.status === 'Disabled'}
                              >
                                <HiPencil className={`w-4 h-4 lg:w-5 lg:h-5 ${referee.status === 'Disabled' ? 'text-gray-500' : 'text-[#22c55e]'}`} />
                              </button>
                              <button
                                type='button'
                                onClick={(e) =>
                                  handleDeleteReferee(referee.id, e)
                                }
                                className='p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed'
                                title='Delete'
                                aria-label={`Remove ${referee.displayName}`}
                                disabled={referee.status === 'Disabled'}
                              >
                                <HiTrash className={`w-4 h-4 lg:w-5 lg:h-5 ${referee.status === 'Disabled' ? 'text-gray-500' : 'text-[#ef4444]'}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className='table-empty-row'>
                        <td colSpan={6} className='text-center py-12'>
                          <p className='text-sm text-[#9ca3af] text-body'>
                            {searchQuery.trim()
                              ? 'No referees found matching your search.'
                              : 'No referees found.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className='px-4 py-3 border-t border-[#3a3a3a]'>
                <p className='text-xs sm:text-sm text-[#9ca3af] text-body text-center tabular-nums'>
                  Showing {filteredReferees.length} of {referees.length}{' '}
                  officials
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Referee Modal */}
      {showAddModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Overlay */}
          <div
            className='absolute inset-0 bg-black/70'
            onClick={handleCloseAddModal}
          ></div>

          {/* Modal */}
          <div className='relative bg-[#2a2a2a] rounded-[20px] w-full max-w-lg overflow-hidden z-10 border border-[#3a3a3a]'>
            {/* Header */}
            <div className='bg-accent px-6 py-5 flex items-center justify-between'>
              <h2 className='text-fluid-2xl font-semibold text-white heading'>
                Add New Referee
              </h2>
              <button
                onClick={handleCloseAddModal}
                className='text-white hover:opacity-80 transition-opacity'
              >
                <HiX className='w-6 h-6' />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitReferee} className='p-6'>
              {/* Full Name */}
              <div className='mb-5'>
                <label className='block text-white text-fluid-base text-body mb-2'>
                  Full Name
                </label>
                <input
                  type='text'
                  name='fullName'
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder='John Doe'
                  required
                  className='w-full bg-[#3a3a3a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#4a4a4a]'
                />
              </div>

              {/* Email Address */}
              <div className='mb-5'>
                <label className='block text-white text-fluid-base text-body mb-2'>
                  Email Address
                </label>
                <input
                  type='email'
                  name='email'
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder='john.doe@ntboa.com'
                  required
                  className='w-full bg-[#3a3a3a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#4a4a4a]'
                />
              </div>

              {/* Temporary Password */}
              <div className='mb-6'>
                <label className='block text-white text-fluid-base text-body mb-2'>
                  Temporary Password
                </label>
                <input
                  type='password'
                  name='password'
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder='••••••••••'
                  required
                  className='w-full bg-[#3a3a3a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#4a4a4a]'
                />
              </div>

              {/* Buttons */}
              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={handleCloseAddModal}
                  disabled={actionLoading}
                  className='flex-1 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white px-6 py-3 rounded-lg font-medium transition-all text-fluid-base text-body border border-[#4a4a4a]'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={actionLoading}
                  className='flex-1 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all active:scale-[0.98] text-fluid-base flex justify-center items-center'
                >
                  {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Add Referee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Referee Modal */}
      {showEditModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Overlay */}
          <div
            className='absolute inset-0 bg-black/70'
            onClick={handleCloseEditModal}
          ></div>

          {/* Modal */}
          <div className='relative bg-[#2a2a2a] rounded-[20px] w-full max-w-lg overflow-hidden z-10 border border-[#3a3a3a]'>
            {/* Header */}
            <div className='bg-accent px-6 py-5 flex items-center justify-between'>
              <h2 className='text-fluid-2xl font-semibold text-white heading'>
                Edit Referee
              </h2>
              <button
                onClick={handleCloseEditModal}
                className='text-white hover:opacity-80 transition-opacity'
              >
                <HiX className='w-6 h-6' />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateReferee} className='p-6'>
              {/* Full Name */}
              <div className='mb-5'>
                <label className='block text-white text-fluid-base text-body mb-2'>
                  Full Name
                </label>
                <input
                  type='text'
                  name='fullName'
                  value={editFormData.fullName}
                  onChange={handleEditInputChange}
                  placeholder='John Doe'
                  required
                  className='w-full bg-[#3a3a3a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#4a4a4a]'
                />
              </div>

              {/* Email Address */}
              <div className='mb-5'>
                <label className='block text-white text-fluid-base text-body mb-2'>
                  Email Address
                </label>
                <input
                  type='email'
                  name='email'
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  placeholder='referee@example.com'
                  required
                  disabled={editingReferee?.status === 'Disabled'}
                  className='w-full bg-[#3a3a3a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#4a4a4a] disabled:opacity-50 disabled:cursor-not-allowed'
                />
                <p className='text-xs text-[#9ca3af] mt-1.5'>
                  {editingReferee?.status === 'Disabled'
                    ? 'Email cannot be changed for a disabled account.'
                    : "The user's password stays the same, and they'll be asked to sign in again with the new email."}
                </p>
              </div>

              {/* Tier */}
              <div className='mb-6'>
                <label className='block text-white text-fluid-base text-body mb-2'>
                  Tier
                </label>
                <select
                  name='tier'
                  value={editFormData.tier}
                  onChange={handleEditInputChange}
                  className='w-full bg-[#3a3a3a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#4a4a4a]'
                >
                  {TIER_DATA.map((t) => (
                    <option key={t.tier} value={`Tier ${t.tier}`}>
                      Tier {t.tier}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={handleCloseEditModal}
                  disabled={actionLoading}
                  className='flex-1 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white px-6 py-3 rounded-lg font-medium transition-all text-fluid-base text-body border border-[#4a4a4a]'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={actionLoading}
                  className='flex-1 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all active:scale-[0.98] text-fluid-base flex justify-center items-center'
                >
                  {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Referee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefereesPage;
