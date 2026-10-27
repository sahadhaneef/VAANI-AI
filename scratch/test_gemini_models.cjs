const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

function testModelSearch(modelName) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'What is the latest version of Python?' }] }],
      tools: [{ google_search: {} }],
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
        console.log(`[${modelName}] HTTP ${res.statusCode} (${elapsed}ms):`);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            const candidate = parsed.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text;
            const grounding = candidate?.groundingMetadata;
            console.log(`  SUCCESS! Text snippet: "${text?.substring(0, 100).replace(/\n/g, ' ')}..."`);
            console.log(`  Grounding queries:`, grounding?.webSearchQueries);
            console.log(`  Grounding chunks count:`, grounding?.groundingChunks?.length);
          } else {
            console.log(`  Error:`, parsed.error?.message?.substring(0, 150));
            console.log(`  Status:`, parsed.error?.status);
          }
        } catch (e) {
          console.log(`  Raw:`, data.substring(0, 150));
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`[${modelName}] Request error:`, err.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('--- Testing modern available models with google_search tool ---');
  for (const m of [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-3.1-flash-lite'
  ]) {
    await testModelSearch(m);
    await new Promise(r => setTimeout(r, 1000));
  }
}

run();
