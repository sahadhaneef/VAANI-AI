const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

function testToolPayload(label, version, model, tools) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'What is the latest version of Python?' }] }],
      tools,
    });

    const t0 = Date.now();
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const elapsed = Date.now() - t0;
        console.log(`[${label}] HTTP ${res.statusCode} (${elapsed}ms)`);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            console.log('  SUCCESS candidate:', parsed.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100));
            console.log('  Grounding metadata:', !!parsed.candidates?.[0]?.groundingMetadata);
          } else {
            console.log('  Error:', parsed.error?.message?.substring(0, 150));
            console.log('  Status:', parsed.error?.status);
          }
        } catch (e) {
          console.log('  Raw:', data.substring(0, 150));
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`[${label}] Request error:`, err.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  await testToolPayload('v1beta googleSearch', 'v1beta', 'gemini-flash-lite-latest', [{ googleSearch: {} }]);
  await testToolPayload('v1beta google_search', 'v1beta', 'gemini-flash-lite-latest', [{ google_search: {} }]);
  await testToolPayload('v1beta googleSearchRetrieval', 'v1beta', 'gemini-flash-lite-latest', [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } } }]);
  await testToolPayload('v1 googleSearch', 'v1', 'gemini-flash-lite-latest', [{ googleSearch: {} }]);
}

run();
