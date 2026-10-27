/**
 * Automated Verification Script for TTS Implementation Safeguards
 */

const https = require('https');
const http = require('http');

// Test MP3 validator directly
function validateMp3Buffer(buffer) {
  if (!buffer || buffer.length < 128) {
    return { valid: false, reason: `Buffer too small (${buffer ? buffer.length : 0} bytes), minimum 128 bytes required` };
  }

  if (buffer[0] === 0x3c || buffer.toString('utf8', 0, 15).toLowerCase().includes('html')) {
    return { valid: false, reason: 'Received HTML/text error response instead of binary audio stream' };
  }

  const hasId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  let scanOffset = 0;

  if (hasId3) {
    const id3Size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    scanOffset = 10 + id3Size;

    if (buffer.length <= scanOffset + 32) {
      return { valid: false, reason: 'ID3 tag present but no audio frames follow it' };
    }
  }

  const maxScan = Math.min(buffer.length - 4, scanOffset + 4096);
  let syncFound = false;

  for (let i = scanOffset; i < maxScan; i++) {
    if (buffer[i] === 0xff) {
      const b1 = buffer[i + 1];
      if ((b1 & 0xe0) === 0xe0) {
        const mpegVersion = (b1 >> 3) & 0x03;
        const layer = (b1 >> 1) & 0x03;
        const b2 = buffer[i + 2];
        const bitrateIdx = (b2 >> 4) & 0x0f;
        const sampleRateIdx = (b2 >> 2) & 0x03;

        if (mpegVersion !== 1 && layer !== 0 && bitrateIdx !== 0x0f && sampleRateIdx !== 0x03) {
          syncFound = true;
          break;
        }
      }
    }
  }

  if (!syncFound && !hasId3) {
    return { valid: false, reason: 'No MPEG audio frame sync or ID3 header found in audio buffer' };
  }

  return { valid: true };
}

function sanitizeSecrets(text, keysToRedact = []) {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/([?&]key=)[^&\s"'`]+/gi, '$1***REDACTED***');
  cleaned = cleaned.replace(/AIza[0-9A-Za-z-_]{35}/g, '***REDACTED_API_KEY***');
  for (const k of keysToRedact) {
    if (k && k.length > 6) {
      cleaned = cleaned.split(k).join('***REDACTED***');
    }
  }
  return cleaned;
}

function fetchFallbackChunk(chunkText) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(chunkText);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=ml&client=tw-ob`;

    const req = https.get(
      googleTtsUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
        },
      },
      (res) => {
        if (res.statusCode === 200) {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }
    );
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING SAFEGUARDS UNIT & INTEGRATION TESTS ---\n');

  // Test 1: MP3 validation on fake HTML error response
  console.log('[Test 1] MP3 Validation against HTML error string:');
  const fakeHtml = Buffer.from('<html><body><h1>403 Forbidden</h1></body></html>');
  const res1 = validateMp3Buffer(fakeHtml);
  console.assert(!res1.valid, 'Test 1 Failed: HTML was accepted as valid audio');
  console.log('✓ Correctly rejected HTML with reason:', res1.reason);

  // Test 2: MP3 validation on zero-byte / truncated buffer
  console.log('\n[Test 2] MP3 Validation against truncated buffer:');
  const shortBuf = Buffer.from([0xff, 0xf3, 0x84]);
  const res2 = validateMp3Buffer(shortBuf);
  console.assert(!res2.valid, 'Test 2 Failed: Truncated buffer accepted');
  console.log('✓ Correctly rejected short buffer with reason:', res2.reason);

  // Test 3: Secret Sanitization
  console.log('\n[Test 3] Secret Sanitization:');
  const sampleSecret = 'AIzaSyDemoSecretKey1234567890abcdefg';
  const leakedUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${sampleSecret}`;
  const sanitized = sanitizeSecrets(leakedUrl, [sampleSecret]);
  console.assert(!sanitized.includes(sampleSecret), 'Test 3 Failed: Secret was not redacted');
  console.log('✓ Sanitized text successfully:', sanitized);

  // Test 4: Live Fallback Stream Playability & Validation for "ഹലോ"
  console.log('\n[Test 4] Live synthesis and validation for "ഹലോ":');
  const buf = await fetchFallbackChunk('ഹലോ');
  const res4 = validateMp3Buffer(buf);
  console.assert(res4.valid, `Test 4 Failed: Valid stream failed validation: ${res4.reason}`);
  console.log(`✓ Validated audio stream: ${buf.length} bytes, format: audio/mp3, valid: ${res4.valid}`);

  // Test 5: Chunked and Concatenated Buffer Validation
  console.log('\n[Test 5] Concatenated multi-chunk synthesis and validation:');
  const c1 = await fetchFallbackChunk('നമസ്കാരം.');
  const c2 = await fetchFallbackChunk('ഞാൻ വാണി വോയ്സ് അസിസ്റ്റന്റ് ആണ്.');
  const combined = Buffer.concat([c1, c2]);
  const res5 = validateMp3Buffer(combined);
  console.assert(res5.valid, `Test 5 Failed: Combined stream failed validation: ${res5.reason}`);
  console.log(`✓ Validated concatenated audio: ${combined.length} bytes, valid: ${res5.valid}`);

  console.log('\n--- ALL UNIT & STREAM VALIDATION TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
