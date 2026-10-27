const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

function testWithoutTools(modelName) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Hello, what is Python?' }] }],
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
        console.log(`[Without tools - ${modelName}] HTTP ${res.statusCode} (${elapsed}ms)`);
        if (res.statusCode !== 200) {
          console.log('Error:', data.substring(0, 200));
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

testWithoutTools('gemini-flash-lite-latest');
