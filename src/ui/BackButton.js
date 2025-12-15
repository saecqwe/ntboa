'use client';

import React from 'react';
import { IoArrowBack } from 'react-icons/io5';
import { useRouter } from 'next/navigation';

const VARIANT_STYLES = {
  light:
    'bg-white/15 text-white border border-white/20 hover:bg-white/25 focus-visible:outline-white',
  solid:
    'bg-[#1f1f1f] text-white border border-white/10 hover:bg-[#2b2b2b] focus-visible:outline-white',
};

const BackButton = ({
  href,
  ariaLabel = 'Go back',
  className = '',
  variant = 'light',
}) => {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  const variantClasses = VARIANT_STYLES[variant] || VARIANT_STYLES.light;

  return (
    <button
      type='button'
      onClick={handleClick}
      className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full flex items-center justify-center transition-all active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${variantClasses} ${className}`}
      aria-label={ariaLabel}
    >
      <IoArrowBack className='w-5 h-5' />
    </button>
  );
};

export default BackButton;

