import { useMemo } from 'react';
import type { VoiceUIState, VoiceState } from '../types/assistant';

interface VoiceTranscriptProps {
  userTranscript: string | null;
  aiResponse: string | null;
  status?: VoiceUIState | VoiceState;
  isProcessing?: boolean;
  isSpeaking?: boolean;
  errorMessage?: string | null;
  ttsError?: string | null;
  showPlayButton?: boolean;
  onPlayAudio?: () => void;
  onRetry?: () => void;
}

export default function VoiceTranscript({
  userTranscript,
  aiResponse,
  status,
  isProcessing: isProcessingProp,
  isSpeaking: isSpeakingProp,
  errorMessage,
  ttsError,
  showPlayButton,
  onPlayAudio,
  onRetry,
}: VoiceTranscriptProps) {
  const normalizedStatus = useMemo(() => {
    if ((status as string) === 'executing') return 'processing';
    if ((status as string) === 'ready') return 'idle';
    return (status as VoiceUIState) || 'idle';
  }, [status]);

  const isSearching = normalizedStatus === 'searching';
  const isProcessing = isProcessingProp ?? (normalizedStatus === 'processing' || normalizedStatus === 'thinking');
  const isSpeaking = isSpeakingProp ?? normalizedStatus === 'speaking';
  const isError = normalizedStatus === 'error' && !!errorMessage;

  // Clean error message so technical error codes or stack traces are never shown to user
  const sanitizedError = useMemo(() => {
    if (!errorMessage) return null;
    const lower = errorMessage.toLowerCase();
    if (
      lower.includes('429') ||
      lower.includes('econnreset') ||
      lower.includes('resource_exhausted') ||
      lower.includes('fetch error') ||
      lower.includes('failed to fetch')
    ) {
      return 'AI സേവനം ഇപ്പോൾ തിരക്കിലാണ്. ദയവായി അല്പം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.';
    }
    return errorMessage;
  }, [errorMessage]);

  // Render nothing if there is no transcript, no response, no active processing/searching, and no error
  if (!userTranscript && !aiResponse && !isProcessing && !isSearching && !isSpeaking && !isError) {
    return null;
  }

  return (
    <div
      id="voice-transcript-panel"
      className="w-full max-w-xl mx-auto space-y-4 px-2 select-none"
      aria-live="polite"
    >
      {/* 1. Captured Speech Glassmorphism Card */}
      {userTranscript && (
        <div className="glass-card-speech rounded-2xl p-4 sm:p-5 animate-card-entrance">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-100/70">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
              <span aria-hidden="true">🎙</span>
              <span>CAPTURED SPEECH</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Spoken Query</span>
          </div>
          <p className="text-slate-800 text-sm sm:text-base font-medium leading-relaxed select-text break-words">
            "{userTranscript}"
          </p>
        </div>
      )}

      {/* 2. Live Searching State (Phase 7 Google Search Grounding Feedback) */}
      {isSearching && !aiResponse && (
        <div className="glass-panel rounded-2xl p-4 border border-sky-200/80 bg-sky-50/70 animate-card-entrance shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-sky-600">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping absolute" />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-sky-800">
                Searching the web...
              </p>
              <p className="text-[11px] text-sky-600">
                Finding the latest verified information
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Live Processing State Indicator */}
      {isProcessing && !isSearching && !aiResponse && (
        <div className="glass-panel rounded-2xl p-4 border border-indigo-200/70 bg-indigo-50/60 animate-card-entrance shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-indigo-900">
                Understanding your query...
              </p>
              <p className="text-[11px] text-indigo-600">
                Formulating a spoken Malayalam response
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. VAANI Response Glassmorphism Card */}
      {!isError && aiResponse && (
        <div
          className={`glass-card-response rounded-2xl p-4 sm:p-5 animate-card-entrance ${
            isSpeaking ? 'glass-card-response-speaking' : ''
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-100/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-purple-700 uppercase">
              <span aria-hidden="true">🔊</span>
              <span>VAANI RESPONSE</span>
            </div>
            {isSpeaking && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Speaking
              </span>
            )}
          </div>

          <div className="text-slate-800 text-sm sm:text-base font-normal leading-relaxed select-text whitespace-pre-wrap break-words">
            {aiResponse}
          </div>

          {/* Autoplay fallback button (only shown if browser blocks audio autoplay) */}
          {showPlayButton && onPlayAudio && (
            <button
              id="play-response-btn"
              type="button"
              onClick={onPlayAudio}
              className="mt-3.5 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              aria-label="Play spoken response"
            >
              <span aria-hidden="true">🔊</span>
              <span>Play Response</span>
            </button>
          )}

          {ttsError && (
            <div className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5 mt-3 pt-2 border-t border-amber-200/50">
              <span aria-hidden="true">⚠️</span>
              <span>Audio notice: {ttsError}</span>
            </div>
          )}
        </div>
      )}

      {/* 5. Error Notice Glassmorphism Card */}
      {isError && sanitizedError && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-200 bg-amber-50/80 animate-card-entrance shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-600 text-lg leading-none mt-0.5">⚠️</span>
              <div>
                <p className="text-xs sm:text-sm font-bold text-amber-900">
                  Something went wrong
                </p>
                <p className="text-xs sm:text-sm text-amber-800 mt-1 leading-relaxed">
                  {sanitizedError}
                </p>
              </div>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
