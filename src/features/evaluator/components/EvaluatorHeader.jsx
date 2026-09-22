'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin, PiSignOut } from 'react-icons/pi';
import { HiUserGroup } from 'react-icons/hi';
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/evaluator/login'); // Or general login
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Derive initials and photo directly without cascading renders
  const name = userData?.displayName || userData?.name || userName;
  const initials = name
    ? name
        .trim()
        .split(' ')
        .filter((n) => n.length > 0)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2)
    : userInitials;

  const photo = userData?.photo || userData?.photoURL || userData?.profilePhotoUrl || null;

  return (
    <header className='py-4 px-6 lg:py-5 lg:px-8'>
      <div className='max-w-7xl mx-auto flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          {showBackButton && <BackButton />}
          <div className='w-10 h-10 lg:w-12 lg:h-12 bg-white/20 rounded-full flex items-center justify-center'>
            <PiGlobeSimpleThin className='w-6 h-6 lg:w-8 lg:h-8 text-white' />
          </div>
        </div>

        <div className='flex items-center gap-3 lg:gap-4'>
          {/* Navigation Links */}
          <Link
            href='/evaluator/referees'
            className='cursor-pointer flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all font-medium text-xs lg:text-sm'
          >
            <HiUserGroup className='w-4 h-4' />
            <span className='hidden sm:inline'>View Referees</span>
          </Link>

          <button
            type='button'
            onClick={handleLogout}
            className='cursor-pointer flex items-center gap-2 px-3 py-2 lg:px-4 lg:py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all font-medium text-xs lg:text-sm'
            title='Logout'
          >
            <PiSignOut className='w-4 h-4' />
            <span className='hidden sm:inline'>Logout</span>
          </button>

          <Link
            href='/evaluator/profile'
            className='cursor-pointer w-12 h-12 lg:w-14 lg:h-14 bg-white/20 rounded-full flex items-center justify-center transition-all hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white overflow-hidden'
            aria-label='Open profile'
          >
            {photo ? (
              <Image
                src={photo}
                alt='Profile'
                width={56}
                height={56}
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='text-white font-semibold text-sm lg:text-base'>
                {initials}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default EvaluatorHeader;
