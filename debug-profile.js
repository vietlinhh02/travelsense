const request = require('supertest');
const app = require('./src/app');
const jwt = require('jsonwebtoken');
const config = require('./src/config/config');

async function testProfileUpdate() {
  try {
    console.log('Starting profile update debug test...');
    
    // First register a user
    const userData = {
      email: `debug.test.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Debug',
      lastName: 'Test'
    };
    
    console.log('1. Registering user...');
    const registerResponse = await request(app)
      .post('/api/v1/users/register')
      .send(userData);
    
    console.log('Register response status:', registerResponse.status);
    console.log('Register response body:', JSON.stringify(registerResponse.body, null, 2));
    
    if (registerResponse.status !== 201) {
      throw new Error('Failed to register user');
    }
    
    const accessToken = registerResponse.body.accessToken;
    console.log('2. Access token obtained:', accessToken ? 'Yes' : 'No');
    
    // Now try to update profile
    const updateData = {
      firstName: 'UpdatedDebug',
      lastName: 'UpdatedTest'
    };
    
    console.log('3. Updating profile with data:', JSON.stringify(updateData, null, 2));
    
    const updateResponse = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(updateData);
    
    console.log('Update response status:', updateResponse.status);
    console.log('Update response body:', JSON.stringify(updateResponse.body, null, 2));
    
    if (updateResponse.status === 500) {
      console.log('❌ 500 Error detected - This is the issue we need to fix');
    } else {
      console.log('✅ Profile update successful');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

// Set up MongoDB connection first
const mongoose = require('mongoose');

mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    testProfileUpdate();
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });