const { setupTestDB, teardownTestDB } = require('./testDb');

// Global setup - runs once before all tests
beforeAll(async () => {
  await setupTestDB();
});

// Global teardown - runs once after all tests
afterAll(async () => {
  await teardownTestDB();
});

// Set longer timeout for database operations
jest.setTimeout(30000);