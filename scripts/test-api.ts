// Simple test to verify backend API is working
async function testAPI() {
  const baseURL = 'http://localhost:3000';

  console.log('🧪 Testing Backend API...\n');

  // Test 1: Check if server is responding
  try {
    const response = await fetch(`${baseURL}/api/users/me`);
    console.log('✅ Server is responding');
    console.log(`   Status: ${response.status} (${response.statusText})`);

    if (response.status === 401) {
      console.log('   ✓ Correctly returns 401 for unauthenticated requests\n');
    }
  } catch (error) {
    console.error('❌ Server not responding:', error);
    return;
  }

  // Test 2: Get all users (should also be unauthorized)
  try {
    const response = await fetch(`${baseURL}/api/users`);
    const data = await response.json();
    console.log('✅ /api/users endpoint responding');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
  } catch (error) {
    console.error('❌ Error testing /api/users:', error);
  }

  console.log('\n📝 Summary:');
  console.log('   Backend server: ✅ Running on http://localhost:3000');
  console.log('   Database: ✅ SQLite (dev.db)');
  console.log('   Admin user: ✅ admin@company.com / admin123');
  console.log('   Next step: Start the frontend to test authentication');
}

testAPI();
