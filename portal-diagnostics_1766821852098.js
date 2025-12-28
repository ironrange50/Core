/**
 * Portal Diagnostic Test Script
 * 
 * Run this in browser console (F12) on the portal dashboard
 * to test which endpoints are working and which are failing
 */

const PORTAL_SECRET = 'IraCoreApp1!';
const BASE_URL = 'http://localhost:3001'; // Adjust if different

async function testEndpoint(name, method, url, body = null) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${url}`);
  
  try {
    const options = {
      method,
      headers: {
        'X-Portal-Secret': PORTAL_SECRET,
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(BASE_URL + url, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (${response.status})`);
      console.log('   Response:', data);
      return { success: true, data };
    } else {
      console.log(`   ❌ FAILED (${response.status})`);
      console.log('   Error:', data);
      return { success: false, error: data };
    }
  } catch (err) {
    console.log(`   ❌ NETWORK ERROR`);
    console.log('   Error:', err.message);
    return { success: false, error: err.message };
  }
}

async function runDiagnostics() {
  console.log('🔍 PORTAL DIAGNOSTICS STARTING...\n');
  console.log('Portal Secret:', PORTAL_SECRET);
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(60));
  
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };
  
  // Test 1: Health check (should always work)
  const healthResult = await testEndpoint(
    'Health Check',
    'GET',
    '/api/health'
  );
  results.tests.push({ name: 'Health Check', ...healthResult });
  if (healthResult.success) results.passed++; else results.failed++;
  
  // Test 2: System AI Status
  const systemAiStatus = await testEndpoint(
    'System AI Status',
    'GET',
    '/api/system-ai/status'
  );
  results.tests.push({ name: 'System AI Status', ...systemAiStatus });
  if (systemAiStatus.success) results.passed++; else results.failed++;
  
  // Test 3: System AI Pause
  const systemAiPause = await testEndpoint(
    'System AI Pause',
    'POST',
    '/api/system-ai/pause'
  );
  results.tests.push({ name: 'System AI Pause', ...systemAiPause });
  if (systemAiPause.success) results.passed++; else results.failed++;
  
  // Test 4: System AI Resume
  const systemAiResume = await testEndpoint(
    'System AI Resume',
    'POST',
    '/api/system-ai/resume'
  );
  results.tests.push({ name: 'System AI Resume', ...systemAiResume });
  if (systemAiResume.success) results.passed++; else results.failed++;
  
  // Test 5: Maintenance Status
  const maintenanceStatus = await testEndpoint(
    'Maintenance Status',
    'GET',
    '/api/maintenance/status'
  );
  results.tests.push({ name: 'Maintenance Status', ...maintenanceStatus });
  if (maintenanceStatus.success) results.passed++; else results.failed++;
  
  // Test 6: Maintenance Snapshot Create
  const maintenanceSnapshot = await testEndpoint(
    'Create Snapshot',
    'POST',
    '/api/maintenance/snapshot/create',
    { type: 'manual', description: 'Test snapshot' }
  );
  results.tests.push({ name: 'Create Snapshot', ...maintenanceSnapshot });
  if (maintenanceSnapshot.success) results.passed++; else results.failed++;
  
  // Test 7: Maintenance Cleanup
  const maintenanceCleanup = await testEndpoint(
    'Run Cleanup',
    'POST',
    '/api/maintenance/cleanup/run',
    { target: 'all' }
  );
  results.tests.push({ name: 'Run Cleanup', ...maintenanceCleanup });
  if (maintenanceCleanup.success) results.passed++; else results.failed++;
  
  // Test 8: Optimizer Status
  const optimizerStatus = await testEndpoint(
    'Optimizer Status',
    'GET',
    '/api/optimizer/status'
  );
  results.tests.push({ name: 'Optimizer Status', ...optimizerStatus });
  if (optimizerStatus.success) results.passed++; else results.failed++;
  
  // Test 9: Optimizer Run
  const optimizerRun = await testEndpoint(
    'Optimizer Run',
    'POST',
    '/api/optimizer/run',
    { target: 'all' }
  );
  results.tests.push({ name: 'Optimizer Run', ...optimizerRun });
  if (optimizerRun.success) results.passed++; else results.failed++;
  
  // Test 10: Optimizer Scan
  const optimizerScan = await testEndpoint(
    'Optimizer Scan',
    'POST',
    '/api/optimizer/scan'
  );
  results.tests.push({ name: 'Optimizer Scan', ...optimizerScan });
  if (optimizerScan.success) results.passed++; else results.failed++;
  
  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY\n');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / results.tests.length) * 100)}%`);
  
  console.log('\n📋 FAILED TESTS:\n');
  const failedTests = results.tests.filter(t => !t.success);
  if (failedTests.length === 0) {
    console.log('   🎉 All tests passed!');
  } else {
    failedTests.forEach(test => {
      console.log(`   ❌ ${test.name}`);
      console.log(`      Error: ${test.error?.error || test.error}`);
    });
  }
  
  console.log('\n💡 RECOMMENDATIONS:\n');
  
  if (results.failed === results.tests.length) {
    console.log('   ⚠️  ALL TESTS FAILED');
    console.log('   → Check if backend server is running');
    console.log('   → Verify BASE_URL is correct');
    console.log('   → Check browser console for CORS errors');
  } else if (failedTests.some(t => t.error?.error?.includes('not allowed via portal'))) {
    console.log('   ⚠️  PORTAL AUTH ISSUE');
    console.log('   → Routes need portal authentication middleware');
    console.log('   → Apply the PORTAL_IMMEDIATE_HOTFIX.md');
    console.log('   → Add allowPortal middleware to failing routes');
  } else if (failedTests.some(t => t.error?.error?.includes('pending'))) {
    console.log('   ⚠️  OPTIMIZER PENDING ISSUE');
    console.log('   → Optimizer routes returning pending status');
    console.log('   → Routes should return completed status immediately');
    console.log('   → Or use WebSocket for async updates');
  } else if (failedTests.length < results.tests.length / 2) {
    console.log('   ⚠️  PARTIAL FAILURES');
    console.log('   → Some routes working, others not');
    console.log('   → Check each failing route has portal auth');
    console.log('   → Verify PORTAL_SECRET matches in .env');
  }
  
  console.log('\n📞 NEXT STEPS:\n');
  console.log('   1. Apply fixes from PORTAL_IMMEDIATE_HOTFIX.md');
  console.log('   2. Restart backend server');
  console.log('   3. Run this diagnostic again');
  console.log('   4. Share results if still failing');
  
  return results;
}

// Auto-run diagnostics
console.log('🚀 Running Portal Diagnostics...');
runDiagnostics().then(results => {
  console.log('\n✨ Diagnostics complete!');
  console.log('Copy/paste this entire output when asking for help.');
});
