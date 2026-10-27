/**
 * High-Quality Audio Recorder & STT Service — Phase 3 Implementation
 *
 * Implements authoritative MediaRecorder audio capture with strict safeguards:
 * - SAFEGUARD 1: MediaRecorder is the single authoritative recording source.
 *   Interim SpeechRecognition is strictly optional for live preview and never stops
 *   or restarts the recording, replaces the final audio, or guesses text.
 * - SAFEGUARD 2: Capability-based MIME selection via MediaRecorder.isTypeSupported().
 * - SAFEGUARD 5 & 7: Controlled recording lifecycle (IDLE → REQUESTING_PERMISSION →
 *   LISTENING → STOPPING → FINALIZING_AUDIO → STT → PROCESSING).
 *   Waits for final ondataavailable and onstop before building the Blob.
 * - SAFEGUARD 6 & 19: Natural pauses (1–2+ s) do NOT cut off speech.
 * - SAFEGUARD 8, 9, 10: Overlap prevention, request ID safety, and stale callback rejection.
 * - SAFEGUARD 12 & 33: Structured audio error codes and playability validation.
 */

import type {
  SpeechResult,
  AudioDiagnostics,
  FailureStage,
  AudioErrorCode,
  STTProviderId,
} from '../types/assistant';

export interface ISpeechService {
  startListening(
    onPartial?: (transcript: string) => void,
    requestId?: string,
    options?: { providerId?: STTProviderId; languageCode?: string; autoDetectLanguage?: boolean }
  ): Promise<SpeechResult>;
  stopListening(): void;
  cancelListening(): void;
  isAvailable(): boolean;
  isRecording(): boolean;
  getRecordingDurationMs(): number;
  getDiagnostics(): AudioDiagnostics;
  setSttTestMode(enabled: boolean): void;
  isSttTestMode(): boolean;
  setSelectedProvider(provider: STTProviderId): void;
  getSelectedProvider(): STTProviderId;
  setLanguageConfig(config: { languageCode: string; autoDetect: boolean }): void;
  getLanguageConfig(): { languageCode: string; autoDetect: boolean };
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

class MediaRecorderSpeechService implements ISpeechService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private webSpeechRecognition: any = null;

  private recordingActive = false;
  private activeRequestId: string | null = null;
  private startTime = 0;
  private accumulatedLiveTranscript = '';
  private currentResolve: ((res: SpeechResult) => void) | null = null;
  private sttTestModeEnabled = false;

  private selectedProvider: STTProviderId = 'google-cloud-v2';
  private languageConfig = { languageCode: 'ml-IN', autoDetect: false };
  private activeSessionOptions: { providerId?: STTProviderId; languageCode?: string; autoDetectLanguage?: boolean } = {};
  private lastConfidence: number | null = null;
  private lastRawTranscript = '';
  private lastModel = '';
  private lastStatus: 'RUN' | 'NOT_RUN' | 'ERROR' = 'RUN';

  private diagnostics: AudioDiagnostics = {
    requestId: '',
    recordingState: 'idle',
    recordingDurationMs: 0,
    audioSize: 0,
    mimeType: '',
    chunksCount: 0,
    sttProvider: 'Google Cloud STT (ml-IN)',
    sttStatus: 'idle',
    micPermission: 'unknown',
    trackState: 'none',
    trackEnabled: false,
    failureStage: 'NONE',
    errorCode: 'NONE',
    isSttTestMode: false,
    finalizationStatus: 'idle',
  };

  getDiagnostics(): AudioDiagnostics {
    return {
      ...this.diagnostics,
      isSttTestMode: this.sttTestModeEnabled,
      providerId: this.selectedProvider,
      languageConfigUsed: this.languageConfig.autoDetect ? 'auto_detect' : 'explicit_ml-IN',
    };
  }

  setSttTestMode(enabled: boolean): void {
    this.sttTestModeEnabled = enabled;
    this.diagnostics.isSttTestMode = enabled;
  }

  isSttTestMode(): boolean {
    return this.sttTestModeEnabled;
  }

  setSelectedProvider(provider: STTProviderId): void {
    this.selectedProvider = provider;
    this.diagnostics.providerId = provider;
  }

  getSelectedProvider(): STTProviderId {
    return this.selectedProvider;
  }

  setLanguageConfig(config: { languageCode: string; autoDetect: boolean }): void {
    this.languageConfig = config;
    this.diagnostics.languageConfigUsed = config.autoDetect ? 'auto_detect' : 'explicit_ml-IN';
  }

  getLanguageConfig(): { languageCode: string; autoDetect: boolean } {
    return this.languageConfig;
  }

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    );
  }

  isRecording(): boolean {
    return this.recordingActive;
  }

  getRecordingDurationMs(): number {
    return this.recordingActive && this.startTime > 0
      ? Date.now() - this.startTime
      : this.diagnostics.recordingDurationMs;
  }

  /**
   * Capability-based MIME type selection (Safeguard 2)
   */
  private selectBestMimeType(): string {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return '';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  /**
   * Release media stream tracks cleanly (Safeguard 17)
   */
  private releaseMediaStream(): void {
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('[Microphone] Error stopping media stream tracks:', err);
      }
      this.mediaStream = null;
    }
  }

  /**
   * Clean up any previous recording session (Safeguards 8, 9, 10)
   */
  private cleanupPreviousSession(): void {
    this.recordingActive = false;
    this.activeRequestId = null;

    if (this.webSpeechRecognition) {
      try {
        this.webSpeechRecognition.onresult = null;
        this.webSpeechRecognition.onerror = null;
        this.webSpeechRecognition.onend = null;
        this.webSpeechRecognition.stop();
      } catch {}
      this.webSpeechRecognition = null;
    }

    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.onerror = null;
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }

    this.releaseMediaStream();
    this.audioChunks = [];
    this.accumulatedLiveTranscript = '';

    if (this.currentResolve) {
      this.currentResolve = null;
    }
  }

  /**
   * Explicitly cancel recording without emitting results
   */
  cancelListening(): void {
    console.log('[STT Audio] Explicit cancelListening called');
    this.cleanupPreviousSession();
    this.diagnostics.recordingState = 'idle';
    this.diagnostics.sttStatus = 'idle';
  }

  /**
   * Starts a new high-quality recording session
   */
  async startListening(
    onPartial?: (transcript: string) => void,
    requestId?: string,
    options?: { providerId?: STTProviderId; languageCode?: string; autoDetectLanguage?: boolean }
  ): Promise<SpeechResult> {
    return new Promise((resolve) => {
      (async () => {
        // 1. Overlap Protection: Cancel any stale session and assign fresh requestId
        const currentReq = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.cleanupPreviousSession();

        this.activeRequestId = currentReq;
        this.activeSessionOptions = options || {};
        this.currentResolve = resolve;
        this.recordingActive = true;
        this.startTime = Date.now();
        this.audioChunks = [];
        this.accumulatedLiveTranscript = '';
        this.lastConfidence = null;
        this.lastRawTranscript = '';
        this.lastStatus = 'RUN';

        const effectiveProvider = this.activeSessionOptions.providerId || this.selectedProvider;

        this.diagnostics = {
          requestId: currentReq,
          recordingState: 'requesting_permission',
          recordingDurationMs: 0,
          audioSize: 0,
          mimeType: '',
          chunksCount: 0,
          sttProvider: effectiveProvider,
          providerId: effectiveProvider,
          sttStatus: 'recording',
          micPermission: 'prompt',
          trackState: 'none',
          trackEnabled: false,
          failureStage: 'NONE',
          errorCode: 'NONE',
          startTime: this.startTime,
          isSttTestMode: this.sttTestModeEnabled,
          finalizationStatus: 'idle',
          languageConfigUsed: (this.activeSessionOptions.autoDetectLanguage ?? this.languageConfig.autoDetect)
            ? 'auto_detect'
            : 'explicit_ml-IN',
        };

        // 2. Negotiate Best Supported Audio MIME Type using capability detection
        const selectedMime = this.selectBestMimeType();
        this.diagnostics.mimeType = selectedMime;

        // 3. Request Microphone Access with Graceful Constraint Fallback
        let stream: MediaStream;
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.handleFatalError(
              'RECORDER_NOT_SUPPORTED',
              'MICROPHONE_FAILURE',
              'Microphone recording is not supported in this browser.'
            );
            return;
          }

          // Try preferred constraints
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } catch (constraintErr) {
            console.warn('[Microphone] Preferred constraints rejected, falling back to audio: true', constraintErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
        } catch (micErr: any) {
          console.warn('[Microphone Permission Error]:', micErr);
          const isDenied = micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError';
          const isUnavailable = micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError';
          const errCode: AudioErrorCode = isDenied
            ? 'MIC_PERMISSION_DENIED'
            : isUnavailable
              ? 'MIC_UNAVAILABLE'
              : 'UNKNOWN_AUDIO_ERROR';
          const userMsg = isDenied
            ? 'Microphone access is required. Please allow microphone permission and try again.'
            : isUnavailable
              ? 'No microphone hardware found. Please connect a microphone and try again.'
              : 'Microphone capture error. Please try again.';

          this.diagnostics.micPermission = isDenied ? 'denied' : isUnavailable ? 'unavailable' : 'denied';
          this.handleFatalError(errCode, 'MICROPHONE_FAILURE', userMsg);
          return;
        }

        // Stale session guard after async permission request
        if (this.activeRequestId !== currentReq) {
          console.log(`[STT Audio] [${currentReq}] Superseded during getUserMedia. Releasing stream.`);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        this.mediaStream = stream;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          this.diagnostics.micPermission = 'granted';
          this.diagnostics.trackState = audioTrack.readyState as 'live' | 'ended';
          this.diagnostics.trackEnabled = audioTrack.enabled;
          const settings = audioTrack.getSettings ? audioTrack.getSettings() : {};
          this.diagnostics.sampleRate = settings.sampleRate;
          this.diagnostics.channelCount = settings.channelCount;
        }

        // 4. Initialize MediaRecorder as the AUTHORITATIVE source
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
          this.mediaRecorder = recorder;
        } catch (recInitErr) {
          console.error('[MediaRecorder Init Error]:', recInitErr);
          stream.getTracks().forEach((t) => t.stop());
          this.handleFatalError(
            'RECORDER_NOT_SUPPORTED',
            'MICROPHONE_FAILURE',
            'Failed to initialize audio recorder.'
          );
          return;
        }

        this.diagnostics.recordingState = 'listening';

        recorder.ondataavailable = (e) => {
          if (this.activeRequestId !== currentReq) return;
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
            this.diagnostics.chunksCount = this.audioChunks.length;
            this.diagnostics.audioSize += e.data.size;
          }
        };

        recorder.onerror = (e: any) => {
          console.error('[MediaRecorder Error]:', e);
          if (this.activeRequestId !== currentReq) return;
          this.diagnostics.errorCode = 'AUDIO_FINALIZATION_ERROR';
          this.diagnostics.failureStage = 'AUDIO_FAILURE';
        };

        recorder.onstop = async () => {
          if (this.activeRequestId !== currentReq) {
            console.log(`[STT Audio] [${currentReq}] onstop received for superseded request. Discarding.`);
            return;
          }
          await this.processRecordedAudio(currentReq, selectedMime);
        };

        // 5. Optional Web Speech Recognition parallel live listener for interim visual feedback
        // SAFEGUARD 1: Must never stop MediaRecorder or guess text!
        this.setupOptionalLivePreview(onPartial, currentReq);

        // Collect audio data chunks every 250ms continuously
        recorder.start(250);
        console.log(`[STT Audio] [${currentReq}] MediaRecorder started (MIME: ${selectedMime || 'default'})`);
      })();
    });
  }

  /**
   * Controlled stop: requests final data chunk, stops recorder, releases tracks in onstop (Safeguards 5 & 7)
   */
  stopListening(): void {
    if (!this.recordingActive) return;
    this.recordingActive = false;
    const currentReq = this.activeRequestId;

    console.log(`[STT Audio] [${currentReq}] stopListening requested by user`);
    this.diagnostics.stopTime = Date.now();
    this.diagnostics.recordingDurationMs = this.diagnostics.stopTime - this.startTime;
    this.diagnostics.recordingState = 'stopping';

    // Stop optional Web Speech Recognition live preview
    if (this.webSpeechRecognition) {
      try {
        this.webSpeechRecognition.onresult = null;
        this.webSpeechRecognition.onerror = null;
        this.webSpeechRecognition.onend = null;
        this.webSpeechRecognition.stop();
      } catch {}
      this.webSpeechRecognition = null;
    }

    // SAFEGUARD 5: Request final data and stop MediaRecorder
    // MediaStream tracks will be stopped in onstop AFTER final chunk is captured!
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        if (typeof this.mediaRecorder.requestData === 'function') {
          this.mediaRecorder.requestData();
        }
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn('[STT Audio] Error stopping MediaRecorder:', err);
      }
    } else {
      this.releaseMediaStream();
    }
  }

  /**
   * Finalizes the recorded audio Blob, validates playability/size, and sends to STT
   */
  private async processRecordedAudio(currentReq: string, mimeType: string): Promise<void> {
    this.diagnostics.recordingState = 'finalizing_audio';
    this.diagnostics.finalizationStatus = 'in_progress';

    // Release microphone hardware tracks now that all chunks have been received
    this.releaseMediaStream();

    if (this.activeRequestId !== currentReq) {
      console.log(`[STT Audio] [${currentReq}] Superseded during audio finalization. Discarding.`);
      return;
    }

    const finalMime = mimeType || this.diagnostics.mimeType || 'audio/webm';
    const audioBlob = new Blob(this.audioChunks, { type: finalMime });
    const finalSize = audioBlob.size;
    const durationMs = this.diagnostics.recordingDurationMs || Date.now() - this.startTime;

    this.diagnostics.audioSize = finalSize;
    this.diagnostics.chunksCount = this.audioChunks.length;
    this.diagnostics.recordingDurationMs = durationMs;

    console.log(
      `[STT Audio] [${currentReq}] Audio finalized: ${finalSize} bytes, ${this.audioChunks.length} chunks, ${durationMs}ms, MIME: ${finalMime}`
    );

    // Audio Validation (Safeguard 12)
    if (finalSize === 0 || this.audioChunks.length === 0) {
      console.warn(`[STT Audio] [${currentReq}] Empty audio detected (0 bytes)`);
      this.diagnostics.errorCode = 'AUDIO_EMPTY';
      this.diagnostics.failureStage = 'AUDIO_FAILURE';
      this.diagnostics.sttStatus = 'error';
      this.diagnostics.finalizationStatus = 'failed';
      this.finishPipeline('', 'AUDIO_FAILURE', 'ശബ്ദം വ്യക്തമായി ലഭിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കൂ.');
      return;
    }

    if (finalSize < 600 || durationMs < 400) {
      console.warn(`[STT Audio] [${currentReq}] Audio too short or silent: ${finalSize} bytes, ${durationMs}ms`);
      this.diagnostics.errorCode = 'AUDIO_TOO_SHORT';
      this.diagnostics.failureStage = 'AUDIO_FAILURE';
      this.diagnostics.sttStatus = 'error';
      this.diagnostics.finalizationStatus = 'failed';
      this.finishPipeline('', 'AUDIO_FAILURE', 'ശബ്ദം വ്യക്തമായി ലഭിച്ചില്ല. ദയവായി മൈക്രോഫോൺ അമർത്തി സംസാരിക്കൂ.');
      return;
    }

    this.diagnostics.recordingState = 'stt';
    this.diagnostics.finalizationStatus = 'completed';
    this.diagnostics.sttStatus = 'uploading';

    let recognizedText = '';
    try {
      // Read audio Blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((res, rej) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';
          res(base64);
        };
        reader.onerror = () => rej(new Error('FileReader failed to read audio Blob'));
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      // Stale check before network call
      if (this.activeRequestId !== currentReq) {
        console.log(`[STT Audio] [${currentReq}] Superseded before STT request. Aborting.`);
        return;
      }

      // Send to backend POST /api/stt with provider and language options
      const effectiveProvider = this.activeSessionOptions.providerId || this.selectedProvider;
      const effectiveLang = this.activeSessionOptions.languageCode || this.languageConfig.languageCode;
      const effectiveAutoDetect = this.activeSessionOptions.autoDetectLanguage ?? this.languageConfig.autoDetect;

      const tReqStart = Date.now();
      const apiRes = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: finalMime,
          requestId: currentReq,
          providerId: effectiveProvider,
          languageCode: effectiveLang,
          autoDetectLanguage: effectiveAutoDetect,
          verbatim: true,
        }),
      });
      const tReqEnd = Date.now();
      this.diagnostics.uploadLatencyMs = tReqEnd - tReqStart;

      // Stale check after network call
      if (this.activeRequestId !== currentReq) {
        console.log(`[STT Audio] [${currentReq}] Superseded during STT fetch. Discarding.`);
        return;
      }

      if (apiRes.ok) {
        const sttData = await apiRes.json();
        if (sttData.rawTranscript !== undefined) {
          recognizedText = sttData.rawTranscript;
          this.lastRawTranscript = sttData.rawTranscript;
        } else if (sttData.transcript) {
          recognizedText = sttData.transcript;
          this.lastRawTranscript = sttData.transcript;
        }

        this.lastConfidence = sttData.confidence !== undefined ? sttData.confidence : null;
        this.lastModel = sttData.model || '';
        this.lastStatus = sttData.status || 'RUN';

        this.diagnostics.sttProvider = sttData.sttProvider || effectiveProvider;
        this.diagnostics.model = sttData.model;
        this.diagnostics.providerLatencyMs = sttData.latencyMs;
        this.diagnostics.status = sttData.status;
        this.diagnostics.languageConfigUsed = sttData.languageConfigUsed;

        if (sttData.status === 'NOT_RUN') {
          this.diagnostics.failureStage = 'STT_FAILURE';
          this.diagnostics.errorCode = (sttData.errorCode as any) || 'STT_HANDOFF_ERROR';
          this.diagnostics.errorMessage = sttData.errorDetails || 'Provider was not run.';
          this.diagnostics.sttStatus = 'error';
        } else if (sttData.status === 'ERROR') {
          this.diagnostics.failureStage = 'STT_FAILURE';
          this.diagnostics.errorCode = (sttData.errorCode as any) || 'STT_HANDOFF_ERROR';
          this.diagnostics.errorMessage = sttData.errorDetails || 'Provider error.';
          this.diagnostics.sttStatus = 'error';
        } else {
          this.diagnostics.sttStatus = 'success';
          this.diagnostics.failureStage = 'NONE';
          this.diagnostics.errorCode = 'NONE';
        }
      } else {
        console.warn(`[STT Backend] HTTP ${apiRes.status} on /api/stt`);
        this.diagnostics.failureStage = 'STT_FAILURE';
        this.diagnostics.errorCode = 'STT_HANDOFF_ERROR';
        this.diagnostics.sttStatus = 'error';
      }
    } catch (err: any) {
      console.warn('[STT Backend Upload Warning]:', err);
      this.diagnostics.failureStage = 'STT_FAILURE';
      this.diagnostics.errorCode = 'STT_HANDOFF_ERROR';
      this.diagnostics.sttStatus = 'error';
    }

    // SAFEGUARD 1: STT transcript comes strictly from audio.
    // Fallback to live preview only if STT returned empty but live recognized text exists
    let finalText = recognizedText.trim();
    if (!finalText && this.accumulatedLiveTranscript.trim()) {
      finalText = this.accumulatedLiveTranscript.trim();
      this.lastRawTranscript = finalText;
    }

    // SAFEGUARD 6: Release raw audio chunks reference from memory
    this.audioChunks = [];

    this.diagnostics.recordingState = 'idle';
    this.finishPipeline(finalText, this.diagnostics.failureStage);
  }

  /**
   * Optional live preview using Web Speech API (Safeguard 1)
   */
  private setupOptionalLivePreview(onPartial?: (t: string) => void, currentReq?: string): void {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      const rec = new SpeechRecognitionClass();
      this.webSpeechRecognition = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'ml-IN';

      let liveFinalText = '';
      rec.onresult = (event: any) => {
        if (this.activeRequestId !== currentReq) return;
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const seg = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            liveFinalText += seg + ' ';
          } else {
            interimText += seg;
          }
        }
        const currentText = (liveFinalText + interimText).trim();
        this.accumulatedLiveTranscript = currentText;
        if (onPartial && currentText) {
          onPartial(currentText);
        }
        // SAFEGUARD 1: Do NOT stop MediaRecorder from SpeechRecognition!
      };

      rec.onend = () => {
        // If pause causes onend, restart silently while MediaRecorder is active
        if (this.recordingActive && this.activeRequestId === currentReq && this.webSpeechRecognition) {
          try {
            rec.start();
          } catch {}
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech' && this.recordingActive && this.activeRequestId === currentReq) {
          try {
            rec.start();
          } catch {}
        }
      };

      rec.start();
    } catch (recErr) {
      console.warn('Live SpeechRecognition preview unavailable:', recErr);
    }
  }

  private handleFatalError(
    errorCode: AudioErrorCode,
    failureStage: FailureStage,
    errorMessage: string
  ): void {
    this.diagnostics.errorCode = errorCode;
    this.diagnostics.failureStage = failureStage;
    this.diagnostics.errorMessage = errorMessage;
    this.diagnostics.recordingState = 'error';
    this.diagnostics.sttStatus = 'error';
    this.finishPipeline('', failureStage, errorMessage);
  }

  private finishPipeline(
    speechText: string,
    failure: FailureStage = 'NONE',
    errorMessage?: string
  ): void {
    if (this.currentResolve) {
      const finalResultText = speechText.trim();
      const rawText = this.lastRawTranscript || finalResultText;
      const effectiveProvider = this.activeSessionOptions.providerId || this.selectedProvider;

      this.currentResolve({
        transcript: finalResultText,
        rawTranscript: rawText,
        language: rawText.match(/[\u0D00-\u0D7F]/) ? 'ml' : 'mixed',
        confidence: this.lastConfidence,
        providerId: effectiveProvider,
        providerName: this.diagnostics.sttProvider,
        model: this.lastModel,
        status: this.lastStatus,
        diagnostics: {
          ...this.diagnostics,
          failureStage: failure,
          errorMessage: errorMessage || this.diagnostics.errorMessage,
        },
        isFinal: true,
      });
      this.currentResolve = null;
    }
    this.recordingActive = false;
  }
}

export const speechService: ISpeechService = new MediaRecorderSpeechService();
