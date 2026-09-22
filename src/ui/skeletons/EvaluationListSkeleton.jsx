import React from 'react';

export default function EvaluationListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-5 space-y-3">
            <div className="h-4 w-28 bg-[#2a2a2a] rounded"></div>
            <div className="h-8 w-16 bg-[#2a2a2a] rounded"></div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="h-10 w-72 bg-[#2a2a2a] rounded-lg"></div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-[#2a2a2a] rounded-lg"></div>
          <div className="h-10 w-32 bg-[#2a2a2a] rounded-lg"></div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl overflow-hidden">
        <div className="h-12 bg-[#262626] border-b border-[#2e2e2e] px-6 flex items-center">
          <div className="h-4 w-full bg-[#2a2a2a] rounded"></div>
        </div>
        <div className="divide-y divide-[#2a2a2a]">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="h-4 w-40 bg-[#2a2a2a] rounded"></div>
              <div className="h-4 w-32 bg-[#2a2a2a] rounded"></div>
              <div className="h-4 w-24 bg-[#2a2a2a] rounded"></div>
              <div className="h-6 w-16 bg-[#2a2a2a] rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
