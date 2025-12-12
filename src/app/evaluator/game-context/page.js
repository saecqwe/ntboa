'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EvaluatorHeader from '@/components/EvaluatorHeader';

export const dynamic = 'force-dynamic';

const GameContextContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get selected official from URL params or use default
  const officialName = searchParams.get('official') || 'Michael Johnson';
  const officialTier = searchParams.get('tier') || 'Tier 150';

  // Mock user data
  const userData = {
    name: 'John',
    initials: 'JS',
  };

  // Form state
  const [nameOrId, setNameOrId] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Navigate to evaluation form with official data
    const url = `/evaluator/evaluation-form?official=${encodeURIComponent(
      officialName
    )}&tier=${encodeURIComponent(officialTier)}&nameOrId=${encodeURIComponent(
      nameOrId
    )}&location=${encodeURIComponent(location)}`;
    console.log('Game context submitted:', { nameOrId, location });
    console.log('Navigating to:', url);
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
            <div className='mb-6 lg:mb-8'>
              <div className='bg-[#ffffff]/6 rounded-[15px] px-5 py-[18px] lg:px-6 lg:py-[18px] flex items-center justify-between border-2 border-white/40'>
                {/* Official Name */}
                <div className='text-[17px] lg:text-[18px] font-normal text-white text-body'>
                  {officialName}
                </div>

                {/* Tier Badge */}
                <div className='bg-[#3a3a3a] text-[#9ca3af] text-[13px] lg:text-[14px] font-medium px-4 py-1.5 rounded-full text-body whitespace-nowrap'>
                  {officialTier}
                </div>
              </div>
            </div>

            {/* Game Context Form Card */}
            <div className='bg-[#ffffff]/6 rounded-[20px] p-5 lg:p-6 border border-white/20'>
              <form onSubmit={handleSubmit} className='space-y-5'>
                {/* Nome or ID Field */}
                <div>
                  <label className='block text-[15px] lg:text-[16px] text-white text-body mb-2.5'>
                    Nome or ID
                  </label>
                  <input
                    type='text'
                    placeholder='Enter name or official id'
                    value={nameOrId}
                    onChange={(e) => setNameOrId(e.target.value)}
                    className='w-full bg-[#3a3a3a] text-white placeholder-[#9ca3af] rounded-[12px] px-4 py-3.5 text-[15px] lg:text-[16px] text-body focus:outline-none focus:ring-2 focus:ring-white/30 transition-all border border-[#4a4a4a]'
                  />
                </div>

                {/* Location Field */}
                <div>
                  <label className='block text-[15px] lg:text-[16px] text-white text-body mb-2.5'>
                    Location
                  </label>
                  <input
                    type='text'
                    placeholder='Enter area or city name'
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className='w-full bg-[#3a3a3a] text-white placeholder-[#9ca3af] rounded-[12px] px-4 py-3.5 text-[15px] lg:text-[16px] text-body focus:outline-none focus:ring-2 focus:ring-white/30 transition-all border border-[#4a4a4a]'
                  />
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
