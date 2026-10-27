const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

function testModel(modelName, query) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
    });

    const t0 = Date.now();
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const elapsed = Date.now() - t0;
        console.log(`[${modelName}] Status: ${res.statusCode} (${elapsed}ms)`);
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            const candidate = parsed.candidates?.[0];
            console.log('--- Candidate Text ---');
            console.log(candidate?.content?.parts?.[0]?.text);
            console.log('\n--- Grounding Metadata ---');
            console.log(JSON.stringify(candidate?.groundingMetadata, null, 2));
          } else {
            console.log('Error:', parsed.error);
          }
        } catch (e) {
          console.log('Raw:', data);
        }
        resolve();
      });
    });

    req.on('error', err => {
      console.log('Req error:', err.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('Testing "ഇന്നത്തെ latest news എന്താണ്?" on gemini-robotics-er-2-preview:');
  await testModel('gemini-robotics-er-2-preview', 'ഇന്നത്തെ latest news എന്താണ്?');
}

run();
