const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

function get(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

function post(url, payload) {
  return new Promise((resolve) => {
    const p = JSON.stringify(payload);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(p),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(p);
    req.end();
  });
}

async function main() {
  console.log('--- 1. Fetching available models ---');
  const modelsRes = await get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (modelsRes.error || !modelsRes.data?.models) {
    console.log('Failed to fetch models:', modelsRes);
    return;
  }
  
  const generateModels = modelsRes.data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));
  
  console.log('Available generateContent models:', generateModels);

  console.log('\n--- 2. Testing Google Search tool with each model ---');
  for (const m of generateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: 'What is the latest version of Python?' }] }],
      tools: [{ google_search: {} }],
    };
    const res = await post(url, payload);
    console.log(`[${m}] Status: ${res.status}`);
    if (res.status === 200) {
      console.log(`  --> SUCCESS! Candidate text:`, res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100));
      console.log(`  --> Grounding metadata:`, JSON.stringify(res.data?.candidates?.[0]?.groundingMetadata)?.substring(0, 200));
    } else {
      console.log(`  --> Error:`, res.data?.error?.message?.substring(0, 150), `[${res.data?.error?.status}]`);
    }
    await new Promise(r => setTimeout(r, 600));
  }
}

main();
