const request = require('supertest');
const app = require('./src/app');
const config = require('./src/config/config');
const mongoose = require('mongoose');

async function testNestedUpdate() {
  try {
    console.log('Starting nested object update debug test...');
    
    // Register a user
    const userData = {
      email: `nested.test.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Nested',
      lastName: 'Test'
    };
    
    console.log('1. Registering user...');
    const registerResponse = await request(app)
      .post('/api/v1/users/register')
      .send(userData);
    
    if (registerResponse.status !== 201) {
      throw new Error('Failed to register user');
    }
    
    const accessToken = registerResponse.body.accessToken;
    
    // Test preferences update
    const preferencesUpdate = {
      preferences: {
        interests: ['travel', 'photography', 'food'],
        constraints: ['budget-friendly', 'pet-friendly'],
        travelStyle: 'adventure',
        budgetRange: 'medium'
      }
    };
    
    console.log('2. Testing preferences update...');
    console.log('Update data:', JSON.stringify(preferencesUpdate, null, 2));
    
    const preferencesResponse = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(preferencesUpdate);
    
    console.log('Preferences response status:', preferencesResponse.status);
    console.log('Preferences response body:', JSON.stringify(preferencesResponse.body, null, 2));
    
    if (preferencesResponse.status === 500) {
      console.log('❌ Preferences update failed');
    } else {
      console.log('✅ Preferences update successful');
    }
    
    // Test profile update
    const profileUpdate = {
      profile: {
        dateOfBirth: '1990-05-15',
        nationality: 'American',
        languages: ['English', 'Spanish', 'French'],
        specialRequirements: ['wheelchair accessible', 'vegetarian meals']
      }
    };
    
    console.log('3. Testing profile update...');
    console.log('Update data:', JSON.stringify(profileUpdate, null, 2));
    
    const profileResponse = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(profileUpdate);
    
    console.log('Profile response status:', profileResponse.status);
    console.log('Profile response body:', JSON.stringify(profileResponse.body, null, 2));
    
    if (profileResponse.status === 500) {
      console.log('❌ Profile update failed');
    } else {
      console.log('✅ Profile update successful');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    testNestedUpdate();
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });