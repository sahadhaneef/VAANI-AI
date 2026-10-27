/**
 * Vite Server Plugin — Backend Speech-to-Text API Endpoint (`POST /api/stt`)
 *
 * Implements Phase 4 STT Architecture:
 * - Clean Provider Abstraction: ISTTProvider
 * - PATH A: Gemini 3.5 Transcribe Provider (verbatim mode, ml-IN and auto-detect)
 * - PATH B: Google Cloud STT V2 Provider with Chirp 3 (chirp_3, handles missing creds cleanly with NOT_RUN)
 * - Baseline: Google Cloud STT V1 Provider (legacy reference)
 * - Evaluation endpoint: POST /api/stt/benchmark/eval
 * - Dataset endpoint: GET /api/stt/benchmark/dataset
 *
 * STRICT SAFEGUARDS:
 * 1. Raw transcript is never altered or AI-corrected.
 * 2. Missing credentials mark status as NOT_RUN and errorCode as STT_CONFIGURATION_ERROR.
 * 3. Confidence is captured only when provided, otherwise recorded as null.
 */

import type { Plugin } from 'vite';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import type {
  ISTTProvider,
  STTOptions,
  STTResult,
  RequestContext,
} from './providers/interfaces.js';
import { evaluateSTTOutput } from '../tests/stt/metrics.js';

interface STTRequestBody {
  audioBase64: string;
  mimeType?: string;
  sampleRate?: number;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  providerId?: 'google-cloud-v2' | 'google-cloud-v1';
  languageCode?: string;
  autoDetectLanguage?: boolean;
  verbatim?: boolean;
}

interface BenchmarkEvalRequestBody {
  audioBase64?: string;
  mimeType?: string;
  testId?: string;
  groundTruth?: string;
  rawTranscript?: string;
  providerId?: 'google-cloud-v2' | 'google-cloud-v1';
  languageCode?: string;
  autoDetectLanguage?: boolean;
  expected?: {
    numbers?: string[];
    dateTime?: string[];
    technicalTerms?: string[];
    keywords?: string[];
  };
}


/**
 * PATH B: Google Cloud STT V2 Provider with Chirp 3
 * Model: chirp_3, Location: us-central1 (or configured region)
 */
class GoogleCloudSTTV2Provider implements ISTTProvider {
  readonly id = 'google-cloud-v2';
  readonly name = 'Google Cloud STT V2 (Chirp 3)';

  async transcribe(
    audioBase64: string,
    mimeType: string,
    options: STTOptions,
    context: RequestContext
  ): Promise<STTResult> {
    const projectId = config.googleCloudProjectId;
    const location = config.googleSttV2Location || 'us-central1';
    const recognizer = config.googleSttV2Recognizer || '_';
    const model = config.googleSttV2Model || 'chirp_3';
    const langConfigUsed = options.autoDetectLanguage ? 'auto_detect' : 'explicit_ml-IN';
    const audioSize = Buffer.from(audioBase64, 'base64').length;

    // Technical Correction 7: If V2 credentials/config are missing, record NOT_RUN with STT_CONFIGURATION_ERROR. Do not fabricate scores.
    if (!projectId) {
      console.warn(
        `[STT V2 Chirp 3] [req:${context.requestId}] GOOGLE_CLOUD_PROJECT_ID not set. Recording NOT_RUN.`
      );
      return {
        rawTranscript: '',
        transcript: '',
        confidence: null,
        sttProvider: this.name,
        model,
        languageCode: options.languageCode || 'ml-IN',
        languageConfigUsed: langConfigUsed,
        audioSize,
        mimeType,
        status: 'NOT_RUN',
        errorCode: 'STT_CONFIGURATION_ERROR',
        errorDetails:
          'Google Cloud Project ID (GOOGLE_CLOUD_PROJECT_ID) is not configured in .env for STT V2 Chirp 3.',
      };
    }

    const apiKey = config.googleSttApiKey || config.googleTtsApiKey;
    if (!apiKey) {
      return {
        rawTranscript: '',
        transcript: '',
        confidence: null,
        sttProvider: this.name,
        model,
        languageCode: options.languageCode || 'ml-IN',
        languageConfigUsed: langConfigUsed,
        audioSize,
        mimeType,
        status: 'NOT_RUN',
        errorCode: 'STT_AUTHENTICATION_ERROR',
        errorDetails: 'Google Cloud STT API Key is not configured in .env for STT V2 Chirp 3.',
      };
    }

    const tStart = Date.now();
    const url = `https://${location}-speech.googleapis.com/v2/projects/${projectId}/locations/${location}/recognizers/${recognizer}:recognize?key=${apiKey}`;

    const reqPayload = JSON.stringify({
      config: {
        model,
        languageCodes: options.autoDetectLanguage
          ? ['ml-IN', 'en-IN']
          : [options.languageCode || 'ml-IN'],
        features: {
          enableAutomaticPunctuation: true,
        },
      },
      content: audioBase64,
    });

    return new Promise((resolve) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(reqPayload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            const latencyMs = Date.now() - tStart;
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                const results = parsed.results || [];
                let fullTranscript = '';
                let confidence: number | null = null;

                if (results.length > 0 && results[0].alternatives?.length > 0) {
                  fullTranscript = results.map((r: any) => r.alternatives[0].transcript).join(' ');
                  confidence = results[0].alternatives[0].confidence || null;
                }

                const rawTranscript = fullTranscript.trim();
                console.log(
                  `[STT V2 Chirp 3] [req:${context.requestId}] Raw Transcript (${latencyMs}ms): "${rawTranscript}"`
                );

                resolve({
                  rawTranscript,
                  transcript: rawTranscript,
                  confidence,
                  sttProvider: this.name,
                  model,
                  languageCode: options.languageCode || 'ml-IN',
                  languageConfigUsed: langConfigUsed,
                  latencyMs,
                  audioSize,
                  mimeType,
                  status: 'RUN',
                });
              } catch (e: any) {
                resolve({
                  rawTranscript: '',
                  transcript: '',
                  confidence: null,
                  sttProvider: this.name,
                  model,
                  languageCode: options.languageCode || 'ml-IN',
                  languageConfigUsed: langConfigUsed,
                  latencyMs,
                  audioSize,
                  mimeType,
                  status: 'ERROR',
                  errorCode: 'STT_INVALID_RESPONSE',
                  errorDetails: e.message,
                });
              }
            } else {
              console.warn(`[STT V2 Chirp 3] HTTP ${res.statusCode}: ${data}`);
              let errCode = 'STT_PROVIDER_ERROR';
              if (res.statusCode === 401 || res.statusCode === 403) errCode = 'STT_AUTHENTICATION_ERROR';
              if (res.statusCode === 429) errCode = 'STT_RATE_LIMIT';

              resolve({
                rawTranscript: '',
                transcript: '',
                confidence: null,
                sttProvider: this.name,
                model,
                languageCode: options.languageCode || 'ml-IN',
                languageConfigUsed: langConfigUsed,
                latencyMs,
                audioSize,
                mimeType,
                status: 'ERROR',
                errorCode: errCode,
                errorDetails: `HTTP ${res.statusCode}: ${data.substring(0, 200)}`,
              });
            }
          });
        }
      );

      req.on('error', (e) => {
        resolve({
          rawTranscript: '',
          transcript: '',
          confidence: null,
          sttProvider: this.name,
          model,
          languageCode: options.languageCode || 'ml-IN',
          languageConfigUsed: langConfigUsed,
          latencyMs: Date.now() - tStart,
          audioSize,
          mimeType,
          status: 'ERROR',
          errorCode: 'STT_NETWORK_ERROR',
          errorDetails: e.message,
        });
      });

      req.write(reqPayload);
      req.end();
    });
  }
}

/**
 * Baseline: Google Cloud STT V1 Provider (Legacy Reference)
 */
class GoogleCloudSTTV1Provider implements ISTTProvider {
  readonly id = 'google-cloud-v1';
  readonly name = 'Google Cloud STT V1 (Legacy Baseline)';

  async transcribe(
    audioBase64: string,
    mimeType: string,
    options: STTOptions,
    context: RequestContext
  ): Promise<STTResult> {
    const apiKey = config.googleSttApiKey || config.googleTtsApiKey;
    const model = config.googleSttModel || 'latest_long';
    const langConfigUsed = options.autoDetectLanguage ? 'auto_detect' : 'explicit_ml-IN';
    const audioSize = Buffer.from(audioBase64, 'base64').length;

    if (!apiKey) {
      return {
        rawTranscript: '',
        transcript: '',
        confidence: null,
        sttProvider: this.name,
        model,
        languageCode: options.languageCode || 'ml-IN',
        languageConfigUsed: langConfigUsed,
        audioSize,
        mimeType,
        status: 'NOT_RUN',
        errorCode: 'STT_CONFIGURATION_ERROR',
        errorDetails: 'Google Cloud STT API Key not configured in .env',
      };
    }

    const tStart = Date.now();
    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    let encoding = 'WEBM_OPUS';
    if (mimeType.includes('ogg')) encoding = 'OGG_OPUS';
    if (mimeType.includes('wav')) encoding = 'LINEAR16';

    const reqConfig: any = {
      encoding,
      languageCode: options.languageCode || 'ml-IN',
      alternativeLanguageCodes: options.autoDetectLanguage ? ['en-IN'] : undefined,
      enableAutomaticPunctuation: true,
      model,
      useEnhanced: true,
    };

    if (encoding === 'LINEAR16') {
      reqConfig.sampleRateHertz = 16000;
    }

    const payload = JSON.stringify({
      config: reqConfig,
      audio: { content: audioBase64 },
    });

    return new Promise((resolve) => {
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
            const latencyMs = Date.now() - tStart;
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                const results = parsed.results || [];
                let fullTranscript = '';
                let confidence: number | null = null;

                if (results.length > 0 && results[0].alternatives?.length > 0) {
                  fullTranscript = results.map((r: any) => r.alternatives[0].transcript).join(' ');
                  confidence = results[0].alternatives[0].confidence || null;
                }

                const rawTranscript = fullTranscript.trim();
                console.log(
                  `[STT V1] [req:${context.requestId}] Raw Transcript (${latencyMs}ms): "${rawTranscript}"`
                );

                resolve({
                  rawTranscript,
                  transcript: rawTranscript,
                  confidence,
                  sttProvider: this.name,
                  model,
                  languageCode: options.languageCode || 'ml-IN',
                  languageConfigUsed: langConfigUsed,
                  latencyMs,
                  audioSize,
                  mimeType,
                  status: 'RUN',
                });
              } catch (e: any) {
                resolve({
                  rawTranscript: '',
                  transcript: '',
                  confidence: null,
                  sttProvider: this.name,
                  model,
                  languageCode: options.languageCode || 'ml-IN',
                  languageConfigUsed: langConfigUsed,
                  latencyMs,
                  audioSize,
                  mimeType,
                  status: 'ERROR',
                  errorCode: 'STT_INVALID_RESPONSE',
                  errorDetails: e.message,
                });
              }
            } else {
              console.warn(`[STT V1] HTTP ${res.statusCode}: ${data}`);
              resolve({
                rawTranscript: '',
                transcript: '',
                confidence: null,
                sttProvider: this.name,
                model,
                languageCode: options.languageCode || 'ml-IN',
                languageConfigUsed: langConfigUsed,
                latencyMs,
                audioSize,
                mimeType,
                status: 'ERROR',
                errorCode: res.statusCode === 401 || res.statusCode === 403 ? 'STT_AUTHENTICATION_ERROR' : 'STT_PROVIDER_ERROR',
                errorDetails: `HTTP ${res.statusCode}: ${data.substring(0, 200)}`,
              });
            }
          });
        }
      );

      req.on('error', (e) => {
        resolve({
          rawTranscript: '',
          transcript: '',
          confidence: null,
          sttProvider: this.name,
          model,
          languageCode: options.languageCode || 'ml-IN',
          languageConfigUsed: langConfigUsed,
          latencyMs: Date.now() - tStart,
          audioSize,
          mimeType,
          status: 'ERROR',
          errorCode: 'STT_NETWORK_ERROR',
          errorDetails: e.message,
        });
      });

      req.write(payload);
      req.end();
    });
  }
}

// Registry of available providers
const providers: Record<string, ISTTProvider> = {
  'google-cloud-v2': new GoogleCloudSTTV2Provider(),
  'google-cloud-v1': new GoogleCloudSTTV1Provider(),
};

function getProvider(providerId?: string): ISTTProvider {
  if (providerId && providers[providerId]) {
    return providers[providerId];
  }
  return providers[config.sttDefaultProvider] || providers['google-cloud-v1'];
}

export function sttPlugin(): Plugin {
  return {
    name: 'vaani-stt-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Endpoint 1: GET /api/stt/benchmark/dataset
        if (req.method === 'GET' && req.url === '/api/stt/benchmark/dataset') {
          try {
            const datasetPath = path.resolve(process.cwd(), 'data', 'stt', 'benchmark_dataset.json');
            if (fs.existsSync(datasetPath)) {
              const dataset = fs.readFileSync(datasetPath, 'utf8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(dataset);
              return;
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Benchmark dataset not found' }));
              return;
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // Endpoint 2: POST /api/stt/benchmark/eval
        if (req.method === 'POST' && req.url === '/api/stt/benchmark/eval') {
          let bodyStr = '';
          req.on('data', (c) => (bodyStr += c));
          req.on('end', async () => {
            try {
              const body: BenchmarkEvalRequestBody = JSON.parse(bodyStr || '{}');
              const provider = getProvider(body.providerId);
              const context: RequestContext = {
                requestId: `eval_${Date.now()}`,
                sessionId: `eval_sess_${Date.now()}`,
                authenticatedUserId: 'dev_evaluator',
                timestamp: Date.now(),
              };

              let rawTranscript = body.rawTranscript || '';
              let sttResult: STTResult | null = null;

              if (body.audioBase64) {
                sttResult = await provider.transcribe(
                  body.audioBase64,
                  body.mimeType || 'audio/webm;codecs=opus',
                  {
                    providerId: body.providerId,
                    languageCode: body.languageCode,
                    autoDetectLanguage: body.autoDetectLanguage,
                    verbatim: true,
                  },
                  context
                );
                rawTranscript = sttResult.rawTranscript;
              }

              const groundTruth = body.groundTruth || '';
              const evaluation = groundTruth
                ? evaluateSTTOutput(groundTruth, rawTranscript, body.expected)
                : null;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  testId: body.testId || 'custom',
                  provider: provider.name,
                  providerId: provider.id,
                  sttResult,
                  evaluation,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Benchmark evaluation failed' }));
            }
          });
          return;
        }

        // Endpoint 3: POST /api/stt (Main Audio Transcription Endpoint)
        if (req.method === 'POST' && req.url === '/api/stt') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              const body: STTRequestBody = JSON.parse(bodyStr || '{}');
              const audioBase64 = (body.audioBase64 || '').trim();

              if (!audioBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'audioBase64 parameter is required' }));
                return;
              }

              const context: RequestContext = {
                requestId: body.requestId || `req_${Date.now()}`,
                sessionId: body.sessionId || `sess_${Date.now()}`,
                authenticatedUserId: 'user_dev_123',
                timestamp: Date.now(),
              };

              const provider = getProvider(body.providerId);
              const mimeType = body.mimeType || 'audio/webm;codecs=opus';

              console.log(
                `[STT Backend] [req:${context.requestId}] Routing to provider: ${provider.name}`
              );

              const result = await provider.transcribe(
                audioBase64,
                mimeType,
                {
                  providerId: body.providerId,
                  languageCode: body.languageCode,
                  autoDetectLanguage: body.autoDetectLanguage,
                  verbatim: body.verbatim !== false,
                },
                context
              );

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('[STT Backend Endpoint Error]:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'STT Processing failed' }));
            }
          });

          return;
        }
        next();
      });
    },
  };
}
