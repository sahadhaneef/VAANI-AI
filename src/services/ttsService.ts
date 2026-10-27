/**
 * Real Malayalam Text-to-Speech Service — Google Cloud TTS Backend Integration
 *
 * Implements strict safeguards:
 * - SAFEGUARD 4 & 5: Keeps VoiceUIState as the single source of truth.
 *   Does NOT show "Speaking" when HTTP succeeds; only transitions on actual audio.onplay.
 * - SAFEGUARD 6: Captures and reports exact failure details (provider error, HTTP status,
 *   content type, audio byte count, browser playback error) without exposing secrets.
 * - SAFEGUARD 7: Strictly enforces that current response matches the active requestId.
 *   Discards superseded requests immediately.
 * - SAFEGUARD 8: Uses device audio element playing backend stream; NO browser SpeechSynthesis.
 */

export interface TTSErrorDetails {
  stage: 'network' | 'backend' | 'validation' | 'decode' | 'playback' | 'autoplay_blocked';
  providerError?: string;
  httpStatus?: number;
  contentType?: string;
  audioByteCount?: number;
  browserPlaybackError?: string;
  message: string;
}

export interface TTSDebugStatus {
  lastText: string;
  voiceUsed: string;
  status: 'idle' | 'fetching' | 'playing' | 'completed' | 'error';
  audioDurationMs?: number;
  audioByteCount?: number;
  httpStatus?: number;
  contentType?: string;
  errorMessage?: string;
  apiSuccess: boolean;
  autoplayBlocked?: boolean;
}

export interface ITTSService {
  speak(
    text: string,
    voiceName?: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: Error, details?: TTSErrorDetails) => void,
    requestId?: string
  ): Promise<void>;
  stop(): void;
  isSpeaking(): boolean;
  getDebugStatus(): TTSDebugStatus;
  playCurrentAudio(): Promise<boolean>;
  isAutoplayBlocked(): boolean;
}

class GoogleTTSService implements ITTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private isAudioPlaying = false;
  private activeRequestId: string | null = null;
  private activeAbortController: AbortController | null = null;
  private onStartCb?: () => void;
  private onEndCb?: () => void;
  private onErrorCb?: (err: Error, details?: TTSErrorDetails) => void;

  private debugStatus: TTSDebugStatus = {
    lastText: '',
    voiceUsed: 'ml-IN-Chirp3-HD-Aoede',
    status: 'idle',
    apiSuccess: true,
    autoplayBlocked: false,
    audioByteCount: 0,
  };

  getDebugStatus(): TTSDebugStatus {
    return this.debugStatus;
  }

  isSpeaking(): boolean {
    return this.isAudioPlaying;
  }

  isAutoplayBlocked(): boolean {
    return !!this.debugStatus.autoplayBlocked;
  }

  stop(): void {
    // 1. Invalidate any in-flight requests immediately
    this.activeRequestId = null;

    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {
        // ignore abort error
      }
      this.activeAbortController = null;
    }

    // 2. Pause and destroy current audio element
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch {
        // ignore pause errors
      }
      this.currentAudio = null;
    }

    this.isAudioPlaying = false;
    this.debugStatus.status = 'idle';
  }

  /**
   * Clean response text before sending to TTS:
   * Strips markdown, URLs, citations, emojis, JSON data, technical labels (GREETING:), and extra symbols.
   */
  private cleanTextForTTS(text: string): string {
    if (!text) return '';
    return text
      .replace(/^([A-Z_]+):\s*/gi, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[[\d., ]+\]/g, '') // Strip grounding citation numbers [1.1], [2]
      .replace(/https?:\/\/[^\s]+/g, '') // Strip raw URLs
      .replace(/[*#_~]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async speak(
    text: string,
    voiceName = 'ml-IN-Chirp3-HD-Aoede',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: Error, details?: TTSErrorDetails) => void,
    requestId?: string
  ): Promise<void> {
    return new Promise((resolve) => {
      (async () => {
        // 1. Stop any currently playing audio and invalidate previous request
      this.stop();

      const currentReq = requestId || `req_${Date.now()}`;
      this.activeRequestId = currentReq;
      this.onStartCb = onStart;
      this.onEndCb = onEnd;
      this.onErrorCb = onError;

      const cleanText = this.cleanTextForTTS(text);
      if (!cleanText) {
        if (onEnd) onEnd();
        return resolve();
      }

      console.log(`[TTS] [req:${currentReq}] TTS REQUEST START: "${cleanText.substring(0, 60)}..."`);

      this.debugStatus = {
        lastText: cleanText,
        voiceUsed: voiceName,
        status: 'fetching',
        apiSuccess: false,
        autoplayBlocked: false,
        audioByteCount: 0,
        errorMessage: undefined,
      };

      const abortController = new AbortController();
      this.activeAbortController = abortController;

      try {
        // 2. Send cleaned Malayalam text to backend /api/tts endpoint
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: cleanText,
            voiceName,
            requestId: currentReq,
          }),
          signal: abortController.signal,
        });

        // SAFEGUARD 7: Discard if superseded by a newer request during fetch
        if (this.activeRequestId !== currentReq) {
          console.log(`[TTS] [req:${currentReq}] Superseded during fetch. Discarding.`);
          return resolve();
        }

        // SAFEGUARD 6: Handle non-200 responses with exact diagnostic reporting
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const httpStatus = errData.httpStatus || response.status;
          const contentType = errData.contentType || response.headers.get('content-type') || 'application/json';
          const providerError = errData.message || errData.error || response.statusText || 'TTS request failed';
          const providerName = errData.provider || 'tts-backend';

          const formattedMessage = `[${providerName}] HTTP ${httpStatus} (${contentType}): ${providerError}`;

          const details: TTSErrorDetails = {
            stage: 'backend',
            providerError,
            httpStatus,
            contentType,
            audioByteCount: errData.audioByteCount || 0,
            message: formattedMessage,
          };

          this.debugStatus.status = 'error';
          this.debugStatus.errorMessage = formattedMessage;
          this.debugStatus.httpStatus = httpStatus;
          this.debugStatus.contentType = contentType;
          this.debugStatus.audioByteCount = errData.audioByteCount || 0;

          const err = new Error(formattedMessage);
          (err as any).details = details;
          if (this.onErrorCb) this.onErrorCb(err, details);
          return resolve();
        }

        const data = await response.json();

        // SAFEGUARD 7: Discard if superseded after JSON parse
        if (this.activeRequestId !== currentReq) {
          console.log(`[TTS] [req:${currentReq}] Superseded after JSON parsing. Discarding.`);
          return resolve();
        }

        if (!data.audioContent) {
          const details: TTSErrorDetails = {
            stage: 'backend',
            providerError: 'Empty audioContent payload',
            httpStatus: 200,
            contentType: 'application/json',
            audioByteCount: 0,
            message: 'TTS Backend returned empty audioContent payload',
          };
          this.debugStatus.status = 'error';
          this.debugStatus.errorMessage = details.message;
          const err = new Error(details.message);
          (err as any).details = details;
          if (this.onErrorCb) this.onErrorCb(err, details);
          return resolve();
        }

        const audioByteCount =
          typeof data.audioByteCount === 'number'
            ? data.audioByteCount
            : Math.floor((data.audioContent.length * 3) / 4);

        if (audioByteCount <= 0) {
          const details: TTSErrorDetails = {
            stage: 'validation',
            providerError: 'Invalid zero audio bytes',
            httpStatus: 200,
            contentType: data.format || 'audio/mp3',
            audioByteCount: 0,
            message: 'Audio payload contains zero bytes',
          };
          this.debugStatus.status = 'error';
          this.debugStatus.errorMessage = details.message;
          const err = new Error(details.message);
          (err as any).details = details;
          if (this.onErrorCb) this.onErrorCb(err, details);
          return resolve();
        }

        console.log(
          `[TTS] [req:${currentReq}] TTS RESPONSE RECEIVED (${audioByteCount} bytes, voice: ${data.voiceUsed || voiceName})`
        );

        this.debugStatus.voiceUsed = data.voiceUsed || voiceName;
        this.debugStatus.apiSuccess = true;
        this.debugStatus.audioByteCount = audioByteCount;
        this.debugStatus.httpStatus = 200;
        const audioFormat = data.format || 'audio/wav';
        this.debugStatus.contentType = audioFormat;

        // 3. Create Audio instance from returned base64 audio stream (WAV or MP3)
        const audioSrc = `data:${audioFormat};base64,${data.audioContent}`;
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 1.0;
        audio.muted = false;
        this.currentAudio = audio;

        let hasFinished = false;
        const cleanup = () => {
          if (!hasFinished) {
            hasFinished = true;
            this.isAudioPlaying = false;
            this.debugStatus.status = 'completed';
            if (this.onEndCb) this.onEndCb();
            resolve();
          }
        };

        // SAFEGUARD 5: audio.onplay event proves playback actually started
        audio.onplay = () => {
          if (this.activeRequestId !== currentReq) {
            console.log(`[TTS] [req:${currentReq}] Play event received for superseded request. Halting.`);
            audio.pause();
            return;
          }
          console.log(`[TTS] [req:${currentReq}] PLAYBACK START (onplay event fired)`);
          this.isAudioPlaying = true;
          this.debugStatus.status = 'playing';
          this.debugStatus.autoplayBlocked = false;
          if (this.onStartCb) this.onStartCb();
        };

        audio.onended = () => {
          console.log(`[TTS] [req:${currentReq}] PLAYBACK SUCCESS (audio ended)`);
          cleanup();
        };

        // SAFEGUARD 6: Capture browser playback error (HTMLMediaElement error codes)
        audio.onerror = () => {
          if (!hasFinished) {
            hasFinished = true;
            this.isAudioPlaying = false;
            this.debugStatus.status = 'error';

            const errCode = audio.error ? audio.error.code : 0;
            const errCodeName =
              errCode === 1
                ? 'MEDIA_ERR_ABORTED'
                : errCode === 2
                  ? 'MEDIA_ERR_NETWORK'
                  : errCode === 3
                    ? 'MEDIA_ERR_DECODE'
                    : errCode === 4
                      ? 'MEDIA_ERR_SRC_NOT_SUPPORTED'
                      : 'MEDIA_ERR_UNKNOWN';

            const errMsg = audio.error?.message || 'Audio playback interrupted or decode failed';
            const diagMsg = `Browser audio error (${errCodeName}): ${errMsg} (bytes: ${audioByteCount})`;
            console.error(`[TTS] [req:${currentReq}] PLAYBACK FAILURE:`, diagMsg);

            const details: TTSErrorDetails = {
              stage: 'decode',
              browserPlaybackError: `${errCodeName}: ${errMsg}`,
              contentType: 'audio/mp3',
              audioByteCount,
              message: diagMsg,
            };

            this.debugStatus.errorMessage = diagMsg;
            const err = new Error(diagMsg);
            (err as any).details = details;
            if (this.onErrorCb) this.onErrorCb(err, details);
            resolve();
          }
        };

        // 4. Play audio through device speaker
        audio.src = audioSrc;

        try {
          if (this.activeRequestId !== currentReq) {
            console.log(`[TTS] [req:${currentReq}] Superseded before audio.play(). Discarding.`);
            return resolve();
          }

          await audio.play();
          console.log(`[TTS] [req:${currentReq}] audio.play() promise resolved`);
        } catch (playErr: any) {
          const isAutoplay =
            playErr.name === 'NotAllowedError' || /user gesture|autoplay/i.test(playErr.message || '');

          this.debugStatus.autoplayBlocked = isAutoplay;
          this.debugStatus.status = isAutoplay ? 'idle' : 'error';
          this.isAudioPlaying = false;

          const diagMsg = isAutoplay
            ? 'Browser blocked unprompted autoplay (user gesture required)'
            : `Playback error: ${playErr.name} - ${playErr.message}`;

          console.warn(`[TTS] [req:${currentReq}] ${diagMsg}`);

          const details: TTSErrorDetails = {
            stage: isAutoplay ? 'autoplay_blocked' : 'playback',
            browserPlaybackError: `${playErr.name}: ${playErr.message}`,
            contentType: 'audio/mp3',
            audioByteCount,
            message: diagMsg,
          };

          this.debugStatus.errorMessage = diagMsg;
          const err = new Error(diagMsg);
          (err as any).details = details;
          if (this.onErrorCb) this.onErrorCb(err, details);
          // Do not reject: keep currentAudio reference ready for manual fallback click
          resolve();
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log(`[TTS] [req:${currentReq}] Request aborted`);
          return resolve();
        }

        console.error(`[TTS Service Error] [req:${currentReq}]:`, err);
        this.debugStatus.status = 'error';
        this.debugStatus.errorMessage = err.message || 'TTS Error';
        this.debugStatus.apiSuccess = false;

        const details: TTSErrorDetails = {
          stage: 'network',
          message: err.message || 'TTS Network Error',
        };

        if (this.onErrorCb) this.onErrorCb(err, details);
        if (this.onEndCb) this.onEndCb();
        resolve();
      }
    })();
  });
}

  /**
   * Plays the already-buffered audio for the current response.
   * Useful when browser autoplay policy blocks unprompted playback.
   */
  async playCurrentAudio(): Promise<boolean> {
    if (!this.currentAudio) {
      console.warn('[TTS] No currentAudio loaded to play.');
      return false;
    }
    try {
      this.currentAudio.currentTime = 0;
      await this.currentAudio.play();
      this.isAudioPlaying = true;
      this.debugStatus.autoplayBlocked = false;
      this.debugStatus.status = 'playing';
      if (this.onStartCb) this.onStartCb();
      return true;
    } catch (e: any) {
      console.error('[TTS] Manual playback failed:', e);
      return false;
    }
  }
}

export const ttsService: ITTSService = new GoogleTTSService();
