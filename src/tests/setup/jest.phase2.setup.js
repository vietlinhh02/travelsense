const { setupMockDB, teardownMockDB } = require('./mockDb');

// Setup for Phase 2 tests only
beforeAll(async () => {
  setupMockDB();
});

afterAll(async () => {
  await teardownMockDB();
});

// Set timeout for tests
jest.setTimeout(15000);