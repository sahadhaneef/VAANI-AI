const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
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
}, (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Full body:', data);
  });
});

req.write(payload);
req.end();
