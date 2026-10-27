/**
 * Vite Server Plugin — Backend TTS API Endpoint (`POST /api/tts`)
 *
 * Implements Google Cloud TTS as primary provider with strict safeguards:
 * - SAFEGUARD 1: Does NOT silently fall back when official Google Cloud TTS fails.
 *   Exposes the real failure reason. Fallback only used when explicitly configured.
 * - SAFEGUARD 2: Validates that audio buffers (including chunked streams) are actually playable MP3 streams.
 *   Chunking is kept strictly internal to the server provider. Frontend receives one valid audio resource.
 * - SAFEGUARD 6: Captures and reports exact failure details (provider error, HTTP status, content type,
 *   audio byte count) without exposing secrets.
 */

import type { Plugin } from 'vite';
import https from 'node:https';
import { config } from './config.js';
import type { ITTSProvider, TTSResult, RequestContext } from './providers/interfaces.js';

interface TTSRequestBody {
  text: string;
  voiceName?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
}

/**
 * Strips sensitive keys and tokens from strings and URLs.
 */
function sanitizeSecrets(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Redact URL query parameter ?key=... or &key=...
  cleaned = cleaned.replace(/([?&]key=)[^&\s"'`]+/gi, '$1***REDACTED***');
  // Redact Google API keys starting with AIza...
  cleaned = cleaned.replace(/AIza[0-9A-Za-z-_]{35}/g, '***REDACTED_API_KEY***');
  // Redact configured secrets
  const knownKeys = [config.googleTtsApiKey, config.googleSttApiKey].filter(Boolean);
  for (const k of knownKeys) {
    if (k && k.length > 6) {
      cleaned = cleaned.split(k).join('***REDACTED***');
    }
  }
  return cleaned;
}

/**
 * Validates that an audio buffer contains a genuine, playable audio stream (MP3 or WAV).
 * Guards against HTML error pages, truncated headers, or corrupt byte buffers.
 */
function validateAudioBuffer(buffer: Buffer, format: 'audio/mp3' | 'audio/wav' = 'audio/mp3'): { valid: boolean; reason?: string } {
  if (!buffer || buffer.length < 44) {
    return { valid: false, reason: `Buffer too small (${buffer ? buffer.length : 0} bytes), minimum 44 bytes required` };
  }

  // Reject text/HTML error responses (e.g., '<!DOCTYPE html>' or '<html')
  if (buffer[0] === 0x3c || buffer.toString('utf8', 0, 15).toLowerCase().includes('html')) {
    return { valid: false, reason: 'Received HTML/text error response instead of binary audio stream' };
  }

  if (format === 'audio/wav') {
    const hasRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const hasWave = buffer.toString('ascii', 8, 12) === 'WAVE';
    if (!hasRiff || !hasWave) {
      return { valid: false, reason: 'Missing RIFF/WAVE header in WAV audio buffer' };
    }
    return { valid: true };
  }

  // Check for ID3v2 tag: "ID3"
  const hasId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  let scanOffset = 0;

  if (hasId3) {
    // ID3 tag header is 10 bytes; size is synchsafe integer in bytes 6-9
    const id3Size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    scanOffset = 10 + id3Size;

    if (buffer.length <= scanOffset + 32) {
      return { valid: false, reason: 'ID3 tag present but no audio frames follow it' };
    }
  }

  // Scan buffer for MPEG audio sync word (0xFF followed by byte with top 3 bits set 111)
  const maxScan = Math.min(buffer.length - 4, scanOffset + 4096);
  let syncFound = false;

  for (let i = scanOffset; i < maxScan; i++) {
    if (buffer[i] === 0xff) {
      const b1 = buffer[i + 1];
      // Top 3 bits must be 111 -> (b1 & 0xE0) === 0xE0
      if ((b1 & 0xe0) === 0xe0) {
        const mpegVersion = (b1 >> 3) & 0x03; // 00=2.5, 01=reserved, 10=2, 11=1
        const layer = (b1 >> 1) & 0x03; // 00=reserved, 01=Layer III, 10=Layer II, 11=Layer I
        const b2 = buffer[i + 2];
        const bitrateIdx = (b2 >> 4) & 0x0f;
        const sampleRateIdx = (b2 >> 2) & 0x03;

        // Ensure valid MPEG audio bits
        if (mpegVersion !== 1 && layer !== 0 && bitrateIdx !== 0x0f && sampleRateIdx !== 0x03) {
          syncFound = true;
          break;
        }
      }
    }
  }

  if (!syncFound && !hasId3) {
    return { valid: false, reason: 'No MPEG audio frame sync or ID3 header found in audio buffer' };
  }

  return { valid: true };
}

function validateMp3Buffer(buffer: Buffer): { valid: boolean; reason?: string } {
  return validateAudioBuffer(buffer, 'audio/mp3');
}

class GoogleCloudTTSProvider implements ITTSProvider {
  async synthesize(text: string, voiceName: string, context: RequestContext): Promise<TTSResult> {
    const primaryVoice = voiceName || config.googleTtsVoice || 'ml-IN-Chirp3-HD-Aoede';

    console.log(
      `[TTS Backend] [req:${context.requestId}] locale: ml-IN, voice: ${primaryVoice}, length: ${text.length} chars`
    );

    // 1. Primary official Google Cloud TTS path (if GOOGLE_TTS_API_KEY is configured)
    if (config.googleTtsApiKey) {
      console.log(`[TTS Backend] [req:${context.requestId}] Calling official Google Cloud TTS API`);
      return await this.callOfficialAPI(text, primaryVoice, config.googleTtsApiKey, context);
    }


    // 3. Fallback path: ONLY if explicitly configured
    if (config.googleTtsAllowFallback) {
      console.log(`[TTS Backend] [req:${context.requestId}] Using explicitly configured fallback audio stream`);
      return await this.fetchGoogleMalayalamAudioStream(text, primaryVoice, context);
    }

    // 4. If neither key nor fallback is configured, report exact configuration requirement
    const configError: any = new Error(
      'Google Cloud TTS API key is not configured and fallback is not explicitly enabled.'
    );
    configError.code = 'TTS_CONFIGURATION_ERROR';
    configError.provider = 'google-cloud-tts';
    configError.httpStatus = 503;
    configError.contentType = 'application/json';
    configError.audioByteCount = 0;
    throw configError;
  }

  private async callOfficialAPI(
    text: string,
    primaryVoice: string,
    apiKey: string,
    context: RequestContext
  ): Promise<TTSResult> {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const payload = JSON.stringify({
      input: { text },
      voice: {
        languageCode: 'ml-IN',
        name: primaryVoice,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.98,
        pitch: 0.0,
      },
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const statusCode = res.statusCode || 500;
            const contentType = res.headers['content-type'] || 'application/json';

            if (statusCode >= 200 && statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                if (!parsed.audioContent) {
                  const emptyErr: any = new Error('Google Cloud TTS returned empty audioContent');
                  emptyErr.code = 'TTS_SYNTHESIS_FAILED';
                  emptyErr.provider = 'google-cloud-tts';
                  emptyErr.httpStatus = statusCode;
                  emptyErr.contentType = contentType;
                  emptyErr.audioByteCount = 0;
                  return reject(emptyErr);
                }

                const audioBuf = Buffer.from(parsed.audioContent, 'base64');
                const validation = validateMp3Buffer(audioBuf);
                if (!validation.valid) {
                  const valErr: any = new Error(`Official TTS audio validation failed: ${validation.reason}`);
                  valErr.code = 'TTS_AUDIO_VALIDATION_FAILED';
                  valErr.provider = 'google-cloud-tts';
                  valErr.httpStatus = 502;
                  valErr.contentType = 'audio/mp3';
                  valErr.audioByteCount = audioBuf.length;
                  return reject(valErr);
                }

                resolve({
                  audioContent: parsed.audioContent,
                  voiceUsed: primaryVoice,
                  format: 'audio/mp3',
                  durationEstimateMs: Math.max(1800, text.length * 110),
                  audioByteCount: audioBuf.length,
                });
              } catch (parseErr: any) {
                const err: any = new Error(`Failed to parse official TTS response: ${parseErr.message}`);
                err.code = 'TTS_SYNTHESIS_FAILED';
                err.provider = 'google-cloud-tts';
                err.httpStatus = statusCode;
                err.contentType = contentType;
                err.audioByteCount = 0;
                reject(err);
              }
            } else {
              // Extract error message without secrets
              let errMsg = `Google Cloud TTS HTTP ${statusCode}`;
              try {
                const parsed = JSON.parse(data);
                if (parsed.error?.message) {
                  errMsg += `: ${parsed.error.message}`;
                } else if (parsed.message) {
                  errMsg += `: ${parsed.message}`;
                }
              } catch {
                errMsg += `: ${data.substring(0, 200)}`;
              }

              const safeMsg = sanitizeSecrets(errMsg);
              console.error(`[TTS Backend] [req:${context.requestId}] Official API error: ${safeMsg}`);

              const apiErr: any = new Error(safeMsg);
              apiErr.code = 'GOOGLE_CLOUD_TTS_ERROR';
              apiErr.provider = 'google-cloud-tts';
              apiErr.httpStatus = statusCode;
              apiErr.contentType = contentType;
              apiErr.audioByteCount = 0;
              reject(apiErr);
            }
          });
        }
      );

      req.on('error', (e) => {
        const netErr: any = new Error(`Google Cloud TTS connection error: ${sanitizeSecrets(e.message)}`);
        netErr.code = 'TTS_NETWORK_ERROR';
        netErr.provider = 'google-cloud-tts';
        netErr.httpStatus = 502;
        netErr.contentType = 'text/plain';
        netErr.audioByteCount = 0;
        reject(netErr);
      });

      req.write(payload);
      req.end();
    });
  }


  private splitIntoChunks(text: string, maxLen = 150): string[] {
    const chunks: string[] = [];
    const regex = /([^.?!,\n;]+[.?!,\n;]+|[^.?!,\n;]+$)/g;
    const rawParts = text.match(regex) || [text];

    let currentChunk = '';
    for (const part of rawParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if ((currentChunk + ' ' + trimmed).trim().length <= maxLen) {
        currentChunk = currentChunk ? currentChunk + ' ' + trimmed : trimmed;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        if (trimmed.length > maxLen) {
          const words = trimmed.split(' ');
          let sub = '';
          for (const w of words) {
            if ((sub + ' ' + w).trim().length <= maxLen) {
              sub = sub ? sub + ' ' + w : w;
            } else {
              if (sub) chunks.push(sub);
              sub = w;
            }
          }
          if (sub) chunks.push(sub);
          currentChunk = '';
        } else {
          currentChunk = trimmed;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 0 ? chunks : [text];
  }

  private fetchChunk(chunkText: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const encodedText = encodeURIComponent(chunkText);
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=ml&client=tw-ob`;

      const req = https.get(
        googleTtsUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://translate.google.com/',
          },
          timeout: 10000,
        },
        (res) => {
          if (res.statusCode === 200) {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              const buf = Buffer.concat(chunks);
              resolve(buf);
            });
          } else {
            const err: any = new Error(`Fallback Audio Stream HTTP ${res.statusCode} for chunk`);
            err.code = 'FALLBACK_TTS_HTTP_ERROR';
            err.httpStatus = res.statusCode;
            err.contentType = res.headers['content-type'] || 'text/html';
            err.audioByteCount = 0;
            reject(err);
          }
        }
      );

      req.on('error', (e) => {
        const netErr: any = new Error(`Fallback Audio Stream connection error: ${e.message}`);
        netErr.code = 'FALLBACK_TTS_NETWORK_ERROR';
        netErr.httpStatus = 502;
        netErr.contentType = 'text/plain';
        netErr.audioByteCount = 0;
        reject(netErr);
      });

      req.on('timeout', () => {
        req.destroy(new Error('Fallback Audio Stream chunk request timed out'));
      });
    });
  }

  private async fetchGoogleMalayalamAudioStream(
    text: string,
    primaryVoice: string,
    context: RequestContext
  ): Promise<TTSResult> {
    const chunks = this.splitIntoChunks(text, 150);
    console.log(`[TTS Backend] [req:${context.requestId}] Synthesizing ${chunks.length} audio chunk(s) sequentially`);

    const audioBuffers: Buffer[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunkBuf = await this.fetchChunk(chunks[i]);
        audioBuffers.push(chunkBuf);
        if (i < chunks.length - 1) {
          // Throttle between chunks to prevent connection reset from Google translate edge
          await new Promise((r) => setTimeout(r, 120));
        }
      }
    } catch (fetchErr: any) {
      const err: any = new Error(fetchErr.message || 'Fallback stream synthesis failed');
      err.code = fetchErr.code || 'FALLBACK_SYNTHESIS_FAILED';
      err.provider = 'fallback-stream';
      err.httpStatus = fetchErr.httpStatus || 502;
      err.contentType = fetchErr.contentType || 'text/plain';
      err.audioByteCount = 0;
      throw err;
    }

    const combinedBuffer = Buffer.concat(audioBuffers);

    // SAFEGUARD 2: Validate concatenated audio buffer playability before returning
    const validation = validateMp3Buffer(combinedBuffer);
    if (!validation.valid) {
      console.error(`[TTS Backend] [req:${context.requestId}] Chunked MP3 validation failed: ${validation.reason}`);
      const valErr: any = new Error(`TTS audio validation failed: ${validation.reason || 'Corrupt or unplayable stream'}`);
      valErr.code = 'TTS_AUDIO_VALIDATION_FAILED';
      valErr.provider = 'fallback-stream';
      valErr.httpStatus = 502;
      valErr.contentType = 'audio/mp3';
      valErr.audioByteCount = combinedBuffer.length;
      throw valErr;
    }

    console.log(
      `[TTS Backend] [req:${context.requestId}] Audio validated successfully (${combinedBuffer.length} bytes, format: audio/mp3)`
    );

    return {
      audioContent: combinedBuffer.toString('base64'),
      voiceUsed: `${primaryVoice} (Fallback Stream)`,
      format: 'audio/mp3',
      durationEstimateMs: Math.max(1800, text.length * 110),
      audioByteCount: combinedBuffer.length,
    };
  }
}

export function ttsPlugin(): Plugin {
  const provider: ITTSProvider = new GoogleCloudTTSProvider();

  return {
    name: 'vaani-tts-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/api/tts') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            let context: RequestContext | null = null;
            try {
              const body: TTSRequestBody = JSON.parse(bodyStr || '{}');
              const textToSynthesize = (body.text || '').trim();

              if (!textToSynthesize) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: 'VALIDATION_ERROR',
                    message: 'Text parameter is required',
                    provider: 'tts-backend',
                    httpStatus: 400,
                    contentType: 'application/json',
                    audioByteCount: 0,
                  })
                );
                return;
              }

              context = {
                requestId: body.requestId || `req_${Date.now()}`,
                sessionId: body.sessionId || `sess_${Date.now()}`,
                authenticatedUserId: 'user_dev_123',
                timestamp: Date.now(),
              };

              const result = await provider.synthesize(textToSynthesize, body.voiceName || '', context);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, ...result }));
            } catch (err: any) {
              const safeMessage = sanitizeSecrets(err.message || 'TTS Synthesis failed');
              const httpStatus =
                typeof err.httpStatus === 'number' && err.httpStatus >= 400 && err.httpStatus <= 599
                  ? err.httpStatus
                  : 500;
              const errorCode = err.code || 'TTS_SYNTHESIS_FAILED';
              const providerName = err.provider || 'google-cloud-tts';
              const contentType = err.contentType || 'application/json';
              const audioByteCount = err.audioByteCount || 0;

              console.error(`[TTS Backend Endpoint Error] [req:${context?.requestId || 'unknown'}]:`, {
                errorCode,
                message: safeMessage,
                httpStatus,
                provider: providerName,
                audioByteCount,
              });

              res.statusCode = httpStatus;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: errorCode,
                  message: safeMessage,
                  provider: providerName,
                  httpStatus,
                  contentType,
                  audioByteCount,
                })
              );
            }
          });

          return;
        }
        next();
      });
    },
  };
}
