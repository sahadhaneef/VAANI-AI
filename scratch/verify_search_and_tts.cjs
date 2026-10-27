const http = require('node:http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request(`http://localhost:5173${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 30000,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, raw: d });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('==================================================');
  console.log('STEP 1: TEST TTS ONLY (Malayalam)');
  console.log('==================================================');
  const ttsRes = await postJson('/api/tts', {
    text: 'നമസ്കാരം. ഞാൻ VAANI ആണ്. ഇന്ന് നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?',
    requestId: 'tts_audit_' + Date.now(),
  });
  console.log('TTS Status:', ttsRes.status);
  console.log('TTS ok:', ttsRes.data?.ok);
  console.log('TTS voice:', ttsRes.data?.voiceUsed);
  console.log('TTS format:', ttsRes.data?.format);
  console.log('TTS audio bytes:', ttsRes.data?.audioByteCount);
  
  if (ttsRes.data?.audioContent) {
    const buf = Buffer.from(ttsRes.data.audioContent, 'base64');
    const headerAscii = buf.toString('ascii', 0, 4);
    const subheaderAscii = buf.toString('ascii', 8, 12);
    console.log(`TTS Header verification: [${headerAscii} ... ${subheaderAscii}] Length: ${buf.length}`);
  }

  console.log('\n==================================================');
  console.log('STEP 2: TEST ASSISTANT SEARCH GROUNDING (Malayalam)');
  console.log('==================================================');
  const searchRes = await postJson('/api/assistant', {
    message: 'ഇന്നത്തെ latest news എന്താണ്?',
    requestId: 'search_audit_' + Date.now(),
    sessionId: 'sess_audit_' + Date.now(),
  });
  console.log('Assistant Status:', searchRes.status);
  console.log('Assistant ok:', searchRes.data?.ok);
  console.log('Search performed?:', searchRes.data?.metadata?.searchDiagnostics?.searched);
  console.log('Grounding used?:', searchRes.data?.metadata?.searchDiagnostics?.groundingUsed);
  console.log('Queries count:', searchRes.data?.metadata?.searchDiagnostics?.queryCount);
  console.log('Sources count:', searchRes.data?.metadata?.searchDiagnostics?.sourcesCount);
  console.log('Queries:', searchRes.data?.metadata?.searchDiagnostics?.queries);
  console.log('Answer preview:', searchRes.data?.answer?.substring(0, 200));

  console.log('\n==================================================');
  console.log('STEP 3: TEST ASSISTANT PYTHON VERSION SEARCH');
  console.log('==================================================');
  const pyRes = await postJson('/api/assistant', {
    message: 'What is the latest version of Python?',
    requestId: 'search_py_' + Date.now(),
    sessionId: 'sess_audit_' + Date.now(),
  });
  console.log('Python search Status:', pyRes.status);
  console.log('Python search Searched?:', pyRes.data?.metadata?.searchDiagnostics?.searched);
  console.log('Answer preview:', pyRes.data?.answer?.substring(0, 200));
}

run().catch(console.error);
