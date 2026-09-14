'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { createUser } from '@/features/authentication/services/authService';
import { db, functions } from '@/services/firebase/config';
import { httpsCallable } from 'firebase/functions';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { HiPlus, HiTrash, HiX, HiSearch } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';

const EvaluatorRefereesPage = () => {
  const { user, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
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

  // --- Filtered list ---
  const filteredReferees = referees.filter((ref) => {
    const q = searchQuery.toLowerCase();
    return (
      (ref.displayName && ref.displayName.toLowerCase().includes(q)) ||
      (ref.email && ref.email.toLowerCase().includes(q))
    );
  });

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
        <main className='px-6 py-8 lg:px-8 lg:py-12'>
          <div className='max-w-5xl mx-auto'>

            {/* Page Title */}
            <div className='mb-8'>
              <h2 className='text-[32px] lg:text-[38px] font-bold text-white heading leading-none mb-2'>
                Referee Roster
              </h2>
              <p className='text-white/60 text-[15px]'>
                Manage all referees in the system
              </p>
            </div>

            {/* Stats Banner */}
            <div className='grid grid-cols-2 gap-4 mb-8'>
              <div className='bg-white/10 rounded-[20px] px-5 py-4 border border-white/10'>
                <div className='text-white/60 text-[13px] mb-1'>Total Referees</div>
                <div className='text-[32px] font-bold text-white heading'>{referees.length}</div>
              </div>
              <div className='bg-white/10 rounded-[20px] px-5 py-4 border border-white/10'>
                <div className='text-white/60 text-[13px] mb-1'>Active</div>
                <div className='text-[32px] font-bold text-emerald-400 heading'>{activeCount}</div>
              </div>
            </div>

            {/* Search + Add Button */}
            <div className='flex flex-col sm:flex-row gap-3 mb-6'>
              <div className='relative flex-1'>
                <HiSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5' />
                <input
                  type='text'
                  placeholder='Search by name or email...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-white/10 text-white placeholder-white/40 rounded-xl pl-11 pr-4 py-3 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all'
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className='flex items-center justify-center gap-2 bg-accent hover:opacity-90 active:scale-[0.98] text-white px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap'
              >
                <HiPlus className='w-5 h-5' />
                Add Referee
              </button>
            </div>

            {/* Referees List */}
            {loading ? (
              <div className='text-center py-16 text-white/40'>
                <div className='w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3' />
                Loading referees...
              </div>
            ) : filteredReferees.length === 0 ? (
              <div className='text-center py-16 text-white/40 bg-white/5 rounded-[20px] border border-white/10'>
                {searchQuery ? 'No referees match your search.' : 'No referees found.'}
              </div>
            ) : (
              <div className='space-y-3'>
                {filteredReferees.map((referee) => {
                  const isDisabled = referee.status === 'Disabled';
                  return (
                    <div
                      key={referee.id}
                      className={`bg-white/6 rounded-[20px] px-5 py-4 border transition-all ${
                        isDisabled
                          ? 'border-red-500/20 opacity-50 grayscale'
                          : 'border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className='flex items-center justify-between gap-4'>
                        {/* Left – Avatar + Info */}
                        <div className='flex items-center gap-4 flex-1 min-w-0'>
                          <div className='w-11 h-11 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm shrink-0'>
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
                            <div className='text-white font-semibold text-[15px] heading truncate'>
                              {referee.displayName || 'Unnamed Referee'}
                            </div>
                            <div className='text-white/50 text-[13px] truncate'>
                              {referee.email}
                            </div>
                          </div>
                        </div>

                        {/* Middle – Tier + Status */}
                        <div className='hidden sm:flex items-center gap-3'>
                          <span
                            className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${getTierColor(
                              referee.tier
                            )}`}
                          >
                            {referee.tier || 'N/A'}
                          </span>
                          <span
                            className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${
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
                            onClick={(e) => handleRemoveReferee(referee, e)}
                            className='shrink-0 w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 flex items-center justify-center transition-all'
                            title='Remove Referee'
                          >
                            <HiTrash className='w-4 h-4 text-red-400' />
                          </button>
                        )}
                      </div>

                      {/* Mobile – Tier + Status row */}
                      <div className='sm:hidden flex items-center gap-2 mt-3 pt-3 border-t border-white/10'>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getTierColor(
                            referee.tier
                          )}`}
                        >
                          {referee.tier || 'N/A'}
                        </span>
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
                    </div>
                  );
                })}
              </div>
            )}

            {/* Showing count */}
            {!loading && filteredReferees.length > 0 && (
              <p className='text-center text-white/40 text-[13px] mt-6'>
                Showing {filteredReferees.length} of {referees.length} referees
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
