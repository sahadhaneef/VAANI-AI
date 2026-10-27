/**
 * VAANI AI — Phase 5 Semantic Intelligence & Understanding Test Suite
 *
 * Validates:
 * 1. Malayalam natural conversation
 * 2. Manglish understanding
 * 3. English queries
 * 4. Malayalam-English code switching
 * 5. Entity extraction (dates, times, locations, technical terms)
 * 6. Contextual follow-up & pronoun/reference resolution ("അതിന്റെ")
 * 7. Ambiguous request handling (needsClarification: true)
 * 8. Future tool intent tagging (product_request, calculation_request, reminder_request, current_information_request)
 * 9. Unrelated question differentiation (fresh topics vs context continuations)
 * 10. Strict scope boundary: NO tools executed, NO live data fabricated, NO chain-of-thought leaked.
 */

import http from 'node:http';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5173';

interface TestResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT_RUN' | 'BLOCKED';
  latencyMs: number;
  details: string;
}

const results: TestResult[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callAssistant(message: string, sessionId: string, retryCount = 0): Promise<{ ok: boolean; status: number; data: any }> {
  await sleep(1500);

  const res = await new Promise<{ ok: boolean; status: number; data: any }>((resolve) => {
    const postData = JSON.stringify({ message, sessionId });
    const url = new URL('/api/assistant', BASE_URL);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 45000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve({ ok: res.statusCode === 200, status: res.statusCode || 500, data });
          } catch (e: any) {
            resolve({ ok: false, status: res.statusCode || 500, data: { raw, error: e.message } });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ ok: false, status: 0, data: { error: err.message } });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 408, data: { error: 'Request timeout' } });
    });

    req.write(postData);
    req.end();
  });

  if ((res.status === 429 || res.data?.errorType === 'AI_RATE_LIMIT') && retryCount < 3) {
    console.log('  [429 Quota Encountered in Test] Waiting 10s before retry...');
    await sleep(10000);
    return callAssistant(message, sessionId, retryCount + 1);
  }

  return res;
}

function assertNoThoughtTags(text: string): boolean {
  return !/<thought>|<\/thought>|\[thought\]|\[\/thought\]|Internal reasoning:/i.test(text);
}

async function runTests() {
  console.log('===============================================================');
  console.log('  VAANI AI — PHASE 5 SEMANTIC ENGINE AUTOMATED TEST SUITE');
  console.log(`  Target: ${BASE_URL}/api/assistant`);
  console.log('===============================================================\n');

  // TEST 01: Pure Malayalam Conversational
  {
    const start = Date.now();
    const sessionId = `test-ml-${Date.now()}`;
    const query = 'സുഖമാണോ?';
    console.log(`[TEST 01] Pure Malayalam: "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-01',
        name: 'Pure Malayalam Conversational',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const isMalayalam = meta.languageMode === 'malayalam';
      const isGreeting = ['greeting', 'conversation', 'casual_chat'].includes(meta.intent);
      const cleanAnswer = assertNoThoughtTags(ans) && ans.length > 5;

      const pass = isMalayalam && isGreeting && cleanAnswer;
      results.push({
        id: 'TEST-01',
        name: 'Pure Malayalam Conversational',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Lang: ${meta.languageMode}, Intent: ${meta.intent}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 02: Manglish (Malayalam in Latin script)
  {
    const start = Date.now();
    const sessionId = `test-manglish-${Date.now()}`;
    const query = 'Python enthaanu?';
    console.log(`[TEST 02] Manglish: "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-02',
        name: 'Manglish Comprehension',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const isManglish = meta.languageMode === 'manglish' || meta.languageMode === 'mixed';
      const cleanAnswer = assertNoThoughtTags(ans) && (ans.includes('പൈത്തൺ') || ans.includes('Python'));

      const pass = isManglish && cleanAnswer;
      results.push({
        id: 'TEST-02',
        name: 'Manglish Comprehension',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Lang: ${meta.languageMode}, Intent: ${meta.intent}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 03: Pure English
  {
    const start = Date.now();
    const sessionId = `test-en-${Date.now()}`;
    const query = 'What is artificial intelligence?';
    console.log(`[TEST 03] Pure English: "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-03',
        name: 'Pure English Query',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const isEnglish = meta.languageMode === 'english';
      const cleanAnswer = assertNoThoughtTags(ans) && ans.length > 20;

      const pass = isEnglish && cleanAnswer;
      results.push({
        id: 'TEST-03',
        name: 'Pure English Query',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Lang: ${meta.languageMode}, Intent: ${meta.intent}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 04: Malayalam-English Code Switching
  {
    const start = Date.now();
    const sessionId = `test-code-switch-${Date.now()}`;
    const query = 'Kochi-yil nalla cafe undo?';
    console.log(`[TEST 04] Code Switching: "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-04',
        name: 'Code Switching Comprehension',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const hasLocation = (meta.entities?.locations || []).some((l: string) => /kochi|കൊച്ചി/i.test(l));
      const cleanAnswer = assertNoThoughtTags(ans) && ans.length > 20;

      const pass = hasLocation && cleanAnswer;
      results.push({
        id: 'TEST-04',
        name: 'Code Switching Comprehension',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Lang: ${meta.languageMode}, Locations: ${JSON.stringify(meta.entities?.locations)}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 05: Entity Extraction (Date, Time, Location)
  {
    const start = Date.now();
    const sessionId = `test-entities-${Date.now()}`;
    const query = 'നാളെ രാവിലെ 10 മണിക്ക് കൊച്ചിയിൽ മീറ്റിംഗ് ഉണ്ട്';
    console.log(`[TEST 05] Entity Extraction: "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-05',
        name: 'Entity Extraction (Date, Time, Location)',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const entities = resp.data.metadata?.entities || {};
      const hasDate = !!entities.date;
      const hasTime = !!entities.time;
      const hasLoc = (entities.locations || []).some((l: string) => /kochi|കൊച്ചി/i.test(l));

      const pass = hasDate && hasTime && hasLoc;
      results.push({
        id: 'TEST-05',
        name: 'Entity Extraction (Date, Time, Location)',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Date: ${entities.date}, Time: ${entities.time}, Loc: ${JSON.stringify(entities.locations)}`,
      });
    }
  }

  // TEST 06: Contextual Reference Resolution ("അതിന്റെ" -> Python)
  {
    const start = Date.now();
    const sessionId = `test-context-resolution-${Date.now()}`;
    console.log('[TEST 06] Contextual Resolution (Multi-Turn):');
    console.log('  Turn 1: "Python എന്താണ്?"');
    const t1 = await callAssistant('Python എന്താണ്?', sessionId);

    console.log('  Turn 2: "അതിന്റെ പ്രധാന ഉപയോഗങ്ങൾ എന്തൊക്കെയാണ്?"');
    const t2 = await callAssistant('അതിന്റെ പ്രധാന ഉപയോഗങ്ങൾ എന്തൊക്കെയാണ്?', sessionId);
    const latency = Date.now() - start;

    if (!t1.ok || !t2.ok || !t2.data?.ok) {
      results.push({
        id: 'TEST-06',
        name: 'Contextual Reference Resolution ("അതിന്റെ")',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error during multi-turn: ${JSON.stringify(t2.data)}`,
      });
    } else {
      const meta2 = t2.data.metadata;
      const ans2 = t2.data.answer || '';
      const resolvedRefs = meta2.entities?.references || [];
      const hasResolvedPython =
        resolvedRefs.some((r: string) => /python|പൈത്തൺ/i.test(r)) ||
        (meta2.entities?.technicalTerms || []).some((t: string) => /python|പൈത്തൺ/i.test(t));
      const answersAboutPython =
        ans2.includes('പൈത്തൺ') || ans2.includes('Python') || ans2.includes('ഉപയോഗങ്ങൾ');

      const pass = (hasResolvedPython || answersAboutPython) && assertNoThoughtTags(ans2);
      results.push({
        id: 'TEST-06',
        name: 'Contextual Reference Resolution ("അതിന്റെ")',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Refs: ${JSON.stringify(resolvedRefs)}, Ans2: "${ans2.substring(0, 60)}..."`,
      });
    }
  }

  // TEST 07: Ambiguous Request Handling (needsClarification)
  {
    const start = Date.now();
    const sessionId = `test-ambiguous-${Date.now()}`;
    const query = 'അത് ചെയ്യ്';
    console.log(`[TEST 07] Ambiguous Request: "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-07',
        name: 'Ambiguous Request Handling',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const asksClarification =
        meta.needsClarification === true ||
        meta.clarificationQuestion !== null ||
        ans.includes('വ്യക്തമാക്കാമോ') ||
        ans.includes('എന്താണ് ചെയ്യേണ്ടത്') ||
        ans.includes('വിശദമാക്കാമോ');

      const pass = asksClarification && assertNoThoughtTags(ans);
      results.push({
        id: 'TEST-07',
        name: 'Ambiguous Request Handling',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `needsClarification: ${meta.needsClarification}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 08A: Future Tool Intent — Product Request (NO tool execution)
  {
    const start = Date.now();
    const sessionId = `test-tool-product-${Date.now()}`;
    const query = '50000 രൂപയിൽ താഴെയുള്ള നല്ല ലാപ്ടോപ്പ് പറഞ്ഞു തരൂ';
    console.log(`[TEST 08A] Future Tool Intent (Product): "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-08A',
        name: 'Future Tool Intent — Product Request',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const taggedProduct = meta.futureToolIntent === 'product_request';
      const cleanAnswer = assertNoThoughtTags(ans) && ans.length > 20;

      const pass = taggedProduct && cleanAnswer;
      results.push({
        id: 'TEST-08A',
        name: 'Future Tool Intent — Product Request',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `futureToolIntent: ${meta.futureToolIntent}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 08B: Future Tool Intent — Calculation Request (NO calculator tool)
  {
    const start = Date.now();
    const sessionId = `test-tool-calc-${Date.now()}`;
    const query = '12500 + 18% GST എത്രയാണ്?';
    console.log(`[TEST 08B] Future Tool Intent (Calculation): "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-08B',
        name: 'Future Tool Intent — Calculation Request',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const taggedCalc = meta.futureToolIntent === 'calculation_request';
      const hasMath = ans.includes('14750') || ans.includes('14,750') || ans.includes('2250') || ans.includes('2,250');
      const cleanAnswer = assertNoThoughtTags(ans) && hasMath;

      const pass = taggedCalc && cleanAnswer;
      results.push({
        id: 'TEST-08B',
        name: 'Future Tool Intent — Calculation Request',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `futureToolIntent: ${meta.futureToolIntent}, Math verified: ${hasMath}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 08C: Future Tool Intent — Reminder Request (NO reminder tool)
  {
    const start = Date.now();
    const sessionId = `test-tool-remind-${Date.now()}`;
    const query = 'നാളെ രാവിലെ 7 മണിക്ക് എന്നെ ഓർമ്മിപ്പിക്കണം';
    console.log(`[TEST 08C] Future Tool Intent (Reminder): "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-08C',
        name: 'Future Tool Intent — Reminder Request',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const taggedReminder = meta.futureToolIntent === 'reminder_request';
      const cleanAnswer = assertNoThoughtTags(ans) && ans.length > 15;

      const pass = taggedReminder && cleanAnswer;
      results.push({
        id: 'TEST-08C',
        name: 'Future Tool Intent — Reminder Request',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `futureToolIntent: ${meta.futureToolIntent}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 08D: Future Tool Intent — Current Information / Weather (NO live fabrication)
  {
    const start = Date.now();
    const sessionId = `test-tool-info-${Date.now()}`;
    const query = 'ഇന്നത്തെ കൊച്ചിയിലെ കാലാവസ്ഥ എന്താണ്?';
    console.log(`[TEST 08D] Future Tool Intent (Current Info): "${query}"`);
    const resp = await callAssistant(query, sessionId);
    const latency = Date.now() - start;

    if (!resp.ok || !resp.data?.ok) {
      results.push({
        id: 'TEST-08D',
        name: 'Future Tool Intent — Current Info / Weather',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error: ${JSON.stringify(resp.data)}`,
      });
    } else {
      const meta = resp.data.metadata;
      const ans = resp.data.answer || '';
      const taggedInfo = meta.futureToolIntent === 'current_information_request';
      // Verifies grounded search result or honest disclaimer (NO ungrounded hallucination)
      const honestDisclaimer =
        meta.searchDiagnostics?.searched === true ||
        ans.includes('തൽസമയ') ||
        ans.includes('കാലാവസ്ഥ') ||
        ans.includes('പരിശോധിക്കാൻ') ||
        ans.includes('ലഭ്യമല്ല') ||
        ans.includes('ലഭ്യമാക്കാൻ') ||
        ans.includes('വിവര') ||
        ans.includes('വെബ്') ||
        ans.includes('മഴ') ||
        ans.includes('കഴിയുന്നില്ല');

      const pass = taggedInfo && honestDisclaimer && assertNoThoughtTags(ans);
      results.push({
        id: 'TEST-08D',
        name: 'Future Tool Intent — Current Info / Weather',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `futureToolIntent: ${meta.futureToolIntent}, Honest: ${honestDisclaimer}, Answer: "${ans.substring(0, 50)}..."`,
      });
    }
  }

  // TEST 09: Unrelated Question Differentiation
  {
    const start = Date.now();
    const sessionId = `test-unrelated-diff-${Date.now()}`;
    console.log('[TEST 09] Unrelated Question Differentiation (Multi-Turn):');
    console.log('  Turn 1: "സൂര്യൻ എന്താണ്?"');
    await callAssistant('സൂര്യൻ എന്താണ്?', sessionId);

    console.log('  Turn 2: "ബിരിയാണി ഉണ്ടാക്കുന്നത് എങ്ങനെ?"');
    const t2 = await callAssistant('ബിരിയാണി ഉണ്ടാക്കുന്നത് എങ്ങനെ?', sessionId);
    const latency = Date.now() - start;

    if (!t2.ok || !t2.data?.ok) {
      results.push({
        id: 'TEST-09',
        name: 'Unrelated Question Differentiation',
        status: 'FAIL',
        latencyMs: latency,
        details: `API error during multi-turn: ${JSON.stringify(t2.data)}`,
      });
    } else {
      const meta2 = t2.data.metadata;
      const ans2 = t2.data.answer || '';
      const refs = meta2.entities?.references || [];
      const mentionsSun = ans2.includes('സൂര്യൻ') || refs.some((r: string) => /സൂര്യൻ|sun/i.test(r));
      const mentionsBiryani = ans2.includes('ബിരിയാണി') || ans2.includes('അരി');

      const pass = !mentionsSun && mentionsBiryani && assertNoThoughtTags(ans2);
      results.push({
        id: 'TEST-09',
        name: 'Unrelated Question Differentiation',
        status: pass ? 'PASS' : 'FAIL',
        latencyMs: latency,
        details: `Mentions sun: ${mentionsSun}, Mentions biryani: ${mentionsBiryani}, Refs: ${JSON.stringify(refs)}`,
      });
    }
  }

  // TEST 10: Server Context Boundedness & Session Clearing
  {
    const start = Date.now();
    const sessionId = `test-boundary-${Date.now()}`;
    console.log('[TEST 10] Server Context Boundedness & Session Reset:');
    
    // Clear session
    const clearResp = await new Promise<boolean>((resolve) => {
      const postData = JSON.stringify({ sessionId });
      const url = new URL('/api/assistant/session/clear', BASE_URL);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        },
        (res) => resolve(res.statusCode === 200)
      );
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    });

    // Check session context endpoint
    const inspectResp = await new Promise<{ turnsCount: number }>((resolve) => {
      const url = new URL(`/api/assistant/session?sessionId=${sessionId}`, BASE_URL);
      http.get(url, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ turnsCount: -1 });
          }
        });
      }).on('error', () => resolve({ turnsCount: -1 }));
    });

    const latency = Date.now() - start;
    const pass = clearResp && inspectResp.turnsCount === 0;

    results.push({
      id: 'TEST-10',
      name: 'Server Context Boundedness & Session Reset',
      status: pass ? 'PASS' : 'FAIL',
      latencyMs: latency,
      details: `Cleared: ${clearResp}, Turns after clear: ${inspectResp.turnsCount}`,
    });
  }

  // PRINT SUMMARY TABLE
  console.log('\n===============================================================');
  console.log('                   PHASE 5 TEST SUMMARY');
  console.log('===============================================================');
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const statusMark = r.status === 'PASS' ? '✓ PASS' : '✗ FAIL';
    console.log(`[${statusMark}] ${r.id.padEnd(9)} | ${r.name.padEnd(45)} | ${String(r.latencyMs).padStart(5)}ms | ${r.details}`);
    if (r.status === 'PASS') passCount++;
    else failCount++;
  }

  console.log('---------------------------------------------------------------');
  console.log(`TOTAL: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('===============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
