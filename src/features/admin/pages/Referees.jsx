'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, getDocs, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createUser } from '@/features/authentication/services/authService';
import { db, functions } from '@/services/firebase/config';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiPlus, HiPencil, HiTrash, HiX } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';

const RefereesPage = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [editFormData, setEditFormData] = useState({
    id: '',
    fullName: '',
    tier: '',
  });
  const [editingReferee, setEditingReferee] = useState(null);
  const [referees, setReferees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchRefereesAndEvaluations = async () => {
      try {
        // 1. Fetch Referees (real-time listener)
        const q = query(collection(db, 'users'), where('role', '==', 'referee'));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
          const refereesList = [];
          querySnapshot.forEach((doc) => {
            refereesList.push({ id: doc.id, ...doc.data() });
          });

          // 2. Fetch All Evaluations (to aggregate stats)
          const evalsQuery = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'));
          const evalsSnapshot = await getDocs(evalsQuery);
          const allEvaluations = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // 3. Fetch All Assignments (to find next game)
          // We fetch all to avoid N+1 queries. In a huge app, we'd paginate or use cloud functions.
          const assignmentsSnapshot = await getDocs(collection(db, 'assignments'));
          const allAssignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const now = new Date();

          // 4. Merge Stats & Next Game
          const refereesWithStats = refereesList.map(referee => {
            const refereeEvals = allEvaluations.filter(e => e.refereeId === referee.id);

            const evalCount = refereeEvals.length;
            const totalScore = refereeEvals.reduce((acc, curr) => acc + (curr.totalScore || 0), 0);
            const avgScore = evalCount > 0 ? (totalScore / evalCount).toFixed(1) : 0;

            // Get suggested tier: Prioritize the User Profile field (updated on submission), fallback to latest eval
            const latestEval = refereeEvals[0];
            const suggestedTier = referee.suggestedTier || latestEval?.tier || 'N/A';

            // Find Next Assignment
            const myAssignments = allAssignments.filter(a =>
              a.refereeIds && a.refereeIds.includes(referee.id)
            );

            const futureAssignments = myAssignments
              .map(a => ({
                ...a,
                dateObj: a.scheduledDate?.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate)
              }))
              .filter(a => a.dateObj > now)
              .sort((a, b) => a.dateObj - b.dateObj);

            const nextGame = futureAssignments[0];
            const nextAssignmentData = nextGame ? {
              location: nextGame.location,
              game: 'Scheduled Match', // Or use specific game/team names if available in assignment
              dateTime: nextGame.dateObj.toISOString()
            } : null;

            return {
              ...referee,
              evaluations: evalCount,
              avgScore: avgScore,
              suggestedTier: suggestedTier,
              nextAssignment: nextAssignmentData
            };
          });

          setReferees(refereesWithStats);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data.");
        setLoading(false);
      }
    };

    fetchRefereesAndEvaluations();
  }, []);

  // Filter referees based on search
  const filteredReferees = referees.filter((referee) => {
    const matchesSearch =
      (referee.displayName && referee.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (referee.email && referee.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

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
      tier: referee.tier || 'Tier 100',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingReferee(null);
    setEditFormData({
      id: '',
      fullName: '',
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

    try {
      const refereeRef = doc(db, 'users', editingReferee.id);
      await updateDoc(refereeRef, {
        displayName: editFormData.fullName,
        tier: editFormData.tier,
      });
      toast.success("Referee updated successfully!");
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating referee:', error);
      toast.error("Failed to update referee.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReferee = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this referee? This will disable their account but keep their history.')) {
      try {
        const suspendUser = httpsCallable(functions, 'suspendUser');
        await suspendUser({ uid: id });
        toast.success("Referee account suspended/deleted.");
      } catch (error) {
        console.error('Error suspending referee:', error);
        toast.error("Failed to suspend referee.");
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
        <header className='bg-[#2a2a2a] border-b border-[#3a3a3a] px-4 py-4 lg:px-8 lg:py-6 flex items-center gap-4'>
          <BackButton variant='solid' className='shrink-0' />
          {/* Hamburger Menu - Mobile Only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className='lg:hidden text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
          >
            <HiMenu className='w-6 h-6' />
          </button>

          <h1 className='text-fluid-3xl font-semibold text-white heading'>
            Master Roster
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            {/* Top Bar - Search and Add Button */}
            <div className='flex flex-col sm:flex-row gap-4 mb-6'>
              {/* Search Input */}
              <div className='flex-1'>
                <input
                  type='text'
                  placeholder='Search'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full bg-[#2a2a2a] text-white placeholder-[#6b7280] rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a]'
                />
              </div>

              {/* Add Referee Button */}
              <button
                onClick={handleAddReferee}
                className='flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all active:scale-[0.98] text-fluid-base whitespace-nowrap'
              >
                <HiPlus className='w-5 h-5' />
                Add Referee
              </button>
            </div>

            {/* Total Referees Banner */}
            <div className='bg-accent rounded-[20px] px-6 py-5 mb-6'>
              <div className='text-[14px] text-white/90 text-body mb-1'>
                Total Referees
              </div>
              <div className='text-fluid-4xl font-bold text-white heading'>
                {referees.length}
              </div>
            </div>

            {/* Referees Table */}
            <div className='bg-[#2a2a2a] rounded-[20px] overflow-hidden border border-[#3a3a3a]'>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-accent'>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        REFEREE NAME
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        EMAIL
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        CURRENT TIER
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        SUGGESTED TIER
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        NEXT LOCATION
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        NEXT GAME TIME
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        AVERAGE SCORE
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        # OF EVALUATIONS
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        STATUS
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan='10' className='text-center py-12'>
                          <p className='text-[15px] text-[#6b7280] text-body'>
                            Loading referees...
                          </p>
                        </td>
                      </tr>
                    ) : filteredReferees.length > 0 ? (
                      filteredReferees.map((referee) => (
                        <tr
                          key={referee.id}
                          onClick={() => handleViewReferee(referee.id)}
                          className={`border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors cursor-pointer ${referee.status === 'Disabled' ? 'opacity-50 grayscale' : ''}`}
                        >
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {referee.displayName}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {referee.email}
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <span
                              className={`inline-block px-4 py-1.5 rounded-full text-fluid-sm font-semibold whitespace-nowrap ${getTierColor(
                                referee.tier
                              )}`}
                            >
                              {referee.tier || 'N/A'}
                            </span>
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <span
                              className={`inline-block px-4 py-1.5 rounded-full text-fluid-sm font-semibold whitespace-nowrap ${getTierColor(
                                referee.suggestedTier
                              )}`}
                            >
                              {referee.suggestedTier || 'N/A'}
                            </span>
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {referee.nextAssignment ? (
                              <div>
                                <div className='font-semibold'>
                                  {referee.nextAssignment.location}
                                </div>
                                <div className='text-sm text-[#9ca3af]'>
                                  {referee.nextAssignment.game}
                                </div>
                              </div>
                            ) : (
                              <span className='text-[#9ca3af] italic'>
                                No assignment
                              </span>
                            )}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {referee.nextAssignment?.dateTime ? (
                              <div>
                                <div className='font-semibold'>
                                  {new Date(
                                    referee.nextAssignment.dateTime
                                  ).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </div>
                                <div className='text-sm text-[#9ca3af]'>
                                  {new Date(
                                    referee.nextAssignment.dateTime
                                  ).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </div>
                              </div>
                            ) : (
                              <span className='text-[#9ca3af] italic'>
                                Not scheduled
                              </span>
                            )}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {referee.avgScore || 0}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body text-center whitespace-nowrap'>
                            {referee.evaluations || 0}
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <span className={`inline-block px-4 py-1.5 rounded-full text-fluid-sm font-semibold whitespace-nowrap ${referee.status === 'Disabled' ? 'bg-red-900/50 text-red-200' : 'bg-[#e5e7eb] text-[#374151]'}`}>
                              {referee.status || 'Active'}
                            </span>
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <div className='flex items-center gap-3'>
                              <button
                                onClick={(e) =>
                                  handleEditReferee(referee, e)
                                }
                                className='hover:opacity-80 transition-opacity'
                                title='Edit'
                                disabled={referee.status === 'Disabled'}
                              >
                                <HiPencil className={`w-5 h-5 lg:w-6 lg:h-6 ${referee.status === 'Disabled' ? 'text-gray-500' : 'text-[#22c55e]'}`} />
                              </button>
                              <button
                                onClick={(e) =>
                                  handleDeleteReferee(referee.id, e)
                                }
                                className='hover:opacity-80 transition-opacity'
                                title='Delete'
                                disabled={referee.status === 'Disabled'}
                              >
                                <HiTrash className={`w-5 h-5 lg:w-6 lg:h-6 ${referee.status === 'Disabled' ? 'text-gray-500' : 'text-[#ef4444]'}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan='10' className='text-center py-12'>
                          <p className='text-[15px] text-[#6b7280] text-body'>
                            No referees found.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className='px-4 lg:px-6 py-4 border-t border-[#3a3a3a]'>
                <p className='text-fluid-base text-white text-body text-center'>
                  Showing {filteredReferees.length} of {referees.length}{' '}
                  officials
                </p>
              </div>

              {/* No Results Message */}
              {filteredReferees.length === 0 && !loading && (
                <div className='text-center py-12'>
                  <p className='text-[15px] text-[#6b7280] text-body'>
                    No referees found matching your search.
                  </p>
                </div>
              )}
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
                  <option>Tier 100</option>
                  <option>Tier 150</option>
                  <option>Tier 200</option>
                  <option>Tier 250</option>
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
