import React from 'react';

/**
 * TableRowSkeleton
 *
 * Inline table-row skeleton loader used inside <tbody> while data is being fetched.
 * Matches the visual weight of a standard admin data table row.
 *
 * Props:
 *   rows    — number of skeleton rows to render (default: 6)
 *   cols    — widths for each column cell (array of Tailwind width classes)
 */
export default function TableRowSkeleton({
  rows = 6,
  cols = ['w-36', 'w-28', 'w-20', 'w-24', 'w-16'],
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[#3a3a3a] animate-pulse">
          {cols.map((w, j) => (
            <td key={j} className="py-4 px-4 lg:px-6">
              <div className={`h-4 ${w} bg-[#2a2a2a] rounded`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
