import React from 'react';

const NoticeBanner = ({ notice }) => {
  if (!notice) return null;

  return (
    <div className="max-w-5xl mx-auto mt-4 px-4 no-print">
      <div
        className={`rounded-lg px-4 py-3 text-sm ${
          notice.type === 'error'
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}
      >
        {notice.message}
      </div>
    </div>
  );
};

export default NoticeBanner;
