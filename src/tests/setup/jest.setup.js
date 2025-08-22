const { setupTestDB, teardownTestDB } = require('./testDb');
const mongoose = require('mongoose');

// Global setup - runs once before all tests
beforeAll(async () => {
  await setupTestDB();
});

// Global teardown - runs once after all tests
afterAll(async () => {
  await teardownTestDB();
  
  // Force close any remaining connections
  await mongoose.disconnect();
  
  // Give a moment for connections to fully close
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Set longer timeout for database operations
jest.setTimeout(60000);