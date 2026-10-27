const http = require('node:http');

async function testTTS(text, langLabel) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      text,
      requestId: `tts_test_${Date.now()}`
    });

    const req = http.request('http://localhost:5173/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        const isAudio = contentType.includes('audio');
        const isMp3 = buffer.length > 4 && (
          buffer.toString('utf8', 0, 3) === 'ID3' ||
          (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)
        );
        console.log(`[TTS Test: ${langLabel}] Status: ${res.statusCode} | Content-Type: ${contentType} | Bytes: ${buffer.length} | Playable Audio: ${isAudio || isMp3}`);
        resolve({ statusCode: res.statusCode, bytes: buffer.length, isAudio: isAudio || isMp3 });
      });
    });

    req.on('error', (err) => {
      console.log(`[TTS Test: ${langLabel}] Request error:`, err.message);
      resolve({ statusCode: 0, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== TTS / AUDIO OUTPUT AUDIT ===');
  await testTTS('What is machine learning?', 'English');
  await testTTS('ഇപ്പോൾ ഇന്ത്യയിലെ latest AI news എന്താണ്?', 'Malayalam');
}

run();
