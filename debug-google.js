const request = require('supertest');
const app = require('./src/app');
const config = require('./src/config/config');
const mongoose = require('mongoose');
const User = require('./src/models/users/user.model');

async function testGoogleRateLimit() {
  try {
    console.log('Testing Google login rate limit...');
    
    const validGoogleToken = {
      tokenId: 'valid_google_token_id_12345'
    };
    
    const googleUserEmail = 'google.user@gmail.com';
    
    // Clean up
    await User.deleteOne({ email: googleUserEmail });
    
    console.log('1. Running 3 concurrent Google login requests...');
    
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        request(app)
          .post('/api/v1/users/google-login')
          .send(validGoogleToken)
      );
    }
    
    const responses = await Promise.all(promises);
    
    console.log('2. Results:');
    responses.forEach((response, index) => {
      console.log(`   Request ${index + 1}: Status ${response.status}`);
      if (response.status !== 200) {
        console.log(`   Error: ${JSON.stringify(response.body)}`);
      }
    });
    
    const successfulLogins = responses.filter(res => res.status === 200);
    console.log(`3. Successful logins: ${successfulLogins.length}/3`);
    
    if (successfulLogins.length !== 3) {
      console.log('❌ Test would fail - not all requests succeeded');
    } else {
      console.log('✅ Test would pass - all requests succeeded');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
  
  process.exit(0);
}

mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    testGoogleRateLimit();
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });