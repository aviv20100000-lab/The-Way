const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test users
const testUsers = [
  { email: 'loadtest1@test.com', password: 'TestPass123!', name: 'LoadTest1' },
  { email: 'loadtest2@test.com', password: 'TestPass123!', name: 'LoadTest2' },
  { email: 'loadtest3@test.com', password: 'TestPass123!', name: 'LoadTest3' },
  { email: 'loadtest4@test.com', password: 'TestPass123!', name: 'LoadTest4' },
  { email: 'loadtest5@test.com', password: 'TestPass123!', name: 'LoadTest5' },
];

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
            time: Date.now(),
          });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, time: Date.now(), headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function loginAsCoach() {
  console.log('🔐 Logging in as coach...');
  try {
    const response = await makeRequest('POST', '/api/auth/login', coachUser);

    if (response.status === 200) {
      console.log('✅ Coach logged in');
      const cookies = response.cookies?.join('; ') || '';
      return cookies;
    } else {
      console.log('❌ Coach login failed:', response.status, response.body?.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Error logging in as coach:', error.message);
    return null;
  }
}

async function registerUser(user, coachCookies) {
  console.log(`📝 Registering ${user.email}...`);
  try {
    const response = await makeRequest('POST', '/api/clients', user, coachCookies);

    if (response.status === 201 || response.status === 200) {
      console.log(`✅ ${user.email} registered successfully`);
      return true;
    } else if (response.status === 400 && response.body?.error?.includes('קיים')) {
      console.log(`⚠️ ${user.email} already exists`);
      return true;
    } else {
      console.log(`❌ Failed to register ${user.email}:`, response.status, response.body?.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error registering ${user.email}:`, error.message);
    return false;
  }
}

async function loginUser(user) {
  const startTime = Date.now();
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: user.email,
      password: user.password,
    });

    const duration = Date.now() - startTime;

    if (response.status === 200) {
      console.log(`✅ ${user.email} logged in (${duration}ms)`);
      return { success: true, duration };
    } else {
      console.log(`❌ ${user.email} login failed (${duration}ms):`, response.status, response.body?.error);
      return { success: false, duration };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Error logging in ${user.email} (${duration}ms):`, error.message);
    return { success: false, duration };
  }
}

async function runLoadTest() {
  console.log('\n🚀 Starting Load Test: 5 Concurrent Users\n');
  console.log('─'.repeat(50));

  // Step 0: Login as coach
  console.log('\n🔐 Step 1: Authenticate as Coach\n');
  const coachCookies = await loginAsCoach();
  if (!coachCookies) {
    console.log('❌ Failed to authenticate as coach');
    process.exit(1);
  }

  // Step 1: Register users (sequential)
  console.log('\n\n📋 Step 2: Register Test Users\n');
  for (const user of testUsers) {
    await registerUser(user, coachCookies);
    await new Promise(r => setTimeout(r, 150)); // Small delay between registrations
  }

  // Step 2: Concurrent logins
  console.log('\n\n🔐 Step 3: Concurrent Login Test\n');
  console.log('Logging in 5 users simultaneously...\n');

  const startTime = Date.now();
  const results = await Promise.all(testUsers.map(user => loginUser(user)));
  const totalTime = Date.now() - startTime;

  // Step 3: Results
  console.log('\n\n📊 Results:\n');
  console.log('─'.repeat(50));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const minTime = Math.min(...results.map(r => r.duration));
  const maxTime = Math.max(...results.map(r => r.duration));

  console.log(`
Total Concurrent Users:    ${testUsers.length}
Successful Logins:         ${successful}/${testUsers.length} ✅
Failed Logins:             ${failed}/${testUsers.length} ❌

Timing:
  Total Time:              ${totalTime}ms
  Average Response Time:   ${avgTime.toFixed(2)}ms
  Min Response Time:       ${minTime}ms
  Max Response Time:       ${maxTime}ms

Status: ${successful === testUsers.length ? '🟢 ALL PASSED' : '🔴 SOME FAILED'}
  `);
  console.log('─'.repeat(50));

  process.exit(successful === testUsers.length ? 0 : 1);
}

runLoadTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
