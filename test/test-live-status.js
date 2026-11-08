const http = require('http');
const { extractRouterStatus } = require('./test-router-status-parser');

http.get('http://186.186.0.1/status', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const status = extractRouterStatus(data);
    console.log('Status code:', res.statusCode);
    console.log('Router info:', status);
  });
}).on('error', err => {
  console.error('Error:', err.message);
});
