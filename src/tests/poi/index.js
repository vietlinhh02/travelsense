// POI Enrichment Test Suite
// Comprehensive tests for the POI enrichment system

module.exports = {
  // Unit Tests
  poiExtractorTests: require('./poiExtractor.test'),
  apiClientsTests: require('./apiClients.test'),
  poiCacheServiceTests: require('./poiCacheService.test'),
  
  // Integration Tests
  integrationTests: require('./integration.test')
};

/**
 * Test Coverage Summary:
 * 
 * 1. POI Extractor Tests (poiExtractor.test.js):
 *    - POI detection from activity titles and descriptions
 *    - Categorization and confidence scoring
 *    - Edge cases and error handling
 *    - Deduplication and language support
 *    - Performance tests
 * 
 * 2. API Clients Tests (apiClients.test.js):
 *    - Foursquare API client functionality
 *    - TripAdvisor API client functionality
 *    - Mock responses and fallback handling
 *    - Error handling and rate limiting
 *    - Parameter building and URL construction
 * 
 * 3. POI Cache Service Tests (poiCacheService.test.js):
 *    - Cache hit/miss scenarios
 *    - Data merging from multiple APIs
 *    - Batch processing and activity enrichment
 *    - Configuration management
 *    - Cache cleanup and maintenance
 * 
 * 4. Integration Tests (integration.test.js):
 *    - End-to-end POI enrichment flow
 *    - Integration with Long Trip Handler
 *    - Error handling in complete flow
 *    - Performance and scalability tests
 *    - Real-world scenario testing
 * 
 * Running Tests:
 * - Individual test files can be run separately
 * - Full test suite provides comprehensive coverage
 * - Mock data ensures tests run without external dependencies
 * - Performance tests validate scalability requirements
 */