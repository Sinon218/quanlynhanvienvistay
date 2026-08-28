const http = require('http');

function testEndpoint(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data.substring(0, 200) });
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function main() {
  // First login to get token
  const loginBody = JSON.stringify({ username: 'vistay', password: '12345678' });
  const loginReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', async () => {
      const loginData = JSON.parse(data);
      const token = loginData.token;
      console.log('Login: OK, token length:', token.length);

      // Test key endpoints
      const endpoints = [
        ['GET', '/config'],
        ['GET', '/auth/me'],
        ['GET', '/apartments'],
        ['GET', '/work/today'],
        ['GET', '/work/stats/1'],
        ['GET', '/salary/1'],
        ['GET', '/tasks/today'],
        ['GET', '/tasks/stats/1'],
        ['GET', '/apartments/notifications'],
      ];

      for (const [method, path] of endpoints) {
        try {
          const result = await testEndpoint(method, path, token);
          const status = result.status === 200 ? '✅' : '❌';
          console.log(`${status} ${method} ${path} → ${result.status} ${result.data.substring(0, 100)}`);
        } catch (err) {
          console.log(`❌ ${method} ${path} → ERROR: ${err.message}`);
        }
      }
      process.exit(0);
    });
  });

  loginReq.write(loginBody);
  loginReq.end();
}

main();
