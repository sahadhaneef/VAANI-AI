const https = require('node:https');
const fs = require('node:fs');

// Read GEMINI_API_KEY from .env
const env = fs.readFileSync('.env', 'utf8');
const keyMatch = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

console.log('Testing with API Key prefix:', apiKey.substring(0, 8) + '...');

// Test 1: Google Cloud Text-to-Speech API
function testGoogleCloudTTS() {
  return new Promise((resolve) => {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    const payload = JSON.stringify({
      input: { text: "നമസ്കാരം. ഞാൻ VAANI ആണ്." },
      voice: {
        languageCode: 'ml-IN',
        name: 'ml-IN-Chirp3-HD-Aoede'
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('[Test 1: Google Cloud TTS HTTP Status]:', res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.log('[Test 1: Error]:', parsed.error.status, parsed.error.message?.substring(0, 150));
          } else if (parsed.audioContent) {
            console.log('[Test 1: SUCCESS! audioContent bytes]:', parsed.audioContent.length);
          }
        } catch {
          console.log('[Test 1: Raw]:', data.substring(0, 150));
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', e => {
      console.log('[Test 1: Network error]:', e.message);
      resolve(0);
    });
    req.write(payload);
    req.end();
  });
}

// Test 2: Gemini TTS
function testGeminiTTS() {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: "നമസ്കാരം. ഞാൻ VAANI ആണ്." }]
      }]
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('[Test 2: Gemini TTS HTTP Status]:', res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            console.log('[Test 2: Error]:', parsed.error.status, parsed.error.message?.substring(0, 150));
          } else {
            const candidate = parsed.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            if (part?.inlineData) {
              console.log('[Test 2: SUCCESS! inlineData mimeType]:', part.inlineData.mimeType, 'length:', part.inlineData.data?.length);
            } else {
              console.log('[Test 2: Response parts]:', JSON.stringify(part).substring(0, 150));
            }
          }
        } catch {
          console.log('[Test 2: Raw]:', data.substring(0, 150));
        }
        resolve(res.statusCode);
      });
    });
    req.on('error', e => {
      console.log('[Test 2: Network error]:', e.message);
      resolve(0);
    });
    req.write(payload);
    req.end();
  });
}

async function run() {
  await testGoogleCloudTTS();
  await testGeminiTTS();
}
run();
