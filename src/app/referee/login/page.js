'use client';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const fields = [
    {
      type: 'email',
      placeholder: 'Email',
      value: email,
      onChange: setEmail,
      iconPath:
        'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    },
    {
      type: 'password',
      placeholder: 'Password',
      value: password,
      onChange: setPassword,
      iconPath:
        'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    router.push('/referee/home');
  };

  return (
    <div className='min-h-screen bg-gradient-primary bg-grid-pattern flex flex-col relative'>
      <div className='flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10'>
        <div className='w-full max-w-md'>
          <div className='text-center mb-8'>
            <h1 className='text-3xl sm:text-4xl font-bold heading text-foreground mb-3'>
              Evaluate. Rank. Improve.
            </h1>
            <p className='text-sm text-white text-body'>
              A streamlined evaluation system for basketball officials.
            </p>
          </div>

          <div className='bg-[#FFFFFF]/10 rounded-3xl p-8 shadow-2xl border border-[#FFFFFF]/10'>
            <div className='flex justify-center mb-6'>
              <div className='w-16 h-16 bg-[#FFFFFF]/20 rounded-full flex items-center justify-center'>
                <PiGlobeSimpleThin className='w-8 h-8 text-foreground' />
              </div>
            </div>

            <h2 className='text-2xl font-semibold heading text-foreground text-center mb-2'>
              NTBOA
            </h2>
            <h3 className='text-xl font-medium heading text-foreground text-center mb-8'>
              Sign in to your Referee Account
            </h3>

            <form onSubmit={handleSubmit} className='space-y-4'>
              {fields.map(({ type, placeholder, value, onChange, iconPath }) => (
                <label key={type} className='relative block'>
                  <span className='sr-only'>{placeholder}</span>
                  <div className='absolute inset-y-0 left-4 flex items-center pointer-events-none'>
                    <svg
                      className='w-5 h-5 text-text-muted'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d={iconPath}
                      />
                    </svg>
                  </div>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className='w-full bg-[#FFFFFF]/20 text-foreground placeholder-text-muted rounded-2xl pl-12 pr-4 py-4 text-body focus:outline-none focus:ring-2 focus:ring-input-border border transition-all border-[#FFFFFF]/60'
                    required
                  />
                </label>
              ))}

              <div className='text-right'>
                <Link
                  href='/referee/forgot-password'
                  className='text-sm text-text-muted hover:text-foreground transition-colors text-body'
                >
                  Forgot Password?
                </Link>
              </div>

              <button
                type='submit'
                className='w-full bg-gradient-secondary text-foreground font-semibold rounded-2xl py-4 heading text-lg hover:opacity-90 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg'
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className='pb-8 text-center'>
        <p className='text-sm text-text-muted text-body mb-4'>
          © 2025 NTBOA | All Rights Reserved
        </p>
        <div className='w-24 h-1 bg-input-border mx-auto rounded-full'></div>
      </footer>
    </div>
  );
};

export default LoginPage;

