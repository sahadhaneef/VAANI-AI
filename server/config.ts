/**
 * Centralized Configuration for VAANI AI Backend
 * 
 * Manages environment variables and prevents scattered process.env calls.
 * Ensures backend secrets never leak to the frontend.
 */

import dotenv from 'dotenv';
import path from 'node:path';

export interface VaaniConfig {
  env: 'development' | 'production' | 'test';
  
  // Google Gemini (Primary AI Provider)
  geminiApiKey: string;
  geminiReasoningModel: string;
  geminiSearchModel: string;

  // Google Cloud (STT/TTS)
  googleCloudProjectId: string;
  googleSttApiKey: string; // If using REST API keys instead of service accounts
  googleTtsApiKey: string;
  googleTtsAllowFallback: boolean;
  googleSttLocation: string;
  googleSttModel: string;
  googleTtsVoice: string;

  // Phase 4 STT Benchmark Configuration
  sttDefaultProvider: 'google-cloud-v2' | 'google-cloud-v1';
  googleSttV2Model: string;
  googleSttV2Location: string;
  googleSttV2Recognizer: string;
  sttLanguageCode: string;

  // Database
  databasePath: string;
}

function loadConfig(): VaaniConfig {
  dotenv.config(); // Ensure it loads dynamically if Vite restarts the module
  
  const env = (process.env.NODE_ENV as any) || 'development';

  return {
    env,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiReasoningModel: process.env.GEMINI_REASONING_MODEL || 'gemini-3.8-flash',
    geminiSearchModel: process.env.GEMINI_SEARCH_MODEL || 'gemini-3.8-flash',

    googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    googleSttApiKey: process.env.GOOGLE_STT_API_KEY || process.env.VITE_GOOGLE_STT_API_KEY || '',
    googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || process.env.VITE_GOOGLE_TTS_API_KEY || '',
    googleTtsAllowFallback: process.env.ALLOW_TTS_FALLBACK === 'true',
    googleSttLocation: process.env.GOOGLE_STT_LOCATION || 'global',
    googleSttModel: process.env.GOOGLE_STT_MODEL || 'latest_long',
    googleTtsVoice: process.env.GOOGLE_TTS_VOICE || 'ml-IN-Chirp3-HD-Aoede',

    sttDefaultProvider: (process.env.STT_DEFAULT_PROVIDER as any) || 'google-cloud-v1',
    googleSttV2Model: process.env.GOOGLE_STT_V2_MODEL || 'chirp_3',
    googleSttV2Location: process.env.GOOGLE_STT_V2_LOCATION || 'us',
    googleSttV2Recognizer: process.env.GOOGLE_STT_V2_RECOGNIZER || '_',
    sttLanguageCode: process.env.STT_LANGUAGE_CODE || 'ml-IN',

    databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'server', 'data', 'vaani.db'),
  };
}

export const config = loadConfig();

// Validate required config at startup (Never print secrets!)
console.log(`[Startup Diagnostic] GEMINI_API_KEY configured: ${!!config.geminiApiKey}`);
console.log(`[Startup Diagnostic] GEMINI_REASONING_MODEL configured: ${config.geminiReasoningModel}`);
console.log(`[Startup Diagnostic] GEMINI_SEARCH_MODEL configured: ${config.geminiSearchModel}`);

if (!config.geminiApiKey) {
  console.warn('[Config Warning] GEMINI_API_KEY is not set in environment. AI capabilities will fail.');
}
