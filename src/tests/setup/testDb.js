const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Setup function to start MongoDB Memory Server
const setupTestDB = async () => {
  try {
    // Create a new MongoDB Memory Server instance
    mongoServer = await MongoMemoryServer.create();
    
    // Get the URI from the MongoDB Memory Server
    const uri = mongoServer.getUri();
    
    // Connect mongoose to the in-memory database
    await mongoose.connect(uri, {
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0,   // Disable mongoose buffering
      maxPoolSize: 1         // Limit connection pool size
    });
    
    console.log('✅ Connected to in-memory MongoDB for testing');
  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    throw error;
  }
};

// Cleanup function to stop MongoDB Memory Server
const teardownTestDB = async () => {
  try {
    // Close all mongoose connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
    
    // Close any additional connections
    await mongoose.disconnect();
    
    // Stop the MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
    
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('❌ Error tearing down test database:', error);
    // Don't throw error in cleanup to avoid masking test errors
  }
};

// Clear all collections between tests
const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
    
    console.log('✅ Test database cleared');
  } catch (error) {
    console.error('❌ Error clearing test database:', error);
    throw error;
  }
};

module.exports = {
  setupTestDB,
  teardownTestDB,
  clearTestDB
};