'use client';

import React, { useState, useCallback } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import BackButton from '@/components/ui/BackButton';
import {
  HiMenu,
  HiOutlineUser,
  HiOutlineLockClosed,
  HiCheck,
  HiEye,
  HiEyeOff,
} from 'react-icons/hi';

// Setting sections for profile management
const SETTING_SECTIONS = [
  { id: 'profile', name: 'Profile', icon: HiOutlineUser },
  { id: 'password', name: 'Password', icon: HiOutlineLockClosed },
];

const SettingsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const fileInputRef = React.useRef(null);

  // Profile data
  const [profileData, setProfileData] = useState({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@ntboa.org',
    phone: '+1 (555) 123-4567',
    role: 'Administrator',
    profilePhotoUrl: null,
  });

  // Load profile data from localStorage on component mount
  React.useEffect(() => {
    const savedProfile = localStorage.getItem('ntboa_admin_profile');
    if (savedProfile) {
      try {
        const parsedProfile = JSON.parse(savedProfile);
        setProfileData(parsedProfile);
      } catch (error) {
        console.error('Error loading profile data:', error);
      }
    }
  }, []);

  // Password data
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileChange = useCallback((field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handlePasswordChange = useCallback((field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSaveProfile = useCallback(async () => {
    setSaveStatus('saving');
    // Simulate API call
    setTimeout(() => {
      // Save profile data to localStorage
      localStorage.setItem('ntboa_admin_profile', JSON.stringify(profileData));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 3000);
    }, 1000);
  }, [profileData]);

  const handlePasswordReset = useCallback(async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New password and confirm password do not match');
      return;
    }
    setSaveStatus('saving');
    // Simulate API call
    setTimeout(() => {
      setSaveStatus('saved');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSaveStatus(''), 3000);
    }, 1000);
  }, [passwordData]);

  const handlePhotoClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePhotoChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Please select an image smaller than 5MB');
        return;
      }

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const newProfileData = {
          ...profileData,
          profilePhotoUrl: e.target?.result,
        };
        setProfilePhoto(e.target?.result);
        setProfileData(newProfileData);
        // Save to localStorage immediately for real-time sync
        localStorage.setItem(
          'ntboa_admin_profile',
          JSON.stringify(newProfileData)
        );
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    const newProfileData = {
      ...profileData,
      profilePhotoUrl: null,
    };
    setProfilePhoto(null);
    setProfileData(newProfileData);
    // Save to localStorage immediately for real-time sync
    localStorage.setItem('ntboa_admin_profile', JSON.stringify(newProfileData));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [profileData]);

  const renderProfileSettings = () => (
    <div className='space-y-6'>
      {/* Profile Picture Section */}
      <div className='flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 p-4 sm:p-6 bg-card-bg rounded-lg border border-input-border'>
        <div className='relative flex-shrink-0'>
          <div className='w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center overflow-hidden'>
            {profileData.profilePhotoUrl ? (
              <img
                src={profileData.profilePhotoUrl}
                alt='Profile'
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full bg-accent rounded-full flex items-center justify-center'>
                <span className='text-xl sm:text-2xl font-bold text-white'>
                  {profileData.firstName.charAt(0)}
                  {profileData.lastName.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className='flex-1 text-center sm:text-left'>
          <h3 className='text-lg sm:text-xl font-semibold text-white'>
            {profileData.firstName} {profileData.lastName}
          </h3>
          <p className='text-sm sm:text-base text-gray-400 mb-3'>
            {profileData.role}
          </p>
          <div className='flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2'>
            <button
              onClick={handlePhotoClick}
              className='px-4 py-2 text-sm bg-input-bg hover:bg-input-border text-white rounded-lg transition-colors'
            >
              Change Photo
            </button>
            {profileData.profilePhotoUrl && (
              <button
                onClick={handleRemovePhoto}
                className='px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors'
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            onChange={handlePhotoChange}
            className='hidden'
          />
        </div>
      </div>

      {/* Profile Information */}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6'>
        <div>
          <label className='block text-fluid-sm font-medium text-gray-300 mb-2'>
            First Name
          </label>
          <input
            type='text'
            value={profileData.firstName}
            onChange={(e) => handleProfileChange('firstName', e.target.value)}
            className='w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
            placeholder='Enter first name'
          />
        </div>

        <div>
          <label className='block text-fluid-sm font-medium text-gray-300 mb-2'>
            Last Name
          </label>
          <input
            type='text'
            value={profileData.lastName}
            onChange={(e) => handleProfileChange('lastName', e.target.value)}
            className='w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
            placeholder='Enter last name'
          />
        </div>

        <div>
          <label className='block text-fluid-sm font-medium text-gray-300 mb-2'>
            Email Address
          </label>
          <input
            type='email'
            value={profileData.email}
            onChange={(e) => handleProfileChange('email', e.target.value)}
            className='w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
            placeholder='Enter email address'
          />
        </div>

        <div>
          <label className='block text-fluid-sm font-medium text-gray-300 mb-2'>
            Phone Number
          </label>
          <input
            type='tel'
            value={profileData.phone}
            onChange={(e) => handleProfileChange('phone', e.target.value)}
            className='w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
            placeholder='Enter phone number'
          />
        </div>

        <div className='sm:col-span-2'>
          <label className='block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2'>
            Role
          </label>
          <input
            type='text'
            value={profileData.role}
            readOnly
            className='w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-input-bg/50 border border-input-border rounded-lg text-gray-400 cursor-not-allowed'
          />
        </div>
      </div>
    </div>
  );

  const renderPasswordSettings = () => (
    <div className='space-y-6'>
      <div className='bg-card-bg rounded-lg border border-input-border p-4 sm:p-6'>
        <h3 className='text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4'>
          Change Password
        </h3>
        <p className='text-sm sm:text-base text-gray-400 mb-4 sm:mb-6'>
          Update your password to keep your account secure.
        </p>

        <div className='space-y-4'>
          <div>
            <label className='block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2'>
              Current Password
            </label>
            <div className='relative'>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) =>
                  handlePasswordChange('currentPassword', e.target.value)
                }
                className='w-full px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
                placeholder='Enter current password'
              />
              <button
                type='button'
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
              >
                {showCurrentPassword ? (
                  <HiEyeOff className='w-5 h-5' />
                ) : (
                  <HiEye className='w-5 h-5' />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className='block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2'>
              New Password
            </label>
            <div className='relative'>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) =>
                  handlePasswordChange('newPassword', e.target.value)
                }
                className='w-full px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
                placeholder='Enter new password'
              />
              <button
                type='button'
                onClick={() => setShowNewPassword(!showNewPassword)}
                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
              >
                {showNewPassword ? (
                  <HiEyeOff className='w-5 h-5' />
                ) : (
                  <HiEye className='w-5 h-5' />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className='block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2'>
              Confirm New Password
            </label>
            <div className='relative'>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  handlePasswordChange('confirmPassword', e.target.value)
                }
                className='w-full px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-sm sm:text-base bg-input-bg border border-input-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-white placeholder-gray-400'
                placeholder='Confirm new password'
              />
              <button
                type='button'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
              >
                {showConfirmPassword ? (
                  <HiEyeOff className='w-5 h-5' />
                ) : (
                  <HiEye className='w-5 h-5' />
                )}
              </button>
            </div>
          </div>

          <div className='pt-4'>
            <button
              onClick={handlePasswordReset}
              disabled={
                saveStatus === 'saving' ||
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword
              }
              className='w-full flex items-center justify-center space-x-2 px-6 py-3 bg-accent hover:bg-accent/90 disabled:bg-accent/50 rounded-lg transition-colors'
            >
              {saveStatus === 'saving' ? (
                <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : saveStatus === 'saved' ? (
                <HiCheck className='w-4 h-4' />
              ) : null}
              <span className='text-sm font-medium'>
                {saveStatus === 'saving'
                  ? 'Updating...'
                  : saveStatus === 'saved'
                  ? 'Updated!'
                  : 'Update Password'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className='bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 sm:p-4'>
        <h4 className='text-sm sm:text-base font-semibold text-yellow-400 mb-2'>
          Password Requirements
        </h4>
        <ul className='text-xs sm:text-sm text-gray-300 space-y-1 list-disc list-inside'>
          <li>At least 8 characters long</li>
          <li>Contains uppercase and lowercase letters</li>
          <li>Contains at least one number</li>
          <li>Contains at least one special character</li>
        </ul>
      </div>
    </div>
  );

  const renderSettingContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSettings();
      case 'password':
        return renderPasswordSettings();
      default:
        return renderProfileSettings();
    }
  };

  return (
    <div className='min-h-screen bg-background'>
      <AdminSidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        profileData={profileData}
      />

      <div className='lg:ml-64 flex flex-col min-h-screen'>
        <header className='bg-card-bg border-b border-input-border px-4 py-3 sm:py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 sm:gap-4 flex-1'>
              <button
                onClick={() => setSidebarOpen(true)}
                className='lg:hidden p-2 rounded-lg bg-input-bg hover:bg-input-border transition-colors'
              >
                <HiMenu className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
              </button>
              <BackButton />
              <div className='min-w-0 flex-1'>
                <h1 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-white heading truncate'>
                  Profile Settings
                </h1>
                <p className='text-xs sm:text-sm lg:text-base text-gray-400 hidden sm:block'>
                  Manage your profile information and account security
                </p>
              </div>
            </div>

            <button
              onClick={
                activeSection === 'profile'
                  ? handleSaveProfile
                  : handlePasswordReset
              }
              disabled={saveStatus === 'saving'}
              className='flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-2 bg-accent hover:bg-accent/90 disabled:bg-accent/50 rounded-lg transition-colors flex-shrink-0'
            >
              {saveStatus === 'saving' ? (
                <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : saveStatus === 'saved' ? (
                <HiCheck className='w-4 h-4' />
              ) : null}
              <span className='text-xs sm:text-sm font-medium hidden sm:inline'>
                {saveStatus === 'saving'
                  ? 'Saving...'
                  : saveStatus === 'saved'
                  ? 'Saved!'
                  : 'Save Changes'}
              </span>
              <span className='text-xs font-medium sm:hidden'>
                {saveStatus === 'saving'
                  ? 'Saving...'
                  : saveStatus === 'saved'
                  ? 'Saved!'
                  : 'Save'}
              </span>
            </button>
          </div>
        </header>

        <main className='flex-1 flex flex-col lg:flex-row'>
          {/* Settings Navigation - Mobile Horizontal, Desktop Vertical */}
          <div className='lg:w-64 bg-card-bg border-b lg:border-b-0 lg:border-r border-input-border'>
            {/* Mobile Navigation - Horizontal Scrollable */}
            <div className='lg:hidden p-4'>
              <div className='flex space-x-2 overflow-x-auto pb-2'>
                {SETTING_SECTIONS.map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      activeSection === id
                        ? 'bg-accent/20 text-accent border border-accent/20'
                        : 'text-gray-300 hover:bg-input-bg hover:text-white border border-input-border'
                    }`}
                  >
                    <Icon className='w-4 h-4' />
                    <span className='text-sm font-medium'>{name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Navigation - Vertical */}
            <div className='hidden lg:block p-4'>
              <nav className='space-y-1'>
                {SETTING_SECTIONS.map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeSection === id
                        ? 'bg-accent/20 text-accent border-accent/20'
                        : 'text-gray-300 hover:bg-input-bg hover:text-white'
                    }`}
                  >
                    <Icon className='w-5 h-5' />
                    <span className='text-fluid-sm font-medium'>{name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Settings Content */}
          <div className='flex-1 p-4 sm:p-6 lg:p-8'>
            <div className='max-w-4xl mx-auto'>
              <div className='mb-6 lg:mb-8'>
                <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-white heading capitalize mb-2'>
                  {activeSection} Settings
                </h2>
                <p className='text-sm sm:text-base text-gray-400'>
                  Configure your {activeSection} preferences and options
                </p>
              </div>

              <div className='bg-card-bg rounded-xl border border-input-border p-4 sm:p-6'>
                {renderSettingContent()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
