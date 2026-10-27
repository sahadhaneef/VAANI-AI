import { useMemo, useState } from 'react';
import type { VoiceUIState, VoiceState } from '../types/assistant';

interface HeaderProps {
  status: VoiceUIState | VoiceState;
  onNewSession?: () => void;
}

const statusLabels: Record<VoiceUIState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  processing: 'Processing',
  thinking: 'Processing',
  searching: 'Searching',
  tool_running: 'Processing',
  speaking: 'Speaking',
  error: 'Error',
  retry: 'Retry',
};

const statusStyles: Record<VoiceUIState, { dot: string; text: string; bg: string; border: string }> = {
  idle: {
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-200/60',
  },
  listening: {
    dot: 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]',
    text: 'text-red-700 font-semibold',
    bg: 'bg-red-50/90',
    border: 'border-red-200',
  },
  processing: {
    dot: 'bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]',
    text: 'text-indigo-700 font-medium',
    bg: 'bg-indigo-50/85',
    border: 'border-indigo-200/70',
  },
  thinking: {
    dot: 'bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]',
    text: 'text-indigo-700 font-medium',
    bg: 'bg-indigo-50/85',
    border: 'border-indigo-200/70',
  },
  searching: {
    dot: 'bg-sky-500 animate-ping shadow-[0_0_10px_rgba(14,165,233,0.7)]',
    text: 'text-sky-700 font-medium',
    bg: 'bg-sky-50/90',
    border: 'border-sky-200',
  },
  tool_running: {
    dot: 'bg-indigo-500 animate-spin',
    text: 'text-indigo-700 font-medium',
    bg: 'bg-indigo-50/85',
    border: 'border-indigo-200/70',
  },
  speaking: {
    dot: 'bg-purple-600 animate-pulse shadow-[0_0_10px_rgba(147,51,234,0.6)]',
    text: 'text-purple-700 font-semibold',
    bg: 'bg-purple-50/90',
    border: 'border-purple-200',
  },
  error: {
    dot: 'bg-amber-500',
    text: 'text-amber-800 font-medium',
    bg: 'bg-amber-50/90',
    border: 'border-amber-200',
  },
  retry: {
    dot: 'bg-amber-500 animate-pulse',
    text: 'text-amber-800 font-medium',
    bg: 'bg-amber-50/90',
    border: 'border-amber-200',
  },
};

export default function Header({ status, onNewSession }: HeaderProps) {
  const [isRotating, setIsRotating] = useState(false);

  const normalizedStatus: VoiceUIState = useMemo(() => {
    if ((status as string) === 'ready') return 'idle';
    if ((status as string) === 'executing') return 'processing';
    return (status as VoiceUIState) || 'idle';
  }, [status]);

  const label = statusLabels[normalizedStatus] || 'Ready';
  const currentStyle = statusStyles[normalizedStatus] || statusStyles.idle;

  const handleRefreshClick = () => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 600);
    if (onNewSession) {
      onNewSession();
    }
  };

  return (
    <header className="glass-header sticky top-0 z-30 w-full px-4 sm:px-6 py-3 transition-colors duration-300">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-500/20">
            V
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
              VAANI AI
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              Malayalam Intelligent Voice Assistant
            </p>
          </div>
        </div>

        {/* Right: Status Pill & Dedicated Refresh Button */}
        <div className="flex items-center gap-2.5">
          {/* Subtle Live Status Indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all duration-300 shadow-sm ${currentStyle.bg} ${currentStyle.border}`}
            role="status"
            aria-live="polite"
          >
            <span className={`w-2 h-2 rounded-full ${currentStyle.dot}`} />
            <span className={`text-xs ${currentStyle.text}`}>
              {label}
            </span>
          </div>

          {/* Dedicated Refresh / New Voice Session Button */}
          <button
            id="refresh-session-btn"
            type="button"
            onClick={handleRefreshClick}
            aria-label="New Voice Session"
            title="New Voice Session"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/80 hover:bg-white border border-slate-200/80 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 shadow-sm hover:shadow-md active:scale-90 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRotating ? 'animate-spin-once' : ''}
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6" />
              <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
