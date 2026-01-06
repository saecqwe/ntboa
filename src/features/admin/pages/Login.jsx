'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import { HiOutlineMail, HiOutlineLockClosed } from 'react-icons/hi';
import { useAuth } from '@/features/authentication/hooks/useAuth';
import { login, getUserDocument } from '@/features/authentication/services/authService';

const AdminLoginPage = () => {
  const router = useRouter();
  const { userData } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userData?.role === 'admin') {
      router.push('/admin/dashboard');
    }
  }, [userData, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await login(email, password);
      if (userCredential.user) {
        const userData = await getUserDocument(userCredential.user.uid);
        if (userData?.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          alert('You are not authorized to access this page.');
          setIsLoading(false);
          // It's good practice to sign out the user if they are not authorized
          // await logout(); 
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Navigate to forgot password page or show modal
    console.log('Forgot password clicked');
    // router.push('/admin/forgot-password');
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-primary bg-grid-pattern px-4 py-8 relative overflow-hidden'>
      <div className='w-full max-w-[480px] lg:max-w-3xl px-8 py-12 lg:px-12 lg:py-12 bg-[#FFFFFF]/10 rounded-3xl p-8 shadow-2xl border border-[#FFFFFF]/10 relative z-10'>
        <div className='flex justify-center mb-6'>
          <div className='w-16 h-16 lg:w-20 lg:h-20 bg-[#3a3a3a] rounded-full flex items-center justify-center border border-[#4a4a4a]'>
            <PiGlobeSimpleThin className='w-9 h-9 lg:w-11 lg:h-11 text-white' />
          </div>
        </div>

        {/* NTBOA Title */}
        <h1 className='text-center text-fluid-2xl font-bold text-white heading mb-3'>
          NTBOA
        </h1>

        {/* Subtitle */}
        <h2 className='text-center text-fluid-xl font-semibold text-white heading mb-8 lg:mb-10'>
          Admin Login
        </h2>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className='space-y-5'>
          {/* Email Field */}
          <div className='relative'>
            <div className='absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none'>
              <HiOutlineMail className='w-5 h-5 text-[#9ca3af]' />
            </div>
            <input
              type='email'
              placeholder='Email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full bg-[#FFFFFF]/20 text-white placeholder-text-muted rounded-2xl pl-12 pr-4 py-4 text-body focus:outline-none focus:ring-2 focus:ring-input-border border transition-all border-[#FFFFFF]/60'
            />
          </div>

          {/* Password Field */}
          <div className='relative'>
            <div className='absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none'>
              <HiOutlineLockClosed className='w-5 h-5 text-text-muted' />
            </div>
            <input
              type='password'
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className='w-full bg-[#FFFFFF]/20 text-white placeholder-text-muted rounded-2xl pl-12 pr-4 py-4 text-body focus:outline-none focus:ring-2 focus:ring-input-border border transition-all border-[#FFFFFF]/60'
            />
          </div>

          {/* Forgot Password Link */}
          <div className='flex justify-end'>
            <button
              type='button'
              onClick={handleForgotPassword}
              className='text-fluid-base text-white/80 hover:text-white transition-colors text-body'
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <div className='pt-3'>
            <button
              type='submit'
              disabled={isLoading}
              className='w-full bg-gradient-secondary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-[12px] py-4 text-center transition-all active:scale-[0.98] shadow-lg'
            >
              {isLoading ? (
                <div className='flex items-center justify-center gap-3'>
                  <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  <span className='text-fluid-lg font-semibold text-white heading'>
                    Logging in...
                  </span>
                </div>
              ) : (
                <span className='text-fluid-lg font-semibold text-white heading'>
                  Login
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
