const http = require('http');

const BASE_URL = 'http://localhost:3000';
const coachUser = { email: 'coach@theway.com', password: '123456' };

function makeRequest(method, path, body = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            cookies: res.headers['set-cookie'],
          });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function loginAsCoach() {
  const response = await makeRequest('POST', '/api/auth/login', coachUser);
  if (response.status === 200) {
    return response.cookies?.join('; ') || '';
  }
  return null;
}

async function registerUser(user, coachCookies) {
  const response = await makeRequest('POST', '/api/clients', user, coachCookies);
  return response.status === 201 || response.status === 200 ||
         (response.status === 400 && response.body?.error?.includes('קיים'));
}

async function loginUser(user) {
  const startTime = Date.now();
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: user.email,
      password: user.password,
    });
    const duration = Date.now() - startTime;
    return { success: response.status === 200, duration };
  } catch (error) {
    return { success: false, duration: Date.now() - startTime };
  }
}

async function stressTest(numUsers) {
  console.log(`\n⚙️  Testing with ${numUsers} concurrent users...`);

  // Create test users
  const testUsers = [];
  for (let i = 1; i <= numUsers; i++) {
    testUsers.push({
      email: `stress${Date.now()}u${i}@test.com`,
      password: 'TestPass123!',
      name: `StressTest${i}`,
    });
  }

  // Login as coach
  const coachCookies = await loginAsCoach();
  if (!coachCookies) {
    console.log('❌ Failed to authenticate as coach');
    return null;
  }

  // Register users
  for (const user of testUsers) {
    await registerUser(user, coachCookies);
  }

  // Concurrent logins
  const startTime = Date.now();
  const results = await Promise.all(testUsers.map(user => loginUser(user)));
  const totalTime = Date.now() - startTime;

  const successful = results.filter(r => r.success).length;
  const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const maxTime = Math.max(...results.map(r => r.duration));

  console.log(`  ✅ Success: ${successful}/${numUsers} (${(successful/numUsers*100).toFixed(1)}%)`);
  console.log(`  ⏱️  Avg: ${avgTime.toFixed(0)}ms | Max: ${maxTime}ms | Total: ${totalTime}ms`);

  return { numUsers, successful, avgTime, maxTime, totalTime };
}

async function runStressTests() {
  console.log('\n🔥 Stress Testing: Finding Maximum Concurrent Users\n');
  console.log('─'.repeat(60));

  const testSizes = [5, 10, 20, 50];
  const results = [];

  for (const size of testSizes) {
    const result = await stressTest(size);
    if (result) {
      results.push(result);
    }
    await new Promise(r => setTimeout(r, 500)); // Delay between tests
  }

  console.log('\n\n📊 Summary:\n');
  console.log('─'.repeat(60));
  console.log('Users | Success Rate | Avg Time | Max Time | Total Time');
  console.log('─'.repeat(60));

  for (const r of results) {
    const successRate = (r.successful / r.numUsers * 100).toFixed(1);
    console.log(`  ${r.numUsers.toString().padEnd(4)} | ${successRate.padEnd(12)}% | ${r.avgTime.toFixed(0).padEnd(8)}ms | ${r.maxTime.padEnd(8)}ms | ${r.totalTime}ms`);
  }

  console.log('\n─'.repeat(60));
  console.log('\n✅ Stress test complete!');
  process.exit(0);
}

runStressTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
