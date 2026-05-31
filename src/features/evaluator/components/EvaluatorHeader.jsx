'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin, PiSignOut } from 'react-icons/pi';
import BackButton from '@/ui/BackButton';
import { useAuth } from '@/authentication/hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase/config';

const EvaluatorHeader = ({
  userName = 'User',
  userInitials = 'U',
  showBackButton = true,
}) => {
  const router = useRouter();
  const { userData } = useAuth();
  const [profileData, setProfileData] = useState({
    initials: userInitials,
    photo: null,
  });

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/evaluator/login'); // Or general login
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    const name = userData?.name || userInitials;
    const initials = name
      ? name
          .trim()
          .split(' ')
          .filter((n) => n.length > 0)
          .map((part) => part.charAt(0).toUpperCase())
          .join('')
          .slice(0, 2)
      : userInitials;

    let photo = userData?.photo || null;

    if (!photo && typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('evaluatorProfile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        photo = profile.photo || photo;
      }
    }

    setProfileData({ initials, photo });
  }, [userData, userInitials]);

  return (
    <header className='py-4 px-6 lg:py-5 lg:px-8'>
      <div className='max-w-md mx-auto lg:max-w-6xl flex items-center justify-between'>
        <div className='flex items-center gap-3 lg:gap-4'>
          {showBackButton && <BackButton variant='light' />}

          <div className='w-12 h-12 lg:w-14 lg:h-14 bg-white/20 rounded-full flex items-center justify-center'>
            <PiGlobeSimpleThin className='w-7 h-7 lg:w-8 lg:h-8 text-white' />
          </div>

          <button
            onClick={handleLogout}
            className='w-12 h-12 lg:w-14 lg:h-14 bg-red-500/20 hover:bg-red-500/30 rounded-full flex items-center justify-center transition-all'
            title="Logout"
          >
            <PiSignOut className='w-6 h-6 lg:w-7 lg:h-7 text-red-200' />
          </button>
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
