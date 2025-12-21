'use client';

import React, { useState, useEffect } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useRouter } from 'next/navigation';
import EvaluatorHeader from '@/features/evaluator/components/EvaluatorHeader';
import { getReferees } from '@/features/evaluator/services/refereeService';
import { useAuth } from '@/features/authentication/hooks/useAuth';

const NewEvaluationPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficials, setSelectedOfficials] = useState([]);
  const [isGroupEvaluation, setIsGroupEvaluation] = useState(false);
  const [officials, setOfficials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile data state
  const [userData, setUserData] = useState({
    name: 'John',
    initials: 'JS',
  });

  // Load profile data
  useEffect(() => {
    const loadProfile = () => {
      const savedProfile = localStorage.getItem('evaluatorProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setUserData({
          name: profile.name || 'John',
          initials: profile.initials || 'JS',
        });
      }
    };
    loadProfile();
    window.addEventListener('storage', loadProfile);
    window.addEventListener('profileUpdated', loadProfile);
    return () => {
      window.removeEventListener('storage', loadProfile);
      window.removeEventListener('profileUpdated', loadProfile);
    };
  }, []);

  // Fetch officials
  useEffect(() => {
    const fetchOfficials = async () => {
      setIsLoading(true);
      const data = await getReferees();
      // Map Firestore data to UI structure
      const mappedOfficials = data.map((ref) => ({
        id: ref.id,
        name: ref.displayName || ref.name || 'Unknown Official',
        tier: ref.tier || 'N/A',
        // Use nextAssignment if available, otherwise placeholders
        location: ref.nextAssignment?.location || 'No assignment',
        date: ref.nextAssignment?.dateTime || new Date().toISOString(),
        time: ref.nextAssignment?.dateTime
          ? new Date(ref.nextAssignment.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'N/A',
      }));
      setOfficials(mappedOfficials);
      setIsLoading(false);
    };
    fetchOfficials();
  }, []);

  // Filter officials based on search query
  const filteredOfficials = officials.filter((official) =>
    official.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOfficialClick = (official) => {
    if (isGroupEvaluation) {
      setSelectedOfficials((prev) => {
        const isAlreadySelected = prev.find((o) => o.id === official.id);
        if (isAlreadySelected) {
          return prev.filter((o) => o.id !== official.id);
        } else if (prev.length < 3) {
          return [...prev, official];
        }
        return prev;
      });
    } else {
      setSelectedOfficials([official]);
    }
  };

  const handleNext = () => {
    if (selectedOfficials.length > 0) {
      const officials = selectedOfficials.map((official) => ({
        id: official.id,
        name: official.name,
        tier: official.tier,
        location: official.location,
        date: official.date,
        time: official.time,
      }));

      const url = `/evaluator/game-context?officials=${encodeURIComponent(
        JSON.stringify(officials)
      )}&isGroup=${isGroupEvaluation}`;
      router.push(url);
    }
  };

  return (
    <div className='min-h-screen flex flex-col bg-gradient-secondary'>
      <EvaluatorHeader
        userName={userData.name}
        userInitials={userData.initials}
        showBackButton={true}
      />

      {/* Group Evaluation Toggle */}
      <div className='px-6 pt-4 pb-2 lg:px-8'>
        <div className='max-w-md mx-auto lg:max-w-6xl'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => {
                setIsGroupEvaluation(!isGroupEvaluation);
                setSelectedOfficials([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isGroupEvaluation
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  isGroupEvaluation
                    ? 'border-white bg-white'
                    : 'border-white/50'
                }`}
              >
                {isGroupEvaluation && (
                  <div className='w-2 h-2 bg-black rounded-sm' />
                )}
              </div>
              <span className='text-sm font-medium'>Group Evaluation</span>
            </button>
            {isGroupEvaluation && (
              <span className='text-xs text-white/60'>
                Select up to 3 officials ({selectedOfficials.length}/3)
              </span>
            )}
          </div>
        </div>
      </div>

      <hr className='border-white/20 mb-4' />

      <div className='px-6 pb-5 lg:px-8 lg:pb-6'>
        <div className='max-w-md mx-auto lg:max-w-6xl'>
          <div className='relative'>
            <div className='absolute inset-y-0 left-5 flex items-center pointer-events-none'>
              <IoSearch className='w-5 h-5 text-[#9ca3af]' />
            </div>
            <input
              type='text'
              placeholder='Search official name..'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full bg-white text-[#181818] placeholder-[#9ca3af] rounded-[15px] pl-14 pr-5 py-[14px] text-[15px] lg:text-[16px] text-body focus:outline-none focus:ring-2 focus:ring-white/30 transition-all'
            />
          </div>
        </div>
      </div>

      {/* Main Content - Black Background */}
      <div className='flex-1 bg-[#181818]'>
        <main className='px-6 py-6 lg:px-8 lg:py-8'>
          <div className='max-w-md mx-auto lg:max-w-6xl'>
            {/* Officials List */}
            <div className='space-y-3 lg:space-y-3'>
              {isLoading ? (
                <div className='text-center py-12'>
                  <div className='text-[#9ca3af] text-[16px] text-body'>
                    Loading officials...
                  </div>
                </div>
              ) : filteredOfficials.length > 0 ? (
                filteredOfficials.map((official) => (
                  <button
                    key={official.id}
                    onClick={() => handleOfficialClick(official)}
                    className={`w-full bg-[#ffffff]/6 hover:bg-[#333333] rounded-[15px] px-5 py-[18px] lg:px-6 lg:py-[20px] transition-all cursor-pointer active:scale-[0.98] ${
                      selectedOfficials.find((o) => o.id === official.id)
                        ? 'border-2 border-accent bg-accent/10'
                        : 'border border-[#ffff]/20 hover:border-[#4a4a4a]'
                    }`}
                  >
                    <div className='flex items-start justify-between'>
                      {/* Left side - Official Info */}
                      <div className='flex-1 text-left'>
                        {/* Official Name */}
                        <div className='text-[17px] lg:text-[18px] font-medium text-white text-body mb-1'>
                          {official.name}
                        </div>

                        {/* Location */}
                        <div className='text-[14px] lg:text-[15px] text-[#9ca3af] text-body mb-1'>
                          📍 {official.location}
                        </div>

                        {/* Date & Time */}
                        <div className='text-[13px] lg:text-[14px] text-[#9ca3af] text-body'>
                          🗓️{' '}
                          {new Date(official.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at {official.time}
                        </div>
                      </div>

                      {/* Right side - Tier Badge and Selection Indicator */}
                      <div className='flex items-center gap-2 ml-4'>
                        <div className='bg-[#3a3a3a] text-[#9ca3af] text-[13px] lg:text-[14px] font-medium px-4 py-1.5 rounded-full text-body whitespace-nowrap'>
                          {official.tier}
                        </div>
                        {selectedOfficials.find(
                          (o) => o.id === official.id
                        ) && (
                          <div className='w-6 h-6 bg-accent rounded-full flex items-center justify-center'>
                            <div className='w-2 h-2 bg-white rounded-full' />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className='text-center py-12'>
                  <div className='text-[#9ca3af] text-[16px] text-body'>
                    No officials found
                  </div>
                </div>
              )}
            </div>

            {/* Helper Text */}
            {filteredOfficials.length > 0 && selectedOfficials.length === 0 && (
              <div className='mt-6 text-center'>
                <div className='text-[14px] text-[#9ca3af] text-body'>
                  {isGroupEvaluation
                    ? 'Please select officials to continue (up to 3)'
                    : 'Please select an official to continue'}
                </div>
              </div>
            )}

            {/* Selected Officials Summary */}
            {isGroupEvaluation && selectedOfficials.length > 0 && (
              <div className='mt-6 bg-[#ffffff]/6 rounded-[15px] p-4 border border-[#ffffff]/20'>
                <div className='text-[15px] font-medium text-white mb-2'>
                  Selected Officials ({selectedOfficials.length}):
                </div>
                <div className='space-y-1'>
                  {selectedOfficials.map((official) => (
                    <div
                      key={official.id}
                      className='text-[13px] text-[#9ca3af] flex items-center gap-2'
                    >
                      <span>•</span>
                      <span>
                        {official.name} - {official.tier}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Button */}
            {filteredOfficials.length > 0 && (
              <div className='mt-6 lg:mt-8'>
                <button
                  onClick={handleNext}
                  disabled={selectedOfficials.length === 0}
                  className={`w-full mx-auto rounded-[15px] py-4 lg:py-[18px] text-center transition-all shadow-lg ${
                    selectedOfficials.length > 0
                      ? 'bg-accent hover:opacity-90 active:scale-[0.98] cursor-pointer'
                      : 'bg-accent/50 cursor-not-allowed'
                  }`}
                >
                  <div className='text-[18px] lg:text-[19px] font-bold text-white heading'>
                    Next
                  </div>
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default NewEvaluationPage;
