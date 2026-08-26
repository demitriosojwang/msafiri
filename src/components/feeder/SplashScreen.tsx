'use client';

import { useState, useEffect } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Show splash for 2.2s, then start exit animation
    const exitTimer = setTimeout(() => setExiting(true), 2200);
    const doneTimer = setTimeout(onDone, 2700); // exit animation is 0.5s
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${
        exiting ? 'msafiri-splash-out' : ''
      }`}
      style={{
        background: `
          radial-gradient(ellipse at top, oklch(0.32 0.08 258), oklch(0.20 0.06 258)),
          linear-gradient(180deg, oklch(0.25 0.07 258) 0%, oklch(0.18 0.05 258) 100%)
        `,
      }}
    >
      {/* Decorative top arc — orange sweep like a sunset */}
      <div
        className="absolute top-0 left-0 right-0 h-1/3 opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center top, oklch(0.67 0.19 42 / 0.6), transparent 70%)',
        }}
      />

      {/* Logo with bounce-in animation */}
      <div className="msafiri-splash-in relative z-10 flex flex-col items-center">
        <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl mb-6"
             style={{ boxShadow: '0 0 60px oklch(0.67 0.19 42 / 0.4)' }}>
          <img src="/msafiri-logo.png" alt="msafiri" className="w-full h-full object-cover" />
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
          msafiri
        </h1>

        {/* Tagline */}
        <p className="text-sm text-white/60 tracking-[0.3em] uppercase">
          Ride · Connect · Journey
        </p>
      </div>

      {/* Shimmer loading bar */}
      <div className="absolute bottom-32 w-48 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-full msafiri-shimmer rounded-full" />
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-16 text-center">
        <p className="text-[10px] text-white/40 tracking-wider uppercase">
          Mombasa Terminus · Kenya Coast
        </p>
      </div>
    </div>
  );
}
