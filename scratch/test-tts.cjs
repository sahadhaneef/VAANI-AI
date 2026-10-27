const https = require('https');

function splitIntoChunks(text, maxLen = 150) {
  const chunks = [];
  const regex = /([^.?!,\n;]+[.?!,\n;]+|[^.?!,\n;]+$)/g;
  const rawParts = text.match(regex) || [text];

  let currentChunk = '';
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if ((currentChunk + ' ' + trimmed).trim().length <= maxLen) {
      currentChunk = currentChunk ? currentChunk + ' ' + trimmed : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (trimmed.length > maxLen) {
        const words = trimmed.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = sub ? sub + ' ' + w : w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) chunks.push(sub);
        currentChunk = '';
      } else {
        currentChunk = trimmed;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text];
}

function fetchChunk(chunkText) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(chunkText);
    const googleTtsUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodedText + '&tl=ml&client=tw-ob';

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
          reject(new Error(`Google Audio Stream HTTP ${res.statusCode} for chunk "${chunkText.substring(0, 30)}"`));
        }
      }
    );

    req.on('error', (e) => reject(e));
  });
}

async function test() {
  const tests = [
    'ഹലോ',
    'പൈത്തൺ ഒരു പ്രോഗ്രാമിംഗ് ലാംഗ്വേജ് ആണ്. ഇത് പഠിക്കാൻ വളരെ എളുപ്പമാണ്.',
    'നമസ്കാരം! ഞാൻ വാണി, നിങ്ങളുടെ മലയാളം വോയ്‌സ് അസിസ്റ്റന്റ് ആണ്. നിങ്ങൾക്ക് എന്തെങ്കിലും വിവരങ്ങൾ വേണമെന്നുണ്ടെങ്കിൽ ചോദിക്കാം. ഇന്ന് കാലാവസ്ഥ അറിയണോ അതോ മറ്റ് എന്തെങ്കിലും സഹായം വേണമോ എന്ന് വ്യക്തമാക്കൂ.'
  ];
  for (const t of tests) {
    const chunks = splitIntoChunks(t, 150);
    console.log('Text len:', t.length, 'Chunks count:', chunks.length);
    const start = Date.now();
    const buffers = await Promise.all(chunks.map(c => fetchChunk(c)));
    const total = Buffer.concat(buffers);
    console.log('Success! Total bytes:', total.length, 'Elapsed:', Date.now() - start, 'ms');
  }
}
test().catch(console.error);
