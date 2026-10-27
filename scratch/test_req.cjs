const http = require('http');

const data = JSON.stringify({
  message: 'വാട്ട് ഈസ് ദി ലേറ്റസ്റ്റ് വേർഷൻ ഓഫ് പൈത്തൺ',
  sessionId: 'test_session_debug_1'
});

console.log('Sending request to /api/assistant...');
const t0 = Date.now();

const req = http.request('http://localhost:5173/api/assistant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
  timeout: 60000,
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Response HTTP ${res.statusCode} in ${Date.now() - t0}ms:`);
    console.log(body);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(data);
req.end();
