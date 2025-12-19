'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import {
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineDocumentDuplicate,
  HiOutlineUpload,
  HiOutlineCog,
  HiOutlineLogout,
  HiX,
  HiOutlineLocationMarker,
} from 'react-icons/hi';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: HiOutlineHome, href: '/admin/dashboard' },
  { name: 'Referees', icon: HiOutlineUserGroup, href: '/admin/referees' },
  { name: 'Evaluators', icon: HiOutlineUsers, href: '/admin/evaluators' },
  {
    name: 'Evaluations',
    icon: HiOutlineClipboardList,
    href: '/admin/evaluations',
  },
  {
    name: 'Assignments',
    icon: HiOutlineDocumentDuplicate,
    href: '/admin/assignments',
  },
  {
    name: 'Locations',
    icon: HiOutlineLocationMarker,
    href: '/admin/locations',
  },
  {
    name: 'Upload Roster',
    icon: HiOutlineUpload,
    href: '/admin/upload-roster',
  },
  { name: 'Settings', icon: HiOutlineCog, href: '/admin/settings' },
];

const AdminSidebar = ({ isOpen, setIsOpen, onClose, profileData }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = React.useState({
    firstName: 'Admin',
    lastName: 'User',
    role: 'Administrator',
    profilePhotoUrl: null,
  });

  // Load profile data from localStorage or use provided profileData
  React.useEffect(() => {
    if (profileData) {
      setProfile(profileData);
    } else {
      const savedProfile = localStorage.getItem('ntboa_admin_profile');
      if (savedProfile) {
        try {
          const parsedProfile = JSON.parse(savedProfile);
          setProfile(parsedProfile);
        } catch (error) {
          console.error('Error loading profile data:', error);
        }
      }
    }
  }, [profileData]);

  const closeSidebar = () => {
    if (typeof setIsOpen === 'function') setIsOpen(false);
    if (typeof onClose === 'function') onClose();
  };

  const handleLogout = () => {
    console.log('Logging out...');
    router.push('/admin/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className='fixed inset-0 bg-black/50 z-40 lg:hidden'
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`w-64 bg-gradient-secondary h-screen flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <button
          onClick={closeSidebar}
          className='lg:hidden absolute right-4 top-4 text-white hover:bg-white/10 rounded-lg p-2 transition-colors'
        >
          <HiX className='w-6 h-6' />
        </button>

        <div className='p-6 flex items-center gap-3'>
          <div className='w-12 h-12 bg-white/20 rounded-full flex items-center justify-center'>
            <PiGlobeSimpleThin className='w-7 h-7 text-white' />
          </div>
          <h1 className='text-fluid-2xl font-bold text-white heading'>NTBOA</h1>
        </div>

        <nav className='flex-1 px-4 pt-4'>
          <ul className='space-y-2'>
            {NAV_ITEMS.map(({ name, icon: Icon, href }) => {
              const isActive = pathname === href;

              return (
                <li key={name}>
                  <Link
                    href={href}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/90 hover:bg-white/10'
                    }`}
                  >
                    <Icon className='w-5 h-5' />
                    <span className='text-fluid-base font-medium text-body'>
                      {name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className='p-4 border-t border-white/10'>
          <Link
            href='/admin/settings'
            onClick={closeSidebar}
            className='flex items-center gap-3 px-4 py-3 mb-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer'
          >
            <div className='w-10 h-10 rounded-full flex items-center justify-center overflow-hidden'>
              {profile.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt='Profile'
                  className='w-full h-full object-cover'
                />
              ) : (
                <div className='w-full h-full bg-white rounded-full flex items-center justify-center'>
                  <span className='text-fluid-lg font-bold text-accent'>
                    {profile.firstName.charAt(0)}
                    {profile.lastName.charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className='text-fluid-base font-semibold text-white text-body'>
                {profile.firstName} {profile.lastName}
              </div>
              <div className='text-fluid-sm text-white/70 text-body'>
                {profile.role}
              </div>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className='flex items-center gap-3 px-4 py-3 rounded-lg text-white/90 hover:bg-white/10 transition-all w-full'
          >
            <HiOutlineLogout className='w-5 h-5' />
            <span className='text-fluid-base font-medium text-body'>
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
