import React from 'react';

export default function EvaluationDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#141414] text-gray-200 animate-pulse">
      {/* Top Bar Skeleton */}
      <header className="h-16 border-b border-[#262626] flex items-center justify-between px-6 bg-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-[#2a2a2a]"></div>
          <div className="h-5 w-40 bg-[#2a2a2a] rounded"></div>
        </div>
        <div className="w-24 h-9 rounded-lg bg-[#2a2a2a]"></div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header Card Skeleton */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-2">
              <div className="h-7 w-64 bg-[#2a2a2a] rounded"></div>
              <div className="h-4 w-48 bg-[#2a2a2a] rounded"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-24 bg-[#2a2a2a] rounded-full"></div>
              <div className="h-8 w-20 bg-[#2a2a2a] rounded-lg"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#2e2e2e]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 bg-[#2a2a2a] rounded"></div>
                <div className="h-5 w-24 bg-[#2a2a2a] rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Scores Grid Skeleton */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6 space-y-4">
          <div className="h-6 w-36 bg-[#2a2a2a] rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-[#171717] border border-[#2a2a2a] flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-[#2a2a2a] rounded"></div>
                  <div className="h-3 w-20 bg-[#2a2a2a] rounded"></div>
                </div>
                <div className="h-8 w-12 bg-[#2a2a2a] rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Qualitative Feedback Skeleton */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6 space-y-4">
          <div className="h-6 w-48 bg-[#2a2a2a] rounded"></div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-[#2a2a2a] rounded"></div>
            <div className="h-4 w-5/6 bg-[#2a2a2a] rounded"></div>
            <div className="h-4 w-2/3 bg-[#2a2a2a] rounded"></div>
          </div>
        </div>
      </main>
    </div>
  );
}
