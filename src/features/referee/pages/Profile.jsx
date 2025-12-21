'use client';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin, PiSignOut } from 'react-icons/pi';
import { FaUser, FaCamera } from 'react-icons/fa';
import BackButton from '@/ui/BackButton';
import { useAuth } from '../../authentication/hooks/useAuth';
import { updateUserProfile, changeUserPassword, logout } from '../../authentication/services/authService';

const RefereeProfilePage = () => {
  const router = useRouter();
  const { user, userData, refreshUserData, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    tier: '',
    initials: '',
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/referee/login');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/referee/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setMessage('Logout failed. Please try again.');
    }
  };

  // Load profile data from userData
  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        email: userData.email || user?.email || '',
        phone: userData.phone || '',
        tier: userData.ranking || userData.tier || '', // Handle both naming conventions
        initials: userData.name
          ? userData.name
              .trim()
              .split(' ')
              .filter((n) => n.length > 0)
              .map((name) => name.charAt(0).toUpperCase())
              .join('')
              .slice(0, 2)
          : 'U',
      });
    }
  }, [userData, user]);

  const handleInputChange = useCallback((field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-generate initials when name changes
      if (field === 'name') {
        const names = value
          .trim()
          .split(' ')
          .filter((n) => n.length > 0);
        const initials = names
          .map((name) => name.charAt(0).toUpperCase())
          .join('')
          .slice(0, 2);
        updated.initials = initials;
      }

      return updated;
    });
  }, []);

  const handlePasswordChange = useCallback((field, value) => {
    setPassword((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handlePhotoClick = useCallback(() => {
    // fileInputRef.current?.click();
    // Disabled as per request
    setMessage('Profile picture update is currently disabled.');
  }, []);

  const handlePhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image size should be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      setMessage('');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      await updateUserProfile(user.uid, {
        name: formData.name,
        phone: formData.phone,
      });

      await refreshUserData();

      // Trigger custom event for header to update if needed (though context should handle it)
      window.dispatchEvent(new Event('profileUpdated'));

      setMessage('Profile updated successfully!');
    } catch (error) {
      console.error(error);
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (password.new !== password.confirm) {
      setMessage('New passwords do not match');
      return;
    }

    if (password.new.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      await changeUserPassword(password.current, password.new);

      setMessage('Password changed successfully!');
      setPassword({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
         setMessage('Current password is incorrect.');
      } else {
         setMessage('Failed to change password. ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const profileFields = [
    {
      id: 'name',
      label: 'Full Name',
      type: 'text',
      value: formData.name,
      required: true,
    },
    {
      id: 'email',
      label: 'Email Address',
      type: 'email',
      value: formData.email,
      required: true,
      disabled: true, // Email change usually requires re-auth and verification
    },
    {
      id: 'phone',
      label: 'Phone Number',
      type: 'tel',
      value: formData.phone,
      required: false,
    },
    {
      id: 'tier',
      label: 'Ranking / Tier',
      type: 'text',
      value: formData.tier,
      required: false,
      disabled: true,
    },
  ];

  const passwordFields = [
    {
      id: 'current',
      label: 'Current Password',
      value: password.current,
      required: true,
    },
    {
      id: 'new',
      label: 'New Password',
      value: password.new,
      required: true,
    },
    {
      id: 'confirm',
      label: 'Confirm New Password',
      value: password.confirm,
      required: true,
    },
  ];

  if (loading || !user) {
    return (
      <div className='min-h-screen bg-[#0e0e0e] flex items-center justify-center'>
        <div className='w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin'></div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex flex-col bg-[#0e0e0e] text-white'>
      {/* Header */}
      <header className='bg-gradient-to-r from-[#c41414] via-[#b41313] to-[#8b0f0f] px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-5 shadow-lg'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <BackButton
              href='/referee/home'
              variant='light'
              ariaLabel='Back to dashboard'
            />
            <div className='w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/15 flex items-center justify-center'>
              <PiGlobeSimpleThin className='w-4 h-4 sm:w-5 sm:h-5 text-white' />
            </div>
            <p className='text-lg sm:text-xl font-semibold heading text-white'>
              NTBOA
            </p>
          </div>
          <button
            onClick={handleLogout}
            className='flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-sm font-medium text-white border border-white/10'
          >
            <PiSignOut className='w-4 h-4' />
            <span>Sign Out</span>
          </button>
        </div>
        <div className='text-center sm:text-left'>
          <h1 className='text-2xl sm:text-3xl lg:text-4xl font-bold heading text-white mb-2'>
            Profile Settings
          </h1>
          <p className='text-sm sm:text-base text-white/80'>
            Manage your account settings and preferences
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 bg-[#0f0f0f]'>
        <div className='max-w-4xl mx-auto space-y-6 sm:space-y-8'>
          {/* Status Message */}
          {message && (
            <div
              className={`p-4 rounded-lg text-sm font-medium ${
                message.includes('success')
                  ? 'bg-green-900/50 text-green-400 border border-green-700'
                  : 'bg-red-900/50 text-red-400 border border-red-700'
              }`}
            >
              {message}
            </div>
          )}

          {/* Profile Information Section */}
          <section className='bg-[#1b1b1b] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#2b2b2b] shadow-2xl'>
            <h2 className='text-xl sm:text-2xl font-bold heading text-white mb-6 flex items-center gap-3'>
              <FaUser className='w-6 h-6 text-[#c41414]' />
              Profile Information
            </h2>

            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* Profile Photo Section - Visual only for now */}
              <div className='flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6'>
                <div className='flex flex-col items-center sm:items-start'>
                  <div className='relative'>
                    <div className='w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#2b2b2b] border-2 border-[#3b3b3b] overflow-hidden'>
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt='Profile preview'
                          className='w-full h-full object-cover'
                        />
                      ) : (
                        <div className='w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-bold text-white/60'>
                          {formData.initials}
                        </div>
                      )}
                    </div>
                    {/* Disabled photo button */}
                    {/*
                    <button
                      type='button'
                      onClick={handlePhotoClick}
                      className='absolute -bottom-1 -right-1 w-7 h-7 bg-[#c41414] rounded-full flex items-center justify-center text-white hover:bg-[#d41515] transition-colors'
                      aria-label='Change profile photo'
                    >
                      <FaCamera className='w-4 h-4' />
                    </button>
                    */}
                  </div>
                </div>
                <div className='text-center sm:text-left'>
                  {/*
                  <button
                    type='button'
                    onClick={handlePhotoClick}
                    className='bg-[#2b2b2b] hover:bg-[#3b3b3b] text-white px-4 py-2 rounded-lg font-medium transition-colors border border-[#3b3b3b]'
                  >
                    {photoPreview ? 'Change Photo' : 'Add Profile Photo'}
                  </button>
                  */}
                  <p className='text-xs text-white/60 mt-2'>
                    Profile photo updates are currently disabled.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  onChange={handlePhotoChange}
                  className='hidden'
                  aria-label='Upload profile photo'
                />
              </div>

              {/* Form Fields */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6'>
                {profileFields.map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={field.id}
                      className='block text-sm font-semibold text-white/90 mb-2'
                    >
                      {field.label}
                      {field.required && !field.disabled && (
                        <span className='text-red-400 ml-1'>*</span>
                      )}
                    </label>
                    <input
                      type={field.type}
                      id={field.id}
                      value={field.value}
                      onChange={(e) =>
                        handleInputChange(field.id, e.target.value)
                      }
                      required={field.required}
                      disabled={field.disabled}
                      className={`w-full p-3 bg-[#2b2b2b] border border-[#3b3b3b] rounded-lg text-white placeholder-white/50 focus:border-[#c41414] focus:ring-1 focus:ring-[#c41414] focus:outline-none transition-colors ${field.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                ))}
              </div>

              {/* Initials Display */}
              <div>
                <label className='block text-sm font-semibold text-white/90 mb-2'>
                  Display Initials
                </label>
                <div className='flex items-center gap-3 p-3 bg-[#2b2b2b] border border-[#3b3b3b] rounded-lg'>
                  <div className='w-10 h-10 rounded-full bg-[#c41414] flex items-center justify-center text-white font-bold'>
                    {formData.initials}
                  </div>
                  <span className='text-white/70 text-sm'>
                    Auto-generated from your name
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className='flex justify-end pt-4'>
                <button
                  type='submit'
                  disabled={isLoading}
                  className='bg-[#c41414] hover:bg-[#d41515] disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors min-w-32'
                >
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          {/* Password Change Section */}
          <section className='bg-[#1b1b1b] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#2b2b2b] shadow-2xl'>
            <h2 className='text-xl sm:text-2xl font-bold heading text-white mb-6'>
              Change Password
            </h2>

            <form
              onSubmit={handlePasswordSubmit}
              className='space-y-4 sm:space-y-6'
            >
              <div className='grid grid-cols-1 gap-4 sm:gap-6'>
                {passwordFields.map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={`password-${field.id}`}
                      className='block text-sm font-semibold text-white/90 mb-2'
                    >
                      {field.label}
                      {field.required && (
                        <span className='text-red-400 ml-1'>*</span>
                      )}
                    </label>
                    <input
                      type='password'
                      id={`password-${field.id}`}
                      value={field.value}
                      onChange={(e) =>
                        handlePasswordChange(field.id, e.target.value)
                      }
                      required={field.required}
                      className='w-full p-3 bg-[#2b2b2b] border border-[#3b3b3b] rounded-lg text-white placeholder-white/50 focus:border-[#c41414] focus:ring-1 focus:ring-[#c41414] focus:outline-none transition-colors'
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div className='flex justify-end pt-4'>
                <button
                  type='submit'
                  disabled={
                    isLoading ||
                    !password.current ||
                    !password.new ||
                    !password.confirm
                  }
                  className='bg-[#c41414] hover:bg-[#d41515] disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors min-w-32'
                >
                  {isLoading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
};

export default RefereeProfilePage;
