// Simple test setup for Phase 2 - Mock database instead of real connections
const mongoose = require('mongoose');

// Mock mongoose methods to avoid real database connections
const setupMockDB = () => {
  // Mock mongoose connection
  if (!mongoose.connection.readyState) {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1, // Connected state
      configurable: true
    });
  }

  // Mock collection methods
  const mockCollection = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([])
    }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null)
    }),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
  };

  mongoose.connection.collections = mongoose.connection.collections || {};
  
  // Add mock collections for our models
  ['users', 'trips', 'embeddingdocuments', 'aiinteractionlogs', 'ratelimittrackers', 'searchquerylogs'].forEach(name => {
    if (!mongoose.connection.collections[name]) {
      mongoose.connection.collections[name] = mockCollection;
    }
  });

  // Mock mongoose.connect to do nothing
  if (!mongoose.connect._mock) {
    const originalConnect = mongoose.connect;
    mongoose.connect = jest.fn().mockResolvedValue(mongoose);
    mongoose.connect._mock = true;
    mongoose.connect.restore = () => {
      mongoose.connect = originalConnect;
    };
  }
};

const clearMockDB = async () => {
  // Clear all mocks
  Object.values(mongoose.connection.collections || {}).forEach(collection => {
    if (collection.deleteMany && collection.deleteMany.mockClear) {
      collection.deleteMany.mockClear();
    }
  });
};

const teardownMockDB = async () => {
  // Restore original mongoose.connect if mocked
  if (mongoose.connect.restore) {
    mongoose.connect.restore();
  }
};

module.exports = {
  setupMockDB,
  clearMockDB,
  teardownMockDB
};