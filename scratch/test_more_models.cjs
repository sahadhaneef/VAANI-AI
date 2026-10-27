const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

function testModel(m) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'What is the latest version of Python?' }] }],
      tools: [{ google_search: {} }],
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`[${m}] HTTP ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log(`  SUCCESS for ${m}!`);
        } else {
          try {
            const err = JSON.parse(d);
            console.log(`  ${err.error?.message?.substring(0, 100)} (${err.error?.status})`);
          } catch(e) {
            console.log('  raw:', d.substring(0, 100));
          }
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`[${m}] error:`, e.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  const models = [
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
    'gemini-3.1-pro-preview-customtools',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-omni-flash-preview',
    'gemini-omni-1.1-flash'
  ];
  for (const m of models) {
    await testModel(m);
  }
}

run();
