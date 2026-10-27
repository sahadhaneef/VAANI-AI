import { useState, useCallback, useRef, useEffect } from 'react';
import type { VoiceUIState, AIAnalysis as AIAnalysisType, VoiceSession } from '../types/assistant';
import Header from '../components/Header';
import VoiceButton from '../components/VoiceButton';
import VoiceTranscript from '../components/VoiceTranscript';
import AudioWaveform from '../components/AudioWaveform';
import { speechService } from '../services/speechService';
import { ttsService } from '../services/ttsService';
import { aiService } from '../services/aiService';

/**
 * Home — Design 3: Gradient + Glassmorphism Light UI Redesign
 *
 * Voice-first interaction model:
 * USER → MICROPHONE → STT → /api/assistant → DISPLAY RESPONSE & TTS
 *
 * Architecture Safeguards:
 * - Pure Voice Assistant UI: Zero text inputs, chat textboxes, send buttons, or conversation history lists.
 * - Hero Microphone: Multi-layer glassmorphism structure with real-state animations.
 * - Safe Audio Waveform: Synchronized with microphone & TTS state without compromising audio playback.
 * - Dedicated Refresh / New Session: Safely cancels active operations and resets UI without wiping persistent SQLite memory.
 * - Developer Tools Removed: Completely hidden from production UI while preserving all console logs and backend tests.
 */

const REQUEST_TIMEOUT_MS = 30_000;

export default function Home() {
  // Single source of truth for UI state
  const [uiState, setUiState] = useState<VoiceUIState>('idle');
  const [userTranscript, setUserTranscript] = useState<string | null>(null);
  const [aiResponseText, setAiResponseText] = useState<string | null>(null);
  const [, setAnalysis] = useState<AIAnalysisType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setLatencyInfo] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);

  // Session ID for Phase 5 server-owned conversational context
  const sessionIdRef = useRef<string>('vaani_session_default');

  // Guard against duplicate in-flight requests
  const requestInFlight = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize session ID and cleanup microphone/TTS upon unmount (Safeguard 17)
  useEffect(() => {
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return () => {
      speechService.cancelListening();
      ttsService.stop();
    };
  }, []);

  /* ── Save session history (Internal persistence for /history) ─── */
  const saveSessionToHistory = (spoken: string, response: string) => {
    try {
      const existingStr = localStorage.getItem('vaani_voice_sessions');
      const existing: VoiceSession[] = existingStr ? JSON.parse(existingStr) : [];
      const newSession: VoiceSession = {
        id: `vs-${Date.now()}`,
        timestamp: new Date(),
        transcript: spoken,
        rawTranscript: spoken,
        aiResponse: response,
        language: spoken.match(/[\u0D00-\u0D7F]/) ? 'ml' : 'mixed',
        intent: 'VOICE_ASSISTANT_QUERY',
        sentiment: 'NEUTRAL',
      };
      localStorage.setItem(
        'vaani_voice_sessions',
        JSON.stringify([newSession, ...existing].slice(0, 30))
      );
    } catch (e) {
      console.warn('Failed to save session history:', e);
    }
  };

  /* ── Check if query is likely to require real-time search ─── */
  const isSearchCandidate = (text: string): boolean => {
    const t = (text || '').toLowerCase();
    return (
      t.includes('search') ||
      t.includes('latest') ||
      t.includes('version') ||
      t.includes('news') ||
      t.includes('today') ||
      t.includes('current') ||
      t.includes('documentation') ||
      t.includes('online') ||
      t.includes('ലേറ്റസ്റ്റ്') ||
      t.includes('വേർഷൻ') ||
      t.includes('വാർത്തകൾ') ||
      t.includes('ഇപ്പോൾ') ||
      t.includes('തിരയുക') ||
      t.includes('സെർച്ച്')
    );
  };

  /* ── Dedicated Refresh / New Voice Session Handler (Section 4) ─── */
  const handleNewSession = useCallback(() => {
    console.log('[SESSION] Starting a fresh voice session...');
    // 1. Stop active microphone recording
    if (speechService.isRecording()) {
      speechService.cancelListening();
    }
    // 2. Stop current TTS playback immediately
    ttsService.stop();
    // 3. Cancel active assistant request safely
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestInFlight.current = false;
    // 4. Clear current temporary transcript
    setUserTranscript(null);
    // 5. Clear current temporary response
    setAiResponseText(null);
    // 6. Clear temporary error state & audio notices
    setErrorMessage(null);
    setTtsError(null);
    setShowPlayButton(false);
    setLatencyInfo(null);
    setAnalysis(null);
    // 7. Reset UI state to idle
    setUiState('idle');
    // 8. Start a fresh client voice session (WITHOUT deleting database, memory, or reminders!)
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[SESSION] New session initialized: ${sessionIdRef.current}`);
  }, []);

  /* ── Execute API Request (Preserving Phase 1 Verified Pipeline) ─── */
  const executeAssistantRequest = async (
    spoken: string,
    sttLatency: number,
    t_sttStart: number,
    reqId: string
  ) => {
    // 2. PROCESSING STATE — Active request to /api/assistant
    setUiState('processing');
    requestInFlight.current = true;

    // Transition processing -> searching for current information / search queries
    let searchTimer: any = null;
    if (isSearchCandidate(spoken)) {
      searchTimer = setTimeout(() => {
        if (requestInFlight.current) {
          console.log(`[PIPELINE ${reqId}] Live Transition: processing -> searching`);
          setUiState('searching');
        }
      }, 700);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const t_apiStart = performance.now();
    console.log(`[PIPELINE ${reqId}] API request started: POST /api/assistant { message: "${spoken}", sessionId: "${sessionIdRef.current}" }`);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: spoken,
          sessionId: sessionIdRef.current,
          requestId: reqId,
        }),
        signal: controller.signal,
      });

      if (searchTimer) clearTimeout(searchTimer);
      clearTimeout(timeoutId);
      const t_apiEnd = performance.now();
      const apiLatency = Math.round(t_apiEnd - t_apiStart);
      const totalLatency = Math.round(t_apiEnd - t_sttStart);

      const data = await res.json().catch(() => null);
      console.log(`[PIPELINE ${reqId}] API response (${apiLatency}ms): HTTP ${res.status}`, JSON.stringify(data)?.substring(0, 200));

      requestInFlight.current = false;
      abortControllerRef.current = null;

      if (!res.ok || (data && data.ok === false)) {
        const errType = data?.errorType || 'UNKNOWN_ERROR';
        console.log(`[PIPELINE ${reqId}] API ERROR: ${errType} — ${data?.message || ''}`);
        let userError = '';
        switch (errType) {
          case 'CONFIGURATION_ERROR':
            userError = 'AI സേവനം ക്രമീകരിച്ചിട്ടില്ല.';
            break;
          case 'AUTHENTICATION_ERROR':
            userError = 'AI സേവനവുമായി ബന്ധപ്പെടുന്നതിൽ ഒരു പ്രശ്നമുണ്ട്.';
            break;
          case 'SEARCH_RATE_LIMIT':
          case 'AI_RATE_LIMIT':
            userError = 'AI സേവനം ഇപ്പോൾ തിരക്കിലാണ്. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കാം.';
            break;
          case 'SEARCH_TIMEOUT':
          case 'AI_TIMEOUT':
            userError = 'മറുപടി ലഭിക്കാൻ കൂടുതൽ സമയം എടുത്തു. വീണ്ടും ശ്രമിക്കാം.';
            break;
          case 'SEARCH_API_ERROR':
          case 'AI_API_ERROR':
            userError = 'AI സേവനത്തിൽ ഒരു പ്രശ്നമുണ്ട്. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കാം.';
            break;
          case 'NETWORK_ERROR':
            userError = 'ഇന്റർനെറ്റ് കണക്ഷൻ ലഭ്യമായെന്ന് ഉറപ്പുവരുത്തുക.';
            break;
          default:
            userError = 'ഇപ്പോൾ ഒരു സാങ്കേതിക പ്രശ്നം സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കാം.';
        }
        // Strictly clear any previous or stale AI response
        setAiResponseText(null);
        setErrorMessage(userError);
        setUiState('error');
      } else {
        const outputText = data?.answer || 'അതിനെക്കുറിച്ച് എനിക്ക് ഉറപ്പുള്ള വിവരം ഇല്ല.';
        console.log(`[PIPELINE ${reqId}] SUCCESS — Answer: "${outputText.substring(0, 100)}..."`);
        setAiResponseText(outputText);
        setErrorMessage(null);
        saveSessionToHistory(spoken, outputText);
        setTtsError(null);
        setShowPlayButton(false);

        // Record understanding metadata in aiService
        if (data?.metadata) {
          aiService.setLastUnderstanding(spoken, outputText, data.metadata);
          const meta = data.metadata;
          setAnalysis({
            intent: meta.intent || 'VOICE_ASSISTANT_QUERY',
            emotion: 'Neutral',
            confidence: 95,
            action: meta.futureToolIntent || 'Spoken Response',
            contextStatus: meta.contextualFollowUp ? 'Active' : 'Idle',
            language: meta.languageMode || 'mixed',
            metadata: meta,
          });

          if (meta.searchDiagnostics?.searched) {
            console.log(`[PIPELINE ${reqId}] Web search was performed.`);
          }
        }

        // TTS Pipeline Execution
        const t_ttsStart = performance.now();
        console.log('[TTS] TTS REQUEST START');
        console.log(`[TTS] text = "${outputText}"`);

        ttsService.speak(
          outputText,
          undefined,
          () => {
            // onStart: actual audio playback has started
            const t_playStart = performance.now();
            const ttsAudioLatency = Math.round(t_playStart - t_ttsStart);
            console.log(`[PIPELINE ${reqId}] TTS PLAYBACK START (${ttsAudioLatency}ms)`);
            setUiState('speaking');
            setShowPlayButton(false);
            setTtsError(null);
          },
          () => {
            // onEnd: audio playback ended
            console.log(`[PIPELINE ${reqId}] TTS PLAYBACK SUCCESS (finished)`);
            setUiState('idle');
          },
          (err) => {
            // onError: playback failed or autoplay blocked
            console.warn(`[PIPELINE ${reqId}] TTS PLAYBACK FAILURE:`, err);
            setUiState('idle');
            if (ttsService.isAutoplayBlocked()) {
              setShowPlayButton(true);
            } else {
              setTtsError(err.message || 'Voice synthesis failed');
            }
          },
          reqId
        );
      }

      const latencyStr = `STT: ${sttLatency}ms | API: ${apiLatency}ms | Total: ${totalLatency}ms`;
      console.log(`[PIPELINE ${reqId}] LATENCY: ${latencyStr}`);
      setLatencyInfo(latencyStr);
    } catch (fetchErr: any) {
      if (searchTimer) clearTimeout(searchTimer);
      clearTimeout(timeoutId);
      requestInFlight.current = false;
      abortControllerRef.current = null;

      // Strictly clear any previous or stale AI response
      setAiResponseText(null);

      if (fetchErr.name === 'AbortError') {
        console.warn(`[PIPELINE ${reqId}] Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
        setErrorMessage('മറുപടി ലഭിക്കാൻ കൂടുതൽ സമയം എടുത്തു. വീണ്ടും ശ്രമിക്കാം.');
      } else {
        console.error(`[PIPELINE ${reqId}] Fetch error:`, fetchErr);
        setErrorMessage('ഇപ്പോൾ ഒരു സാങ്കേതിക പ്രശ്നം സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കാം.');
      }
      setUiState('error');
    }
  };

  /* ── Stop Recording Handler ─── */
  const handleStopRecording = useCallback(() => {
    if (speechService.isRecording()) {
      console.log('[PIPELINE] User triggered manual STOP recording');
      setUiState('processing');
      speechService.stopListening();
    }
  }, []);

  /* ── Voice Interaction: STT → /api/assistant → Display ──── */
  const handleVoiceInteraction = useCallback(async () => {
    // Duplicate request guard
    if (requestInFlight.current || speechService.isRecording()) {
      console.warn('[PIPELINE] Duplicate request or active recording blocked');
      return;
    }

    // Stop and invalidate any ongoing audio immediately
    ttsService.stop();
    setTtsError(null);
    setShowPlayButton(false);

    // Clear stale state immediately upon starting new interaction
    setUserTranscript(null);
    setAiResponseText(null);
    setAnalysis(null);
    setErrorMessage(null);
    setLatencyInfo(null);

    // 1. LISTENING STATE — Authoritative audio capture
    setUiState('listening');
    const t_sttStart = performance.now();
    const reqId = `req_${Date.now()}`;
    console.log(`\n========== [PIPELINE ${reqId}] START ==========`);

    try {
      const speechResult = await speechService.startListening((partialText) => {
        setUserTranscript(partialText);
      }, reqId);

      const t_sttEnd = performance.now();
      const sttLatency = Math.round(t_sttEnd - t_sttStart);

      const spoken = speechResult.rawTranscript || speechResult.transcript || '';
      setUserTranscript(spoken);
      console.log(`[PIPELINE ${reqId}] STT completed (${sttLatency}ms): "${spoken}"`);

      // Handle Microphone / Silent Audio Failures gracefully
      if (speechResult.diagnostics?.failureStage && speechResult.diagnostics.failureStage !== 'NONE') {
        const errorMsg =
          speechResult.diagnostics.errorMessage ||
          (speechResult.diagnostics.failureStage === 'MICROPHONE_FAILURE'
            ? 'Microphone access is required. Please allow microphone permission and try again.'
            : 'No audio detected. Please tap the microphone and speak again.');

        console.warn(`[PIPELINE ${reqId}] Audio capture issue: ${speechResult.diagnostics.failureStage} (${speechResult.diagnostics.errorCode})`);
        setErrorMessage(errorMsg);
        setUiState('error');
        return;
      }

      if (!spoken || spoken.trim().length === 0) {
        setErrorMessage('ശബ്ദം വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കൂ.');
        setUiState('error');
        return;
      }

      // Execute request directly via Phase 1 verified pipeline
      await executeAssistantRequest(spoken, sttLatency, t_sttStart, reqId);
    } catch (error: any) {
      console.error(`[PIPELINE] Voice interaction failure:`, error);
      setErrorMessage(error.message || 'Voice interaction error');
      setUiState('error');
      requestInFlight.current = false;
    }

    console.log(`========== [PIPELINE] END ==========\n`);
  }, []);

  /* ── Retry Handler ─── */
  const handleRetry = useCallback(async () => {
    if (requestInFlight.current || speechService.isRecording()) {
      console.warn('[PIPELINE] Retry blocked: request already in flight or recording active');
      return;
    }
    console.log('[PIPELINE] User triggered RETRY');
    ttsService.stop();
    setTtsError(null);
    setShowPlayButton(false);
    if (userTranscript && userTranscript.trim().length > 0) {
      setAiResponseText(null);
      setErrorMessage(null);
      const reqId = `retry_${Date.now()}`;
      await executeAssistantRequest(userTranscript, 0, performance.now(), reqId);
    } else {
      handleVoiceInteraction();
    }
  }, [userTranscript, handleVoiceInteraction]);

  /* ── Manual Play Audio Handler (for Autoplay fallback) ─── */
  const handlePlayAudio = useCallback(async () => {
    console.log('[TTS] Manual Play Response button clicked');
    const started = await ttsService.playCurrentAudio();
    if (started) {
      setUiState('speaking');
      setShowPlayButton(false);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-dvh bg-gradient-to-b from-[#f8faff] via-[#f1f5fd] to-[#f8f5fc] text-slate-900 select-none overflow-x-hidden relative">
      {/* Ambient Layered Background Lighting Blobs (Design 3 Atmospheric Lighting) */}
      <div
        className="absolute top-12 left-1/2 -translate-x-1/2 w-[500px] sm:w-[650px] h-[500px] sm:h-[650px] bg-gradient-to-br from-blue-200/40 via-purple-200/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/3 left-10 w-72 h-72 bg-sky-200/25 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 right-10 w-80 h-80 bg-purple-200/25 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Top Header with VAANI Branding, Live Status Pill & Dedicated Refresh Button */}
      <Header status={uiState} onNewSession={handleNewSession} />

      {/* Main Voice Centered Canvas */}
      <main className="flex-1 flex flex-col items-center justify-start max-w-2xl w-full mx-auto px-4 py-6 sm:py-10 gap-6 z-10">
        {/* Dominant Circular Central Hero Microphone */}
        <VoiceButton
          status={uiState}
          onInteraction={handleVoiceInteraction}
          onStopRecording={handleStopRecording}
          onRetry={handleRetry}
        />

        {/* Dynamic Safe Minimal Audio Waveform */}
        <AudioWaveform status={uiState} />

        {/* Read-Only Informational Glassmorphic Voice Transcript & Response Cards */}
        <VoiceTranscript
          userTranscript={userTranscript}
          aiResponse={aiResponseText}
          status={uiState}
          errorMessage={errorMessage}
          ttsError={ttsError}
          showPlayButton={showPlayButton}
          onPlayAudio={handlePlayAudio}
          onRetry={handleRetry}
        />
      </main>

      {/* Clean Subtle Footer Branding */}
      <footer className="w-full py-4 px-4 text-center mt-auto border-t border-slate-200/60 glass-panel">
        <p className="text-[11px] sm:text-xs text-slate-500 font-medium tracking-wide">
          VAANI AI • Malayalam Intelligent Voice Assistant
        </p>
      </footer>
    </div>
  );
}
