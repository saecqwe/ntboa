'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUser } from '@/features/authentication/services/authService';
import { db, functions } from '@/services/firebase/config';
import { httpsCallable } from 'firebase/functions';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { HiPlus, HiTrash, HiX, HiSearch, HiChevronUp, HiChevronDown } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';
import { normalizeTier } from '@/lib/evaluationUtils';

const getRefereeStats = (referee) => {
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

  return { evalCount, avgScore };
};

const EvaluatorRefereesPage = () => {
  const { user, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'displayName', direction: 'asc' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [referees, setReferees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  // --- Real-time listener for all referees ---
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'referee'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        // Sort: Active first, then Disabled
        list.sort((a, b) => {
          if (a.status === 'Disabled' && b.status !== 'Disabled') return 1;
          if (a.status !== 'Disabled' && b.status === 'Disabled') return -1;
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
        setReferees(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching referees:', error);
        toast.error('Failed to load referees.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // --- Filtered & sorted list ---
  const filteredReferees = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return referees.filter(
      (ref) =>
        (ref.displayName && ref.displayName.toLowerCase().includes(q)) ||
        (ref.email && ref.email.toLowerCase().includes(q))
    );
  }, [referees, searchQuery]);

  const sortedReferees = useMemo(() => {
    const list = [...filteredReferees];
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
        case 'tier': {
          const tierA = parseTierNumber(a.tier);
          const tierB = parseTierNumber(b.tier);
          comparison =
            tierA !== tierB
              ? tierA - tierB
              : (a.tier || '').localeCompare(b.tier || '');
          break;
        }
        case 'avgScore':
          comparison = getRefereeStats(a).avgScore - getRefereeStats(b).avgScore;
          break;
        case 'status':
          comparison = (a.status || 'Active').localeCompare(b.status || 'Active', undefined, {
            sensitivity: 'base',
          });
          break;
        case 'displayName':
        default:
          comparison = (a.displayName || '').localeCompare(b.displayName || '', undefined, {
            sensitivity: 'base',
          });
          break;
      }

      if (comparison === 0 && key !== 'displayName') {
        comparison = (a.displayName || '').localeCompare(b.displayName || '', undefined, {
          sensitivity: 'base',
        });
      }

      return comparison * factor;
    });
  }, [filteredReferees, sortConfig]);

  const activeCount = referees.filter((r) => r.status !== 'Disabled').length;

  // --- Add Referee ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setFormData({ fullName: '', email: '', password: '' });
  };

  const handleSubmitReferee = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      // Create Auth user via secondary app (avoids logging out the evaluator)
      const userCredential = await createUser(formData.email, formData.password);
      const uid = userCredential.user.uid;

      // Create Firestore document
      await setDoc(doc(db, 'users', uid), {
        uid,
        displayName: formData.fullName,
        email: formData.email,
        role: 'referee',
        tier: 'Tier 100',
        photoURL: '',
        createdAt: serverTimestamp(),
        avgScore: 0,
        evaluations: 0,
        evaluationsCount: 0,
        totalScoreSum: 0,
        status: 'Active',
        suggestedTier: '',
      });

      toast.success(`Referee "${formData.fullName}" added successfully!`);
      handleCloseAddModal();
    } catch (error) {
      console.error('Error creating referee:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('A referee with this email already exists.');
      } else {
        toast.error('Failed to add referee: ' + error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // --- Remove / Suspend Referee ---
  const handleRemoveReferee = async (referee, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to remove "${referee.displayName}"? Their account will be removed and disabled, but evaluation history is kept.`
      )
    )
      return;

    try {
      const suspendUserFn = httpsCallable(functions, 'suspendUser');
      await suspendUserFn({ uid: referee.id });
      toast.success(`"${referee.displayName}" has been removed.`);
    } catch (error) {
      console.error('Error removing referee:', error);
      toast.error('Failed to remove referee: ' + error.message);
    }
  };

  // --- Tier badge color ---
  const getTierColor = (tier) => {
    switch (tier) {
      case 'Tier 100': return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
      case 'Tier 150': return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
      case 'Tier 200': return 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30';
      case 'Tier 250': return 'bg-blue-400/20 text-blue-300 border-blue-400/30';
      default:         return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
    }
  };

  return (
    <div className='min-h-screen bg-[#181818] flex flex-col bg-gradient-secondary'>
      <Toaster position='top-right' />

      {/* Header */}
      <EvaluatorHeader showBackButton={true} />

      <div className='bg-gradient-primary rounded-tl-[60px] overflow-hidden flex-1 lg:rounded-tl-[80px]'>
        <main className='px-5 py-6 lg:px-8 lg:py-8 pb-20'>
          <div className='max-w-5xl mx-auto'>

            {/* Page Title */}
            <div className='mb-5'>
              <h2 className='text-2xl lg:text-3xl font-bold text-white heading leading-none mb-1.5'>
                Referee Roster
              </h2>
              <p className='text-white/60 text-sm'>
                Manage all referees in the system
              </p>
            </div>

            {/* Compact KPI Strip */}
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
                  Active: {activeCount}
                </span>
                {searchQuery.trim() && (
                  <span className='bg-black/25 px-3 py-1.5 rounded-xl text-xs font-semibold text-white tabular-nums'>
                    Matching: {filteredReferees.length}
                  </span>
                )}
              </div>
            </div>

            {/* Search + Sort + Add Button */}
            <div className='flex flex-col sm:flex-row gap-3 mb-5'>
              <div className='relative flex-1 min-w-0'>
                <HiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4' />
                <input
                  type='text'
                  placeholder='Search by name or email...'
                  aria-label='Search referees by name or email'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-white/10 text-white placeholder-white/40 rounded-xl pl-10 pr-4 py-2.5 text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                />
              </div>
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
                  className='bg-white/10 text-white rounded-xl px-3 py-2.5 text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                >
                  <option value='displayName' className='bg-[#1e1e1e]'>Sort: Name</option>
                  <option value='tier' className='bg-[#1e1e1e]'>Sort: Current Tier</option>
                  <option value='avgScore' className='bg-[#1e1e1e]'>Sort: Avg Score</option>
                  <option value='status' className='bg-[#1e1e1e]'>Sort: Status</option>
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
                  className='bg-white/10 hover:bg-white/15 text-white rounded-xl p-2.5 border border-white/10 transition-colors cursor-pointer'
                >
                  {sortConfig.direction === 'asc' ? (
                    <HiChevronUp className='w-4 h-4 text-accent' />
                  ) : (
                    <HiChevronDown className='w-4 h-4 text-accent' />
                  )}
                </button>
              </div>
              <button
                type='button'
                onClick={() => setShowAddModal(true)}
                className='flex items-center justify-center gap-2 bg-accent hover:opacity-90 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap cursor-pointer'
              >
                <HiPlus className='w-4 h-4' />
                Add Referee
              </button>
            </div>

            {/* Referees List */}
            {loading ? (
              <div className='text-center py-16 text-white/40'>
                <div className='w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3' />
                Loading referees...
              </div>
            ) : sortedReferees.length === 0 ? (
              <div className='text-center py-16 text-white/40 bg-white/5 rounded-[20px] border border-white/10'>
                {searchQuery ? 'No referees match your search.' : 'No referees found.'}
              </div>
            ) : (
              <div className='space-y-2.5'>
                {sortedReferees.map((referee) => {
                  const isDisabled = referee.status === 'Disabled';
                  const { evalCount, avgScore } = getRefereeStats(referee);
                  const hasRecommended = Boolean(referee.suggestedTier && referee.suggestedTier !== 'N/A');
                  const tierChanged =
                    hasRecommended &&
                    normalizeTier(referee.suggestedTier) !== normalizeTier(referee.tier);

                  const recommendedPill = hasRecommended ? (
                    <span
                      title={`Recommended: ${referee.suggestedTier}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                        tierChanged
                          ? 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                          : 'bg-white/5 text-[#d1d5db] border-white/15'
                      }`}
                    >
                      {tierChanged ? `→ ${referee.suggestedTier}` : `Rec: ${referee.suggestedTier}`}
                    </span>
                  ) : null;

                  return (
                    <div
                      key={referee.id}
                      className={`bg-white/6 rounded-2xl px-4 py-3.5 border transition-all ${
                        isDisabled
                          ? 'border-red-500/20 opacity-50 grayscale'
                          : 'border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className='flex items-center justify-between gap-4'>
                        {/* Left – Avatar + Info */}
                        <div className='flex items-center gap-3.5 flex-1 min-w-0'>
                          <div className='w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-xs shrink-0'>
                            {referee.displayName
                              ? referee.displayName
                                  .trim()
                                  .split(' ')
                                  .map((n) => n.charAt(0).toUpperCase())
                                  .join('')
                                  .slice(0, 2)
                              : 'RF'}
                          </div>
                          <div className='min-w-0'>
                            <div
                              className='text-white font-semibold text-sm sm:text-[15px] heading truncate'
                              title={referee.displayName || 'Unnamed Referee'}
                            >
                              {referee.displayName || 'Unnamed Referee'}
                            </div>
                            <div
                              className='text-white/55 text-xs truncate'
                              title={referee.email}
                            >
                              {referee.email}
                            </div>
                          </div>
                        </div>

                        {/* Middle – Tier, Recommended, Avg Score & Status */}
                        <div className='hidden sm:flex items-center gap-3 shrink-0'>
                          <div className='text-right mr-1'>
                            <div className='text-xs font-semibold text-white tabular-nums'>
                              {evalCount > 0 ? `${avgScore} avg` : '—'}
                            </div>
                            <div className='text-[11px] text-white/50 tabular-nums'>
                              {evalCount} {evalCount === 1 ? 'eval' : 'evals'}
                            </div>
                          </div>
                          <div className='flex items-center gap-1.5'>
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${getTierColor(
                                referee.tier
                              )}`}
                            >
                              {referee.tier || 'N/A'}
                            </span>
                            {recommendedPill}
                          </div>
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
                              isDisabled
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isDisabled ? 'Disabled' : 'Active'}
                          </span>
                        </div>

                        {/* Right – Remove Button */}
                        {!isDisabled && (
                          <button
                            type='button'
                            onClick={(e) => handleRemoveReferee(referee, e)}
                            aria-label={`Remove ${referee.displayName}`}
                            className='shrink-0 w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 flex items-center justify-center transition-all cursor-pointer'
                            title='Remove Referee'
                          >
                            <HiTrash className='w-4 h-4 text-red-400' />
                          </button>
                        )}
                      </div>

                      {/* Mobile – Tier, Recommended, Avg Score & Status row */}
                      <div className='sm:hidden flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-white/10'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getTierColor(
                              referee.tier
                            )}`}
                          >
                            {referee.tier || 'N/A'}
                          </span>
                          {recommendedPill}
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              isDisabled
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isDisabled ? 'Disabled' : 'Active'}
                          </span>
                        </div>
                        <span className='text-[11px] text-white/65 font-medium tabular-nums'>
                          {evalCount > 0 ? `${avgScore} avg · ` : ''}
                          {evalCount} {evalCount === 1 ? 'eval' : 'evals'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Showing count */}
            {!loading && sortedReferees.length > 0 && (
              <p className='text-center text-white/45 text-xs sm:text-sm mt-5 tabular-nums'>
                Showing {sortedReferees.length} of {referees.length} referees
              </p>
            )}
          </div>
        </main>
      </div>

      {/* ── Add Referee Modal ── */}
      {showAddModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <div
            className='absolute inset-0 bg-black/70 backdrop-blur-sm'
            onClick={handleCloseAddModal}
          />
          <div className='relative bg-[#1e1e1e] rounded-[24px] w-full max-w-md overflow-hidden z-10 border border-white/10 shadow-2xl'>
            {/* Modal Header */}
            <div className='bg-accent px-6 py-5 flex items-center justify-between'>
              <h2 className='text-[20px] font-bold text-white heading'>Add New Referee</h2>
              <button
                onClick={handleCloseAddModal}
                className='text-white hover:opacity-70 transition-opacity'
              >
                <HiX className='w-6 h-6' />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitReferee} className='p-6 space-y-4'>
              <div>
                <label className='block text-white/80 text-[14px] mb-2 font-medium'>
                  Full Name
                </label>
                <input
                  type='text'
                  name='fullName'
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder='e.g. John Smith'
                  required
                  className='w-full bg-white/8 text-white placeholder-white/30 rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                />
              </div>

              <div>
                <label className='block text-white/80 text-[14px] mb-2 font-medium'>
                  Email Address
                </label>
                <input
                  type='email'
                  name='email'
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder='john@example.com'
                  required
                  className='w-full bg-white/8 text-white placeholder-white/30 rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                />
              </div>

              <div>
                <label className='block text-white/80 text-[14px] mb-2 font-medium'>
                  Temporary Password
                </label>
                <input
                  type='password'
                  name='password'
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder='Min. 6 characters'
                  required
                  minLength={6}
                  className='w-full bg-white/8 text-white placeholder-white/30 rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                />
              </div>

              <div className='flex gap-3 pt-2'>
                <button
                  type='button'
                  onClick={handleCloseAddModal}
                  disabled={actionLoading}
                  className='flex-1 bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-xl font-medium transition-all border border-white/10'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={actionLoading}
                  className='flex-1 bg-accent hover:opacity-90 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] flex justify-center items-center'
                >
                  {actionLoading ? (
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  ) : (
                    'Add Referee'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluatorRefereesPage;
