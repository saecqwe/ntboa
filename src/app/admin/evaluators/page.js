'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import BackButton from '@/components/BackButton';
import { HiMenu, HiPlus, HiPencil, HiTrash, HiX, HiChevronDown, HiCheck } from 'react-icons/hi';

const EvaluatorsPage = () => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState('All Tiers');
  const [showTierDropdown, setShowTierDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const dropdownRef = useRef(null);

  // Tier options
  const tierOptions = [
    'All Tiers',
    'Tier 100',
    'Tier 150',
    'Tier 200',
    'Tier 250',
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowTierDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setShowTierDropdown(false);
  };

  // Mock data for evaluators
  const evaluators = [
    {
      id: 1,
      name: 'Michael Johnson',
      email: 'jsmith@ntboa.org',
      evaluations: 12,
      joinedDate: 'Jan 14, 2024',
      tier: 'Tier 150',
    },
    {
      id: 2,
      name: 'Sarah Williams',
      email: 'ejohnson@ntboa.org',
      evaluations: 9,
      joinedDate: 'Mar 21, 2024',
      tier: 'Tier 100',
    },
    {
      id: 3,
      name: 'David Brown',
      email: 'mdavis@ntboa.org',
      evaluations: 15,
      joinedDate: 'Nov 9, 2023',
      tier: 'Tier 200',
    },
  ];

  // Filter evaluators based on tier
  const filteredEvaluators = evaluators.filter((evaluator) => {
    if (selectedTier === 'All Tiers') return true;
    return evaluator.tier === selectedTier;
  });

  const handleAddEvaluator = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
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

  const handleSubmitEvaluator = (e) => {
    e.preventDefault();
    console.log('Add new evaluator:', formData);
    // Add your API call here
    handleCloseModal();
  };

  const handleEditEvaluator = (id, e) => {
    e.stopPropagation();
    console.log('Edit evaluator:', id);
  };

  const handleDeleteEvaluator = (id, e) => {
    e.stopPropagation();
    console.log('Delete evaluator:', id);
  };

  return (
    <div className='flex min-h-screen bg-[#1a1a1a]'>
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
            {/* Top Bar - Tier Filter and Add Button */}
            <div className='flex flex-col sm:flex-row gap-4 mb-6'>
              {/* Custom Tier Filter Dropdown */}
              <div className='relative flex-1 max-w-xs' ref={dropdownRef}>
                {/* Dropdown Button */}
                <button
                  onClick={() => setShowTierDropdown(!showTierDropdown)}
                  className='w-full bg-[#2a2a2a] text-white rounded-lg px-4 py-3 text-fluid-base text-body focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all border border-[#3a3a3a] hover:border-[#4a4a4a] flex items-center justify-between'
                >
                  <span>{selectedTier}</span>
                  <HiChevronDown
                    className={`w-5 h-5 text-white transition-transform duration-300 ${
                      showTierDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {showTierDropdown && (
                  <div className='absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn'>
                    {tierOptions.map((tier) => (
                      <button
                        key={tier}
                        onClick={() => handleTierSelect(tier)}
                        className={`w-full px-4 py-3 text-fluid-base text-body text-left transition-all flex items-center justify-between ${
                          selectedTier === tier
                            ? 'bg-accent/20 text-white border-l-4 border-accent'
                            : 'text-white hover:bg-[#3a3a3a]'
                        }`}
                      >
                        <span>{tier}</span>
                        {selectedTier === tier && (
                          <HiCheck className='w-5 h-5 text-accent' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Evaluator Button */}
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
                    {filteredEvaluators.map((evaluator) => (
                      <tr
                        key={evaluator.id}
                        className='border-b border-[#3a3a3a] hover:bg-[#333333] transition-colors'
                      >
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                          {evaluator.name}
                        </td>
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                          {evaluator.email}
                        </td>
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body text-center whitespace-nowrap'>
                          {evaluator.evaluations}
                        </td>
                        <td className='py-4 px-4 lg:px-6 text-fluid-base text-white text-body whitespace-nowrap'>
                          {evaluator.joinedDate}
                        </td>
                        <td className='py-4 px-4 lg:px-6'>
                          <div className='flex items-center gap-3'>
                            <button
                              onClick={(e) => handleEditEvaluator(evaluator.id, e)}
                              className='hover:opacity-80 transition-opacity'
                              title='Edit'
                            >
                              <HiPencil className='w-5 h-5 lg:w-6 lg:h-6 text-[#22c55e]' />
                            </button>
                            <button
                              onClick={(e) =>
                                handleDeleteEvaluator(evaluator.id, e)
                              }
                              className='hover:opacity-80 transition-opacity'
                              title='Delete'
                            >
                              <HiTrash className='w-5 h-5 lg:w-6 lg:h-6 text-[#ef4444]' />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className='px-4 lg:px-6 py-4 border-t border-[#3a3a3a]'>
                <p className='text-fluid-base text-white text-body text-center'>
                  Showing {filteredEvaluators.length} of {evaluators.length}{' '}
                  evaluators
                </p>
              </div>

              {/* No Results Message */}
              {filteredEvaluators.length === 0 && (
                <div className='text-center py-12'>
                  <p className='text-[15px] text-[#6b7280] text-body'>
                    No evaluators found matching your filter.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Evaluator Modal */}
      {showModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Overlay */}
          <div
            className='absolute inset-0 bg-black/70'
            onClick={handleCloseModal}
          ></div>

          {/* Modal */}
          <div className='relative bg-[#2a2a2a] rounded-[20px] w-full max-w-lg overflow-hidden z-10 border border-[#3a3a3a]'>
            {/* Header */}
            <div className='bg-accent px-6 py-5 flex items-center justify-between'>
              <h2 className='text-fluid-2xl font-semibold text-white heading'>
                Add New Evaluator
              </h2>
              <button
                onClick={handleCloseModal}
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
                  onClick={handleCloseModal}
                  className='flex-1 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white px-6 py-3 rounded-lg font-medium transition-all text-fluid-base text-body border border-[#4a4a4a]'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='flex-1 bg-accent hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold transition-all active:scale-[0.98] text-fluid-base'
                >
                  Add Evaluator
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

