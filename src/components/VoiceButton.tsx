import { useState, useCallback, useMemo, useRef } from 'react';
import type { VoiceUIState, VoiceState } from '../types/assistant';

interface VoiceButtonProps {
  status: VoiceUIState | VoiceState;
  onInteraction: () => void;
  onStopRecording?: () => void;
  onRetry?: () => void;
  executingMessage?: string | null;
}

interface StateDetails {
  label: string;
  sublabel: string;
  ariaLabel: string;
}

const statusConfig: Record<VoiceUIState, StateDetails> = {
  idle: {
    label: 'Ready',
    sublabel: 'Tap to speak • സംസാരിക്കാൻ ടാപ്പ് ചെയ്യൂ',
    ariaLabel: 'Start voice input',
  },
  listening: {
    label: 'Listening...',
    sublabel: 'Listening to your voice • കേൾക്കുന്നു...',
    ariaLabel: 'Stop recording',
  },
  processing: {
    label: 'Understanding...',
    sublabel: 'Preparing response • മറുപടി തയ്യാറാക്കുന്നു...',
    ariaLabel: 'Generating response',
  },
  thinking: {
    label: 'Understanding...',
    sublabel: 'Analyzing • വിവരങ്ങൾ വിശകലനം ചെയ്യുന്നു...',
    ariaLabel: 'Thinking',
  },
  searching: {
    label: 'Searching the web...',
    sublabel: 'Finding current information • വെബിൽ തിരയുന്നു...',
    ariaLabel: 'Searching the web',
  },
  tool_running: {
    label: 'Understanding...',
    sublabel: 'Processing • പ്രവർത്തിക്കുന്നു...',
    ariaLabel: 'Running assistant action',
  },
  speaking: {
    label: 'Speaking...',
    sublabel: 'VAANI is speaking • സംസാരിക്കുന്നു...',
    ariaLabel: 'VAANI is speaking',
  },
  error: {
    label: 'Something went wrong',
    sublabel: 'Please try again • വീണ്ടും ശ്രമിക്കാം',
    ariaLabel: 'An error occurred. Tap to retry.',
  },
  retry: {
    label: 'Ready to retry',
    sublabel: 'Tap to retry • വീണ്ടും ശ്രമിക്കാം',
    ariaLabel: 'Retry previous request',
  },
};

export default function VoiceButton({
  status,
  onInteraction,
  onStopRecording,
  onRetry,
  executingMessage,
}: VoiceButtonProps) {
  const [ripple, setRipple] = useState(false);
  const lastClickTimeRef = useRef(0);

  // Normalize legacy status strings
  const normalizedStatus: VoiceUIState = useMemo(() => {
    if ((status as string) === 'ready') return 'idle';
    if ((status as string) === 'executing') return 'processing';
    return (status as VoiceUIState) || 'idle';
  }, [status]);

  const config = statusConfig[normalizedStatus] || statusConfig.idle;

  const isIdle = normalizedStatus === 'idle';
  const isListening = normalizedStatus === 'listening';
  const isProcessing = normalizedStatus === 'processing';
  const isThinking = normalizedStatus === 'thinking';
  const isSearching = normalizedStatus === 'searching';
  const isToolRunning = normalizedStatus === 'tool_running';
  const isSpeaking = normalizedStatus === 'speaking';
  const isError = normalizedStatus === 'error';
  const isRetry = normalizedStatus === 'retry';

  const isBusy = isProcessing || isThinking || isSearching || isToolRunning;

  const handleClick = useCallback(() => {
    // Rapid double-click protection (Safeguard 24)
    const now = Date.now();
    if (now - lastClickTimeRef.current < 400) {
      console.warn('[VoiceButton] Rapid double-click suppressed');
      return;
    }
    lastClickTimeRef.current = now;

    if (isListening) {
      if (onStopRecording) onStopRecording();
      return;
    }

    if (isBusy || isSpeaking) return;

    if ((isError || isRetry) && onRetry) {
      onRetry();
      return;
    }

    setRipple(true);
    setTimeout(() => setRipple(false), 300);
    onInteraction();
  }, [isListening, isBusy, isSpeaking, isError, isRetry, onStopRecording, onRetry, onInteraction]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div className="flex flex-col items-center gap-4 w-full select-none">
      {/* Hero Microphone Container with Multi-Layered Glass Structure */}
      <div className="relative flex items-center justify-center p-6 sm:p-8">
        {/* Layer 1: Ambient Outer Glow Blob */}
        <div
          className={`absolute w-52 h-52 sm:w-60 sm:h-60 rounded-full pointer-events-none transition-all duration-700 ${
            isListening
              ? 'bg-rose-400/35 blur-2xl scale-110'
              : isSpeaking
                ? 'bg-purple-400/35 blur-2xl scale-105'
                : isSearching
                  ? 'bg-sky-400/35 blur-2xl scale-105'
                  : isError
                    ? 'bg-amber-400/25 blur-2xl'
                    : 'bg-indigo-300/30 blur-2xl'
          }`}
          aria-hidden="true"
        />

        {/* Layer 2: Translucent Glass Ring with State Animations */}
        <div
          className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full mic-glass-ring flex items-center justify-center transition-all duration-500 ${
            isIdle ? 'animate-mic-breathe' : ''
          }`}
        >
          {/* LISTENING: Real Expanding Pulse Rings */}
          {isListening && (
            <>
              <div
                className="absolute inset-0 rounded-full border-2 border-red-400/40 animate-listening-ring-1 pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="absolute inset-0 rounded-full border-2 border-rose-400/50 animate-listening-ring-2 pointer-events-none"
                aria-hidden="true"
              />
            </>
          )}

          {/* PROCESSING: Smooth Rotating Ring */}
          {isProcessing && (
            <div
              className="absolute -inset-1 rounded-full border-2 border-transparent border-t-indigo-500 border-r-purple-500 animate-processing-spin pointer-events-none"
              aria-hidden="true"
            />
          )}

          {/* SEARCHING: Orbiting Animated Pulse */}
          {isSearching && (
            <div
              className="absolute -inset-1 rounded-full border-2 border-dashed border-sky-400 animate-search-orbit pointer-events-none"
              aria-hidden="true"
            />
          )}

          {/* SPEAKING: Harmonious audio pulse ring */}
          {isSpeaking && (
            <div
              className="absolute -inset-1.5 rounded-full border border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.35)] animate-speaking-pulse pointer-events-none"
              aria-hidden="true"
            />
          )}

          {/* Layer 3: Dynamic Gradient Ring */}
          <div
            className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full p-[3px] transition-all duration-300 shadow-md ${
              isListening
                ? 'bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500'
                : isProcessing
                  ? 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500'
                  : isSearching
                    ? 'bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500'
                    : isSpeaking
                      ? 'bg-gradient-to-tr from-purple-500 via-indigo-600 to-fuchsia-500'
                      : isError || isRetry
                        ? 'bg-gradient-to-tr from-amber-400 via-orange-500 to-amber-600'
                        : 'bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600'
            }`}
          >
            {/* Layer 4: Center Microphone Button (Blue → Purple Gradient) */}
            <button
              id="voice-button"
              type="button"
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              aria-label={config.ariaLabel}
              aria-live="polite"
              tabIndex={0}
              className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-300 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/80 focus-visible:ring-offset-2 ${
                isListening
                  ? 'bg-gradient-to-br from-red-500 via-rose-600 to-red-700 text-white scale-100 shadow-xl shadow-red-500/35 hover:brightness-105 active:scale-95'
                  : isBusy
                    ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white cursor-wait shadow-lg shadow-indigo-500/30'
                    : isSpeaking
                      ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 text-white shadow-xl shadow-purple-500/35 cursor-default'
                      : isError || isRetry
                        ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-600 text-white shadow-lg shadow-amber-500/30 hover:brightness-105 active:scale-95'
                        : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white hover:scale-[1.03] hover:shadow-2xl hover:shadow-indigo-500/40 active:scale-95 shadow-xl shadow-indigo-500/30'
              } ${ripple ? 'scale-95' : ''}`}
            >
              {/* LISTENING: Square STOP Icon */}
              {isListening && (
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <rect x="5" y="5" width="14" height="14" rx="3" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                    STOP
                  </span>
                </div>
              )}

              {/* IDLE: Crisp SVG Microphone Icon */}
              {isIdle && (
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white drop-shadow-sm transition-transform pointer-events-none"
                  aria-hidden="true"
                >
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              )}

              {/* PROCESSING: Clean rotating spinner */}
              {isProcessing && (
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white animate-spin pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                </svg>
              )}

              {/* THINKING: Soft pulsing brain / understanding indicator */}
              {isThinking && (
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white animate-pulse pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                </svg>
              )}

              {/* SEARCHING: Web search magnifying indicator */}
              {isSearching && (
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white animate-pulse pointer-events-none"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}

              {/* TOOL_RUNNING: Action icon */}
              {isToolRunning && (
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white animate-spin pointer-events-none"
                  aria-hidden="true"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              )}

              {/* SPEAKING: Audio Speaker Waves */}
              {isSpeaking && (
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white pointer-events-none"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}

              {/* ERROR / RETRY: Retry circular arrow */}
              {(isError || isRetry) && (
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white pointer-events-none"
                  aria-hidden="true"
                >
                  <path d="M21.5 2v6h-6" />
                  <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Auxiliary Action Controls */}
      {/* 1. LISTENING: Dedicated Clean STOP Button */}
      {isListening && (
        <button
          id="stop-recording-btn"
          type="button"
          onClick={onStopRecording}
          aria-label="Stop recording voice input"
          className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold text-xs px-6 py-2.5 rounded-full shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer border border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-white" />
          <span>STOP RECORDING</span>
        </button>
      )}

      {/* 2. ERROR / RETRY: Dedicated Clean RETRY Button */}
      {(isError || isRetry) && onRetry && (
        <button
          id="retry-request-btn"
          type="button"
          onClick={onRetry}
          aria-label="Retry voice request"
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs px-6 py-2.5 rounded-full shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer border border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6" />
            <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>RETRY REQUEST</span>
        </button>
      )}

      {/* Status Typography */}
      {!isListening && (
        <div className="text-center px-4 max-w-sm">
          <p className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
            {isBusy && executingMessage ? executingMessage : config.label}
          </p>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium leading-relaxed">
            {config.sublabel}
          </p>
        </div>
      )}
    </div>
  );
}
