import React, { useEffect, useMemo, useState } from 'react';

const NoticeBanner = ({ notice }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!notice) {
      setIsVisible(false);
      return undefined;
    }

    setIsVisible(true);
    const timer = window.setTimeout(() => setIsVisible(false), 3600);
    return () => window.clearTimeout(timer);
  }, [notice?.message, notice?.type]);

  const tone = useMemo(() => {
    if (!notice) return 'info';
    if (notice.type === 'error') return 'error';
    if (notice.type === 'success') return 'success';
    return 'info';
  }, [notice]);

  if (!notice || !isVisible) return null;

  return (
    <div className="fixed top-20 right-4 z-[80] no-print pointer-events-none">
      <div
        className={`notice-toast pointer-events-auto max-w-[88vw] sm:max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg border backdrop-blur-sm ${
          tone === 'error'
            ? 'bg-red-50/95 border-red-200 text-red-700'
            : tone === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
              : 'bg-blue-50/95 border-blue-200 text-blue-700'
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="mt-[1px] text-base leading-none">
            {tone === 'error' ? '!' : tone === 'success' ? 'OK' : 'i'}
          </span>
          <span>{notice.message}</span>
        </div>
      </div>
    </div>
  );
};

export default NoticeBanner;
