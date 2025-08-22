const { validationResult } = require('express-validator');
const { vectorSearchService, contentIndexingService } = require('../../services/search');
const { responseService } = require('../../services/common');

// Vector Search
const vectorSearch = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user?.userId;

    // Generate session ID if not provided
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract search parameters
    const {
      query,
      queryVector,
      filters = {},
      limit = 20,
      offset = 0,
      similarityThreshold = 0.7
    } = req.body;

    const searchParams = {
      query,
      queryVector,
      userId,
      sessionId,
      filters,
      limit: Math.min(100, Math.max(1, limit)), // Ensure reasonable limits
      offset: Math.max(0, offset),
      similarityThreshold: Math.min(1, Math.max(0, similarityThreshold))
    };

    // Perform vector search
    const result = await vectorSearchService.vectorSearch(searchParams);

    console.log(`Vector search completed for user ${userId || 'anonymous'}, query: "${query}", results: ${result.results.length}`);
    
    responseService.sendSuccess(res, result, 'Vector search completed successfully');
  } catch (error) {
    console.error('Vector search error:', error);
    responseService.handleServiceError(res, error, 'Vector search failed');
  }
};

// Hybrid Search (Vector + Text)
const hybridSearch = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const userId = req.user?.userId;
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const {
      query,
      filters = {},
      limit = 20,
      offset = 0,
      vectorWeight = 0.7,
      textWeight = 0.3
    } = req.body;

    const searchParams = {
      query,
      userId,
      sessionId,
      filters,
      limit: Math.min(100, Math.max(1, limit)),
      offset: Math.max(0, offset),
      vectorWeight: Math.min(1, Math.max(0, vectorWeight)),
      textWeight: Math.min(1, Math.max(0, textWeight))
    };

    // Perform hybrid search
    const result = await vectorSearchService.hybridSearch(searchParams);

    console.log(`Hybrid search completed for user ${userId || 'anonymous'}, query: "${query}", results: ${result.results.length}`);
    
    responseService.sendSuccess(res, result, 'Hybrid search completed successfully');
  } catch (error) {
    console.error('Hybrid search error:', error);
    responseService.handleServiceError(res, error, 'Hybrid search failed');
  }
};

// Text Search
const textSearch = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const userId = req.user?.userId;
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const {
      query,
      filters = {},
      limit = 20,
      offset = 0
    } = req.body;

    const searchParams = {
      query,
      userId,
      sessionId,
      filters,
      limit: Math.min(100, Math.max(1, limit)),
      offset: Math.max(0, offset)
    };

    // Perform text search
    const result = await vectorSearchService.textSearch(searchParams);

    console.log(`Text search completed for user ${userId || 'anonymous'}, query: "${query}", results: ${result.results.length}`);
    
    responseService.sendSuccess(res, result, 'Text search completed successfully');
  } catch (error) {
    console.error('Text search error:', error);
    responseService.handleServiceError(res, error, 'Text search failed');
  }
};

// Location-based Search
const locationSearch = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const userId = req.user?.userId;
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const {
      longitude,
      latitude,
      radius = 25000,
      query,
      filters = {},
      limit = 20,
      offset = 0
    } = req.body;

    const searchParams = {
      longitude,
      latitude,
      radius: Math.min(100000, Math.max(100, radius)), // 100m to 100km
      query,
      userId,
      sessionId,
      filters,
      limit: Math.min(100, Math.max(1, limit)),
      offset: Math.max(0, offset)
    };

    // Perform location search
    const result = await vectorSearchService.locationSearch(searchParams);

    console.log(`Location search completed for user ${userId || 'anonymous'}, location: [${longitude}, ${latitude}], results: ${result.results.length}`);
    
    responseService.sendSuccess(res, result, 'Location search completed successfully');
  } catch (error) {
    console.error('Location search error:', error);
    responseService.handleServiceError(res, error, 'Location search failed');
  }
};

// Get Personalized Recommendations
const getRecommendations = async (req, res) => {
  try {
    // User ID comes from JWT token
    const userId = req.user.userId;

    // Extract query parameters
    const {
      limit = 20,
      documentTypes,
      location,
      diversityFactor = 0.3
    } = req.query;

    const options = {
      limit: Math.min(50, Math.max(1, parseInt(limit) || 20)),
      documentTypes: documentTypes ? documentTypes.split(',') : undefined,
      diversityFactor: Math.min(1, Math.max(0, parseFloat(diversityFactor) || 0.3))
    };

    // Parse location if provided
    if (location) {
      try {
        const [longitude, latitude, radius] = location.split(',').map(parseFloat);
        if (!isNaN(longitude) && !isNaN(latitude)) {
          options.location = {
            longitude,
            latitude,
            radius: !isNaN(radius) ? Math.min(100000, Math.max(100, radius)) : 25000
          };
        }
      } catch (error) {
        // Invalid location format, ignore
      }
    }

    // Get personalized recommendations
    const result = await vectorSearchService.getPersonalizedRecommendations(userId, options);

    console.log(`Recommendations retrieved for user ${userId}, personalized: ${result.metadata.personalized}, results: ${result.results.length}`);
    
    responseService.sendSuccess(res, result, 'Recommendations retrieved successfully');
  } catch (error) {
    console.error('Get recommendations error:', error);
    responseService.handleServiceError(res, error, 'Failed to get recommendations');
  }
};

// Find Similar Documents
const findSimilar = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { documentId } = req.params;
    const {
      limit = 10,
      similarityThreshold = 0.6,
      sameType = true,
      sameLocation = false
    } = req.query;

    const options = {
      limit: Math.min(50, Math.max(1, parseInt(limit) || 10)),
      similarityThreshold: Math.min(1, Math.max(0, parseFloat(similarityThreshold) || 0.6)),
      sameType: sameType === 'true',
      sameLocation: sameLocation === 'true'
    };

    // Find similar documents
    const result = await vectorSearchService.findSimilarDocuments(documentId, options);

    console.log(`Similar documents found for ${documentId}, results: ${result.results.length}`);
    
    responseService.sendSuccess(res, result, 'Similar documents found successfully');
  } catch (error) {
    console.error('Find similar documents error:', error);
    responseService.handleServiceError(res, error, 'Failed to find similar documents');
  }
};

// Record Search Interaction
const recordInteraction = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const userId = req.user?.userId;
    const {
      queryId,
      documentId,
      interactionType,
      position,
      additionalData = {}
    } = req.body;

    // Find the search query log
    const { SearchQueryLog } = require('../../models/search');
    const queryLog = await SearchQueryLog.findOne({ queryId });

    if (!queryLog) {
      return responseService.sendError(res, 'Search query not found', 404);
    }

    // Verify the user has access to this query (if user is authenticated)
    if (userId && queryLog.userId && queryLog.userId.toString() !== userId) {
      return responseService.sendError(res, 'Access denied to this search query', 403);
    }

    // Record the interaction
    await queryLog.recordInteraction(interactionType, documentId, position, additionalData);

    // Update user preferences if applicable
    if (userId && interactionType !== 'view') {
      const { SearchPreferences, EmbeddingDocument } = require('../../models/search');
      
      const document = await EmbeddingDocument.findOne({ documentId });
      if (document) {
        const preferences = await SearchPreferences.getOrCreatePreferences(userId);
        await preferences.updateContentPreferences(
          document.documentType,
          document.content.category,
          interactionType,
          additionalData.satisfactionScore
        );
      }
    }

    console.log(`Interaction recorded: ${interactionType} on ${documentId} by user ${userId || 'anonymous'}`);
    
    responseService.sendSuccess(res, { recorded: true }, 'Interaction recorded successfully');
  } catch (error) {
    console.error('Record interaction error:', error);
    responseService.handleServiceError(res, error, 'Failed to record interaction');
  }
};

// Get Search Analytics
const getSearchAnalytics = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token
    const userId = req.user.userId;

    const {
      timeframe = 30,
      searchType
    } = req.query;

    const filters = {
      userId,
      ...(searchType && { searchType }),
      startDate: new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000),
      endDate: new Date()
    };

    // Get search analytics
    const { SearchQueryLog } = require('../../models/search');
    const analytics = await SearchQueryLog.getSearchAnalytics(filters);

    console.log(`Search analytics retrieved for user ${userId}, timeframe: ${timeframe} days`);
    
    responseService.sendSuccess(res, { analytics }, 'Search analytics retrieved successfully');
  } catch (error) {
    console.error('Get search analytics error:', error);
    responseService.handleServiceError(res, error, 'Failed to get search analytics');
  }
};

// Get Popular Search Terms
const getPopularSearchTerms = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const {
      limit = 20,
      timeframe = 7
    } = req.query;

    const options = {
      limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
      timeframe: Math.min(365, Math.max(1, parseInt(timeframe) || 7))
    };

    // Get popular search terms
    const { SearchQueryLog } = require('../../models/search');
    const popularTerms = await SearchQueryLog.getPopularSearchTerms(options.limit, options.timeframe);

    console.log(`Popular search terms retrieved, timeframe: ${options.timeframe} days, results: ${popularTerms.length}`);
    
    responseService.sendSuccess(res, { popularTerms }, 'Popular search terms retrieved successfully');
  } catch (error) {
    console.error('Get popular search terms error:', error);
    responseService.handleServiceError(res, error, 'Failed to get popular search terms');
  }
};

// Search Health Check
const getSearchHealth = async (req, res) => {
  try {
    // Get indexing statistics
    const indexingStats = await contentIndexingService.getIndexingStats();

    // Get recent search performance
    const { SearchQueryLog } = require('../../models/search');
    const recentPerformance = await SearchQueryLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }
      },
      {
        $group: {
          _id: '$results.searchMethod',
          totalSearches: { $sum: 1 },
          avgProcessingTime: { $avg: '$results.processingTime' },
          avgResultsFound: { $avg: '$results.totalFound' },
          successRate: {
            $avg: {
              $cond: [{ $gt: ['$results.totalFound', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      indexing: {
        totalDocuments: indexingStats.overview.totalDocuments,
        avgQualityScore: Math.round(indexingStats.overview.avgQualityScore || 0),
        byType: indexingStats.byType
      },
      searchPerformance: recentPerformance.reduce((acc, perf) => {
        acc[perf._id] = {
          totalSearches: perf.totalSearches,
          avgProcessingTime: Math.round(perf.avgProcessingTime || 0),
          avgResultsFound: Math.round(perf.avgResultsFound || 0),
          successRate: Math.round((perf.successRate || 0) * 100)
        };
        return acc;
      }, {}),
      capabilities: {
        vectorSearch: true,
        textSearch: true,
        hybridSearch: true,
        locationSearch: true,
        personalizedRecommendations: true,
        similaritySearch: true
      }
    };

    console.log('Search health status checked');
    
    responseService.sendSuccess(res, healthStatus, 'Search service is healthy');
  } catch (error) {
    console.error('Get search health error:', error);
    responseService.handleServiceError(res, error, 'Search health check failed');
  }
};

module.exports = {
  vectorSearch,
  hybridSearch,
  textSearch,
  locationSearch,
  getRecommendations,
  findSimilar,
  recordInteraction,
  getSearchAnalytics,
  getPopularSearchTerms,
  getSearchHealth
};