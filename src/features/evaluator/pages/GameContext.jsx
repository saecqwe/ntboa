'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/authentication/hooks/useAuth';
export const dynamic = 'force-dynamic';
import EvaluatorHeader from '../components/EvaluatorHeader';
import { db } from '@/services/firebase/config';
import { collection, query, getDocs } from 'firebase/firestore';

const GameContextContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const officialsParam = searchParams.get('officials');
  const isGroupParam = searchParams.get('isGroup');

  const officials = officialsParam
    ? JSON.parse(decodeURIComponent(officialsParam))
    : [];

  // Fallback for legacy single official param
  const singleOfficialName = searchParams.get('official');
  const singleOfficialTier = searchParams.get('tier');

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
    window.addEventListener('profileUpdated', loadProfile);
    return () => window.removeEventListener('profileUpdated', loadProfile);
  }, []);

  // Form state
  const [location, setLocation] = useState('');
  const [locationsList, setLocationsList] = useState([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locationsQuery = query(collection(db, 'locations'));
        const locationsSnapshot = await getDocs(locationsQuery);
        setLocationsList(locationsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };
    fetchLocations();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Navigate to evaluation form with official data
    const url = `/evaluator/evaluation-form?officials=${encodeURIComponent(
      JSON.stringify(officials)
    )}&isGroup=${isGroupParam}&location=${encodeURIComponent(location)}`;
    router.push(url);
  };

  return (
    <div className='min-h-screen flex flex-col bg-gradient-secondary'>
      <EvaluatorHeader
        userName={userData.name}
        userInitials={userData.initials}
        showBackButton={true}
      />
      <hr className='border-white/20 my-4' />

      {/* Game Context Title */}
      <div className='text-center mb-4'>
        <h2 className='text-[20px] lg:text-[22px] font-semibold text-white heading'>
          Game Context
        </h2>
      </div>

      {/* Main Content - Black Background */}
      <div className='flex-1 bg-[#181818]'>
        <main className='px-6 py-6 lg:px-8 lg:py-8'>
          <div className='max-w-md mx-auto lg:max-w-6xl'>
            {/* Selected Official Card */}
            <div className='mb-6 lg:mb-8 space-y-3'>
              {officials.length > 0 ? (
                officials.map((official, index) => (
                  <div
                    key={index}
                    className='bg-[#ffffff]/6 rounded-[15px] px-5 py-[18px] lg:px-6 lg:py-[18px] flex items-center justify-between border-2 border-white/40'
                  >
                    {/* Official Name */}
                    <div className='text-[17px] lg:text-[18px] font-normal text-white text-body'>
                      {official.name}
                    </div>

                    {/* Tier Badge */}
                    <div className='bg-[#3a3a3a] text-[#9ca3af] text-[13px] lg:text-[14px] font-medium px-4 py-1.5 rounded-full text-body whitespace-nowrap'>
                      {official.tier}
                    </div>
                  </div>
                ))
              ) : (
                <div className='bg-[#ffffff]/6 rounded-[15px] px-5 py-[18px] lg:px-6 lg:py-[18px] flex items-center justify-between border-2 border-white/40'>
                  <div className='text-[17px] lg:text-[18px] font-normal text-white text-body'>
                    {singleOfficialName || 'Unknown Official'}
                  </div>
                  <div className='bg-[#3a3a3a] text-[#9ca3af] text-[13px] lg:text-[14px] font-medium px-4 py-1.5 rounded-full text-body whitespace-nowrap'>
                    {singleOfficialTier || 'N/A'}
                  </div>
                </div>
              )}
            </div>

            {/* Game Context Form Card */}
            <div className='bg-[#ffffff]/6 rounded-[20px] p-5 lg:p-6 border border-white/20'>
              <form onSubmit={handleSubmit} className='space-y-5'>
                {/* Location Field */}
                <div>
                  <label className='block text-[15px] lg:text-[16px] text-white text-body mb-2.5'>
                    Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className='w-full bg-[#3a3a3a] text-white placeholder-[#9ca3af] rounded-[12px] px-4 py-3.5 text-[15px] lg:text-[16px] text-body focus:outline-none focus:ring-2 focus:ring-white/30 transition-all border border-[#4a4a4a] appearance-none'
                  >
                    <option value="">Select Location</option>
                    {locationsList.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>
              </form>
            </div>

            {/* Next Button */}
            <div className='mt-8 lg:mt-10'>
              <button
                onClick={handleSubmit}
                className='w-full bg-accent hover:opacity-90 rounded-[15px] py-4 lg:py-[18px] text-center transition-all active:scale-[0.98] shadow-lg'
              >
                <div className='text-[18px] lg:text-[19px] font-bold text-white heading'>
                  Next
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const GameContextPage = () => (
  <Suspense fallback={<div className='p-8 text-white'>Loading game context...</div>}>
    <GameContextContent />
  </Suspense>
);

export default GameContextPage;
