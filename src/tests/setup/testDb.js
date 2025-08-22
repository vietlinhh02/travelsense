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
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
    // Close mongoose connections
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    // Stop the MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('❌ Error tearing down test database:', error);
    throw error;
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