'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import BackButton from './BackButton';

const EvaluatorHeader = ({
  userName = 'User',
  userInitials = 'U',
  showBackButton = true,
}) => {
  const [profileData, setProfileData] = useState({
    initials: userInitials,
    photo: null,
  });

  // Load profile data from localStorage
  useEffect(() => {
    const savedProfile = localStorage.getItem('evaluatorProfile');
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      setProfileData({
        initials: profile.initials || userInitials,
        photo: profile.photo,
      });
    }
  }, [userInitials]);

  // Listen for profile updates
  useEffect(() => {
    const handleStorageChange = () => {
      const savedProfile = localStorage.getItem('evaluatorProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setProfileData({
          initials: profile.initials || userInitials,
          photo: profile.photo,
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom profile update events
    window.addEventListener('profileUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleStorageChange);
    };
  }, [userInitials]);

  return (
    <header className='py-4 px-6 lg:py-5 lg:px-8'>
      <div className='max-w-md mx-auto lg:max-w-6xl flex items-center justify-between'>
        <div className='flex items-center gap-3 lg:gap-4'>
          {showBackButton && <BackButton variant='light' />}

          <div className='w-12 h-12 lg:w-14 lg:h-14 bg-white/20 rounded-full flex items-center justify-center'>
            <PiGlobeSimpleThin className='w-7 h-7 lg:w-8 lg:h-8 text-white' />
          </div>
        </div>

        <h1 className='text-2xl lg:text-3xl font-bold text-white heading'>
          NTBOA
        </h1>

        <Link
          href='/evaluator/profile'
          className='w-12 h-12 lg:w-14 lg:h-14 bg-white/20 rounded-full flex items-center justify-center transition-all hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white overflow-hidden'
          aria-label='Open profile'
        >
          {profileData.photo ? (
            <img
              src={profileData.photo}
              alt='Profile'
              className='w-full h-full object-cover'
            />
          ) : (
            <div className='text-white font-semibold text-sm lg:text-base'>
              {profileData.initials}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
};

export default EvaluatorHeader;
