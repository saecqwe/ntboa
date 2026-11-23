'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HiArrowUp } from 'react-icons/hi';

const ScrollToTop = ({ scrollContainerRef = null, sentinelRef = null, className = '' }) => {
  const buttonRef = useRef(null);
  const localSentinelRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rootEl = scrollContainerRef?.current || null;
    const targetSentinel = sentinelRef?.current || localSentinelRef.current;

    if (targetSentinel && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            setIsVisible(!entry.isIntersecting);
          });
        },
        { root: rootEl, threshold: 0 }
      );

      observer.observe(targetSentinel);
      return () => observer.disconnect();
    }

    const scrollTarget = rootEl || window;
    const checkScroll = () => {
      const y = rootEl ? rootEl.scrollTop : window.scrollY;
      setIsVisible(y > 160);
    };

    checkScroll();
    scrollTarget.addEventListener('scroll', checkScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', checkScroll);
  }, [scrollContainerRef, sentinelRef]);

  const focusScrollRegion = () => {
    const target =
      scrollContainerRef?.current ||
      document.querySelector('main') ||
      document.body;
    if (!target || typeof target.focus !== 'function') return;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
  };

  const handleBlur = (e) => {
    if (e.relatedTarget) return;
    const btn = buttonRef.current;
    if (!btn) return;
    if (window.getComputedStyle(btn).visibility === 'hidden') {
      focusScrollRegion();
    }
  };

  const handleScrollToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';

    const container = scrollContainerRef?.current;
    if (container) {
      container.scrollTo({ top: 0, behavior });
    } else {
      window.scrollTo({ top: 0, behavior });
    }

    focusScrollRegion();
  };

  const buttonElement = (
    <button
      ref={buttonRef}
      type='button'
      onClick={handleScrollToTop}
      onBlur={handleBlur}
      aria-label='Scroll to top'
      title='Scroll to top'
      className={`scroll-to-top-btn ${isVisible ? 'is-visible' : ''} w-11 h-11 rounded-full bg-accent hover:brightness-110 text-white shadow-lg shadow-black/40 border border-white/15 flex items-center justify-center cursor-pointer active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        scrollContainerRef
          ? 'pointer-events-auto'
          : 'fixed bottom-5 right-5 lg:bottom-7 lg:right-7 z-40'
      } ${className}`}
    >
      <HiArrowUp className='w-5 h-5' aria-hidden='true' />
    </button>
  );

  if (scrollContainerRef) {
    return (
      <div className='sticky bottom-5 z-40 flex justify-end pr-5 pointer-events-none'>
        {buttonElement}
      </div>
    );
  }

  return (
    <>
      <div
        ref={localSentinelRef}
        aria-hidden='true'
        className='scroll-sentinel'
      />
      {buttonElement}
    </>
  );
};

export default ScrollToTop;
