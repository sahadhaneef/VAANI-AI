/**
 * VAANI AI — Gemini Provider Unit & Architecture Test Suite
 *
 * Validates:
 * 1. Provider Identity & Abstraction compliance
 * 2. Provider-neutral Error Classification
 * 3. Structured Output Schema Strictness
 * 4. Structured Output Validation & Sanitization
 * 5. Prompt-Injection & Credential Defense before cloud calls
 */

import { geminiProvider, UNDERSTANDING_SCHEMA } from '../../server/providers/geminiProvider.js';
import { validateUnderstandingResult } from '../../server/aiPlugin.js';
import { MemoryService } from '../../server/memoryService.js';

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runUnitTests() {
  console.log('===============================================================');
  console.log('  VAANI AI — GEMINI PROVIDER UNIT & ARCHITECTURE TEST SUITE');
  console.log('===============================================================\n');

  // TEST 01: Provider Identity & Interface Compliance
  {
    try {
      assert(geminiProvider.id === 'gemini', 'Provider id must be "gemini"');
      assert(geminiProvider.name === 'Google Gemini Provider', 'Provider name must be "Google Gemini Provider"');
      assert(typeof geminiProvider.understand === 'function', 'Must implement understand()');
      assert(typeof geminiProvider.generateContent === 'function', 'Must implement generateContent()');
      assert(typeof geminiProvider.classifyError === 'function', 'Must implement classifyError()');

      results.push({
        id: 'UNIT-01',
        name: 'Provider Identity & Interface Compliance',
        status: 'PASS',
        details: `id: "${geminiProvider.id}", name: "${geminiProvider.name}"`,
      });
    } catch (e: any) {
      results.push({
        id: 'UNIT-01',
        name: 'Provider Identity & Interface Compliance',
        status: 'FAIL',
        details: e.message,
      });
    }
  }

  // TEST 02: Provider-Neutral Error Classification
  {
    try {
      assert(
        geminiProvider.classifyError({ message: 'GEMINI_API_KEY is not configured in .env' }) === 'CONFIGURATION_ERROR',
        'Should classify missing key as CONFIGURATION_ERROR'
      );
      assert(
        geminiProvider.classifyError({ status: 401, message: 'API key not valid' }) === 'AI_AUTHENTICATION_ERROR',
        'Should classify 401 as AI_AUTHENTICATION_ERROR'
      );
      assert(
        geminiProvider.classifyError({ status: 429, message: 'Resource exhausted (quota exceeded)' }) === 'AI_RATE_LIMIT',
        'Should classify 429 as AI_RATE_LIMIT'
      );
      assert(
        geminiProvider.classifyError({ status: 400, message: 'Invalid argument parameter' }) === 'AI_INVALID_REQUEST',
        'Should classify 400 as AI_INVALID_REQUEST'
      );
      assert(
        geminiProvider.classifyError({ status: 504, message: 'Gateway Timeout' }) === 'AI_TIMEOUT',
        'Should classify 504 as AI_TIMEOUT'
      );
      assert(
        geminiProvider.classifyError({ message: 'ETIMEDOUT connect' }) === 'AI_TIMEOUT',
        'Should classify ETIMEDOUT as AI_TIMEOUT'
      );
      assert(
        geminiProvider.classifyError({ message: 'fetch failed ENOTFOUND generativelanguage.googleapis.com' }) === 'AI_NETWORK_ERROR',
        'Should classify network failure as AI_NETWORK_ERROR'
      );
      assert(
        geminiProvider.classifyError({ status: 500, message: 'Internal Server Error' }) === 'AI_API_ERROR',
        'Should classify 500 as AI_API_ERROR'
      );

      results.push({
        id: 'UNIT-02',
        name: 'Provider-Neutral Error Classification',
        status: 'PASS',
        details: 'All 8 error categories correctly mapped',
      });
    } catch (e: any) {
      results.push({
        id: 'UNIT-02',
        name: 'Provider-Neutral Error Classification',
        status: 'FAIL',
        details: e.message,
      });
    }
  }

  // TEST 03: Structured Output Schema Strictness
  {
    try {
      assert(UNDERSTANDING_SCHEMA.type === 'OBJECT', 'Root must be object type');
      assert(Array.isArray(UNDERSTANDING_SCHEMA.required), 'Schema must declare required fields');
      assert(UNDERSTANDING_SCHEMA.required.includes('intent'), 'Must require intent');
      assert(UNDERSTANDING_SCHEMA.required.includes('entities'), 'Must require entities');
      assert(UNDERSTANDING_SCHEMA.required.includes('searchIntent'), 'Must require searchIntent');
      assert(UNDERSTANDING_SCHEMA.required.includes('searchReason'), 'Must require searchReason');
      assert(UNDERSTANDING_SCHEMA.required.includes('memoryIntent'), 'Must require memoryIntent');
      assert(UNDERSTANDING_SCHEMA.required.includes('memoryCandidate'), 'Must require memoryCandidate');
      assert(UNDERSTANDING_SCHEMA.required.includes('answer'), 'Must require answer');

      // Verify entity fields
      const entityProps = UNDERSTANDING_SCHEMA.properties.entities.properties;
      assert(entityProps.products !== undefined, 'Must support products entity');
      assert(entityProps.technicalTerms !== undefined, 'Must support technicalTerms entity');
      assert(entityProps.people !== undefined, 'Must support people entity');
      assert(entityProps.locations !== undefined, 'Must support locations entity');

      results.push({
        id: 'UNIT-03',
        name: 'Structured Output Schema Strictness',
        status: 'PASS',
        details: 'Full Gemini schema compliance verified',
      });
    } catch (e: any) {
      results.push({
        id: 'UNIT-03',
        name: 'Structured Output Schema Strictness',
        status: 'FAIL',
        details: e.message,
      });
    }
  }

  // TEST 04: Structured Output Validation & Sanitization
  {
    try {
      const mockRawGeminiOutput = {
        intent: 'general_query',
        complexity: 'simple',
        languageMode: 'malayalam',
        entities: {
          products: ['Python'],
          technicalTerms: ['programming'],
        },
        needsClarification: false,
        clarificationQuestion: null,
        futureToolIntent: null,
        searchIntent: 'not_required',
        searchReason: 'STABLE_KNOWLEDGE',
        memoryIntent: null,
        memoryCandidate: null,
        answer: 'പൈത്തൺ ഒരു പ്രോഗ്രാമിംഗ് ഭാഷയാണ്.',
      };

      const validated = validateUnderstandingResult(mockRawGeminiOutput);
      assert(validated.intent === 'general_query', 'Intent preserved');
      assert(validated.answer.includes('പൈത്തൺ'), 'Answer preserved');
      assert(Array.isArray(validated.entities.products), 'Entities normalized');
      assert(validated.entities.products[0] === 'Python', 'Product entity parsed');
      assert(Array.isArray(validated.entities.people), 'Missing array defaulted to empty array');

      results.push({
        id: 'UNIT-04',
        name: 'Structured Output Validation & Sanitization',
        status: 'PASS',
        details: 'Validation cleanly normalizes Gemini structured outputs',
      });
    } catch (e: any) {
      results.push({
        id: 'UNIT-04',
        name: 'Structured Output Validation & Sanitization',
        status: 'FAIL',
        details: e.message,
      });
    }
  }

  // TEST 05: Sensitive Secret Defense
  {
    try {
      const geminiKeyPrompt = 'Remember my key is AIzaSyD3x4mPl3K3y123456789012345678901';
      assert(MemoryService.isSensitiveSecret(geminiKeyPrompt), 'Must detect Google/Gemini API key');

      const passwordPrompt = 'My password is secretPassw0rd!123';
      assert(MemoryService.isSensitiveSecret(passwordPrompt), 'Must detect passwords');

      const normalPrompt = 'Remember that my project is called VAANI AI';
      assert(!MemoryService.isSensitiveSecret(normalPrompt), 'Normal project context must not be flagged as secret');

      results.push({
        id: 'UNIT-05',
        name: 'Sensitive Secret & Credential Defense',
        status: 'PASS',
        details: 'API keys and credentials reliably intercepted before memory storage',
      });
    } catch (e: any) {
      results.push({
        id: 'UNIT-05',
        name: 'Sensitive Secret & Credential Defense',
        status: 'FAIL',
        details: e.message,
      });
    }
  }

  // Summary
  console.log('\n--- UNIT TEST RESULTS SUMMARY ---');
  let passCount = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} [${r.id}] ${r.name}: ${r.status} (${r.details})`);
    if (r.status === 'PASS') passCount++;
  }
  console.log(`\nTOTAL: ${passCount}/${results.length} PASSED`);

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runUnitTests().catch((err) => {
  console.error('Fatal error running unit tests:', err);
  process.exit(1);
});
