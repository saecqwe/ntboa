import React from 'react';
import Link from 'next/link';
import { PiGlobeSimpleThin } from 'react-icons/pi';
import { LuUserCog, LuUsers, LuShieldCheck } from 'react-icons/lu';
import BackButton from '@/components/BackButton';

const roles = [
  {
    title: 'Evaluator Login',
    description: 'Submit on-court assessments & voice notes.',
    href: '/evaluator/login',
    Icon: LuUserCog,
    iconClass: 'bg-gradient-to-br from-[#f5515f] to-[#d4315a] text-white',
  },
  {
    title: 'Admin Login',
    description: 'Manage rosters, assignments, and tiers.',
    href: '/admin/login',
    Icon: LuUsers,
    iconClass: 'bg-gradient-to-br from-white to-[#d9d9d9] text-[#1b1b1b]',
  },
  {
    title: 'Referee Login',
    description: 'Track performance & upcoming fixtures.',
    href: '/referee/login',
    Icon: LuShieldCheck,
    iconClass: 'border border-white/30 text-white',
  },
];

const Page = () => {
  return (
    <div className='min-h-screen bg-[#040404] overflow-hidden relative'>
      <div className='absolute inset-0 bg-gradient-to-br from-[#0f0f0f] via-[#040404] to-[#090909]' />
      <div className='absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]' />
      <div className='absolute -left-20 top-20 w-64 h-64 bg-[#d4315a]/40 blur-3xl rounded-full' />
      <div className='absolute -right-20 bottom-10 w-72 h-72 bg-[#f2b705]/30 blur-3xl rounded-full' />

      <div className='relative z-10 max-w-5xl mx-auto px-5 lg:px-10 py-10 lg:py-16 flex flex-col gap-10'>
        <header className='flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-6'>
          <div className='flex items-center gap-4'>
            <div className='w-14 h-14 rounded-2xl border border-white/20 bg-white/10 flex items-center justify-center backdrop-blur'>
              <PiGlobeSimpleThin className='w-7 h-7 text-white' />
            </div>
            <div>
              <p className='text-xs uppercase tracking-[0.5em] text-white/60 heading'>
                NTBOA
              </p>
              <h1 className='text-2xl md:text-3xl font-semibold text-white heading'>
                Elite Officials Hub
              </h1>
            </div>
          </div>
          <p className='text-white/60 text-sm heading'>
            Seamless access for every role — Evaluator, Admin, Referee.
          </p>
        </header>

        <section className='space-y-6 text-center md:text-left'>
          <div className='inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 text-xs uppercase tracking-[0.3em] heading'>
            Precision & Performance
          </div>
          <div className='space-y-4'>
            <h2 className='text-3xl md:text-5xl font-bold heading text-white'>
              One portal. Three gateways.
            </h2>
            <p className='text-lg text-white/70 heading max-w-2xl'>
              Choose your path and enter a polished experience built for the
              NTBOA community. Every screen is crafted with the same luxury
              finish.
            </p>
          </div>
        </section>

        <div className='grid md:grid-cols-3 gap-4'>
          {roles.map(({ title, description, href, Icon, iconClass }) => (
            <Link
              key={title}
              href={href}
              className='group rounded-3xl p-6 h-full flex flex-col justify-between bg-white/5 backdrop-blur border border-white/10 hover:border-white/40 transition-all hover:-translate-y-1 shadow-[0_20px_40px_rgba(0,0,0,0.35)]'
            >
              <div className='flex items-center gap-3 mb-4'>
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconClass}`}
                >
                  <Icon className='w-6 h-6' />
                </div>
                <div className='text-left'>
                  <h3 className='text-xl font-semibold text-white heading'>
                    {title}
                  </h3>
                  <p className='text-sm text-white/60 heading'>{description}</p>
                </div>
              </div>
              <div className='text-right'>
                <span className='text-sm font-semibold text-white/80 heading group-hover:text-white'>
                  Enter Portal →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Page;
