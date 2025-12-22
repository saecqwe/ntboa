'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/services/firebase/config';
import { createUser } from '@/features/authentication/services/authService';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import BackButton from '@/ui/BackButton';
import { HiMenu, HiPlus, HiPencil, HiTrash, HiX, HiChevronDown, HiCheck } from 'react-icons/hi';
import toast, { Toaster } from 'react-hot-toast';

const EvaluatorsPage = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Data State
  const [evaluators, setEvaluators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  
  const [editFormData, setEditFormData] = useState({
    id: '',
    fullName: '',
  });
  const [editingEvaluator, setEditingEvaluator] = useState(null);

  useEffect(() => {
    // Fetch evaluators from 'users' collection where role is 'evaluator'
    const q = query(collection(db, 'users'), where('role', '==', 'evaluator'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const evaluatorsData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        evaluatorsData.push({
          id: doc.id,
          ...data,
          // Format date if it exists
          joinedDate: data.createdAt?.seconds 
            ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'N/A'
        });
      });
      setEvaluators(evaluatorsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching evaluators:", error);
      toast.error("Failed to load evaluators.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddEvaluator = () => {
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

  const handleSubmitEvaluator = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      // 1. Create Auth User (using secondary app to avoid admin logout)
      const userCredential = await createUser(formData.email, formData.password);
      const uid = userCredential.user.uid;

      // 2. Create Firestore Document
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        displayName: formData.fullName,
        email: formData.email,
        role: 'evaluator',
        createdAt: serverTimestamp(),
        evaluationsMade: 0, // Initialize stats
        photoURL: '',
      });

      toast.success("Evaluator added successfully!");
      handleCloseAddModal();
    } catch (error) {
      console.error('Error creating evaluator:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Email is already in use.");
      } else {
        toast.error("Failed to add evaluator: " + error.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditEvaluator = (evaluator, e) => {
    e.stopPropagation();
    setEditingEvaluator(evaluator);
    setEditFormData({
      id: evaluator.id,
      fullName: evaluator.displayName || '',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingEvaluator(null);
    setEditFormData({
      id: '',
      fullName: '',
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateEvaluator = async (e) => {
    e.preventDefault();
    if (!editingEvaluator) return;
    setActionLoading(true);

    try {
      const evaluatorRef = doc(db, 'users', editingEvaluator.id);
      await updateDoc(evaluatorRef, {
        displayName: editFormData.fullName,
      });
      toast.success("Evaluator updated successfully!");
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating evaluator:', error);
      toast.error("Failed to update evaluator.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvaluator = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this evaluator? This will disable their account.')) {
      try {
        const suspendUser = httpsCallable(functions, 'suspendUser');
        await suspendUser({ uid: id });
        toast.success("Evaluator account suspended.");
      } catch (error) {
        console.error('Error suspending evaluator:', error);
        toast.error("Failed to suspend evaluator.");
      }
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
            Evaluators
          </h1>
        </header>

        {/* Content */}
        <div className='p-4 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            {/* Top Bar - Add Button */}
            <div className='flex justify-end mb-6'>
              <button
                onClick={handleAddEvaluator}
                className='flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all active:scale-[0.98] text-fluid-base whitespace-nowrap'
              >
                <HiPlus className='w-5 h-5' />
                Add New Evaluator
              </button>
            </div>

            {/* Evaluators Table */}
            <div className='bg-[#2a2a2a] rounded-[20px] overflow-hidden border border-[#3a3a3a]'>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='bg-accent'>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        EVALUATOR NAME
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        EMAIL
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        # OF EVALUATIONS
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        JOINED DATE
                      </th>
                      <th className='text-left py-4 px-4 lg:px-6 text-fluid-sm font-bold text-white uppercase tracking-wider whitespace-nowrap'>
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan='5' className='text-center py-12'>
                          <p className='text-[15px] text-[#6b7280] text-body'>
                            Loading evaluators...
                          </p>
                        </td>
                      </tr>
                    ) : evaluators.length > 0 ? (
                      evaluators.map((evaluator) => (
                        <tr
                          key={evaluator.id}
                          className={`border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors ${evaluator.status === 'Disabled' ? 'opacity-50 grayscale' : ''}`}
                        >
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {evaluator.displayName}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {evaluator.email}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body text-center whitespace-nowrap'>
                            {evaluator.evaluationsMade || 0}
                          </td>
                          <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                            {evaluator.joinedDate}
                          </td>
                          <td className='py-4 px-4 lg:px-6'>
                            <div className='flex items-center gap-3'>
                              <button
                                onClick={(e) => handleEditEvaluator(evaluator, e)}
                                className='hover:opacity-80 transition-opacity'
                                title='Edit'
                                disabled={evaluator.status === 'Disabled'}
                              >
                                <HiPencil className={`w-5 h-5 lg:w-6 lg:h-6 ${evaluator.status === 'Disabled' ? 'text-gray-500' : 'text-[#22c55e]'}`} />
                              </button>
                              <button
                                onClick={(e) =>
                                  handleDeleteEvaluator(evaluator.id, e)
                                }
                                className='hover:opacity-80 transition-opacity'
                                title='Delete'
                                disabled={evaluator.status === 'Disabled'}
                              >
                                <HiTrash className={`w-5 h-5 lg:w-6 lg:h-6 ${evaluator.status === 'Disabled' ? 'text-gray-500' : 'text-[#ef4444]'}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan='5' className='text-center py-12'>
                          <p className='text-[15px] text-[#6b7280] text-body'>
                            No evaluators found.
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
                  Showing {evaluators.length} evaluators
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Evaluator Modal */}
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
                Add New Evaluator
              </h2>
              <button
                onClick={handleCloseAddModal}
                className='text-white hover:opacity-80 transition-opacity'
              >
                <HiX className='w-6 h-6' />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitEvaluator} className='p-6'>
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
                  placeholder='john.doe@gmailntboa.com'
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
                  {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Add Evaluator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Evaluator Modal */}
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
                Edit Evaluator
              </h2>
              <button
                onClick={handleCloseEditModal}
                className='text-white hover:opacity-80 transition-opacity'
              >
                <HiX className='w-6 h-6' />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateEvaluator} className='p-6'>
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
                  {actionLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Evaluator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluatorsPage;

