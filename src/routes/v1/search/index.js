const express = require('express');
const router = express.Router();
const { searchController, contentController } = require('../../../controllers/search');
const {
  vectorSearchValidation,
  hybridSearchValidation,
  textSearchValidation,
  locationSearchValidation,
  findSimilarValidation,
  recordInteractionValidation,
  documentIdValidation,
  indexDocumentValidation,
  batchIndexDocumentsValidation,
  updateDocumentValidation,
  getDocumentsQueryValidation,
  reindexDocumentsValidation,
  getAnalyticsQueryValidation,
  getPopularTermsQueryValidation
} = require('../../../validations/search.validation');
const { authenticateToken } = require('../../../validations/user.validation');

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Vector search and content discovery endpoints using MongoDB Atlas Vector Search
 */

/**
 * @swagger
 * /api/v1/search/vector:
 *   post:
 *     summary: Perform vector similarity search
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Text query for semantic search
 *                 example: "romantic restaurants with ocean views"
 *               queryVector:
 *                 type: array
 *                 items:
 *                   type: number
 *                 minItems: 768
 *                 maxItems: 768
 *                 description: Pre-computed 768-dimensional embedding vector
 *               sessionId:
 *                 type: string
 *                 description: Session ID for tracking search behavior
 *               filters:
 *                 type: object
 *                 properties:
 *                   documentTypes:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [activity, location, accommodation, restaurant, itinerary, review, guide, event, transportation]
 *                     description: Filter by document types
 *                   location:
 *                     type: object
 *                     properties:
 *                       country:
 *                         type: string
 *                         description: Filter by country
 *                       city:
 *                         type: string
 *                         description: Filter by city
 *                   attributes:
 *                     type: object
 *                     properties:
 *                       priceRange:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [budget, mid-range, luxury, free]
 *                         description: Filter by price ranges
 *                       minRating:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 5
 *                         description: Minimum rating filter
 *                       maxDuration:
 *                         type: integer
 *                         description: Maximum duration in minutes
 *                       categories:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Filter by categories
 *                       accessibility:
 *                         type: object
 *                         properties:
 *                           wheelchairAccessible:
 *                             type: boolean
 *                           familyFriendly:
 *                             type: boolean
 *                           petFriendly:
 *                             type: boolean
 *                       seasons:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [spring, summer, autumn, winter, year-round]
 *                   verified:
 *                     type: boolean
 *                     description: Filter by verified content only
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *                 description: Number of results to return
 *               offset:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Number of results to skip
 *               similarityThreshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.7
 *                 description: Minimum similarity score threshold
 *             oneOf:
 *               - required: [query]
 *               - required: [queryVector]
 *     responses:
 *       200:
 *         description: Vector search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Vector search completed successfully"
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentId:
 *                         type: string
 *                       documentType:
 *                         type: string
 *                       content:
 *                         type: object
 *                       location:
 *                         type: object
 *                       attributes:
 *                         type: object
 *                       similarityScore:
 *                         type: number
 *                         description: Cosine similarity score (0-1)
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     totalFound:
 *                       type: integer
 *                     totalReturned:
 *                       type: integer
 *                     processingTime:
 *                       type: integer
 *                       description: Processing time in milliseconds
 *                     hasMoreResults:
 *                       type: boolean
 *                     searchMethod:
 *                       type: string
 *                       example: "vector"
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /search/vector - Vector Search
router.post('/vector', vectorSearchValidation, searchController.vectorSearch);

/**
 * @swagger
 * /api/v1/search/hybrid:
 *   post:
 *     summary: Perform hybrid search combining vector and text search
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Text query for semantic and keyword search
 *                 example: "best Italian restaurants for dates"
 *               sessionId:
 *                 type: string
 *                 description: Session ID for tracking search behavior
 *               filters:
 *                 $ref: '#/components/schemas/SearchFilters'
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *               offset:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *               vectorWeight:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.7
 *                 description: Weight for vector search results
 *               textWeight:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.3
 *                 description: Weight for text search results
 *     responses:
 *       200:
 *         description: Hybrid search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hybrid search completed successfully"
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     searchMethod:
 *                       type: string
 *                       example: "hybrid"
 *                     vectorWeight:
 *                       type: number
 *                     textWeight:
 *                       type: number
 *       400:
 *         description: Bad request - Validation errors
 *       500:
 *         description: Server error
 */

// POST /search/hybrid - Hybrid Search
router.post('/hybrid', hybridSearchValidation, searchController.hybridSearch);

/**
 * @swagger
 * /api/v1/search/text:
 *   post:
 *     summary: Perform text-based keyword search
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Text query for keyword search
 *                 example: "museums art galleries Tokyo"
 *               sessionId:
 *                 type: string
 *                 description: Session ID for tracking search behavior
 *               filters:
 *                 $ref: '#/components/schemas/SearchFilters'
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *               offset:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       200:
 *         description: Text search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Text search completed successfully"
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     searchMethod:
 *                       type: string
 *                       example: "text"
 *       400:
 *         description: Bad request - Validation errors
 *       500:
 *         description: Server error
 */

// POST /search/text - Text Search
router.post('/text', textSearchValidation, searchController.textSearch);

/**
 * @swagger
 * /api/v1/search/location:
 *   post:
 *     summary: Perform location-based search with optional text query
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - longitude
 *               - latitude
 *             properties:
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 description: Longitude coordinate
 *                 example: 139.6917
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 description: Latitude coordinate
 *                 example: 35.6895
 *               radius:
 *                 type: integer
 *                 minimum: 100
 *                 maximum: 100000
 *                 default: 25000
 *                 description: Search radius in meters
 *               query:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Optional text query within location
 *                 example: "coffee shops"
 *               sessionId:
 *                 type: string
 *                 description: Session ID for tracking search behavior
 *               filters:
 *                 $ref: '#/components/schemas/SearchFilters'
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *               offset:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *     responses:
 *       200:
 *         description: Location search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Location search completed successfully"
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       distance:
 *                         type: number
 *                         description: Distance in kilometers from search center
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     searchMethod:
 *                       type: string
 *                       example: "location"
 *                     searchCenter:
 *                       type: object
 *                       properties:
 *                         longitude:
 *                           type: number
 *                         latitude:
 *                           type: number
 *                     searchRadius:
 *                       type: integer
 *       400:
 *         description: Bad request - Validation errors
 *       500:
 *         description: Server error
 */

// POST /search/location - Location Search
router.post('/location', locationSearchValidation, searchController.locationSearch);

/**
 * @swagger
 * /api/v1/search/recommendations:
 *   get:
 *     summary: Get personalized recommendations based on user preferences
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of recommendations to return
 *       - in: query
 *         name: documentTypes
 *         schema:
 *           type: string
 *         description: Comma-separated list of document types to include
 *         example: "activity,restaurant,accommodation"
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Location filter as "longitude,latitude,radius"
 *         example: "139.6917,35.6895,25000"
 *       - in: query
 *         name: diversityFactor
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.3
 *         description: Diversity factor (0=no diversity, 1=maximum diversity)
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Recommendations retrieved successfully"
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     personalized:
 *                       type: boolean
 *                       description: Whether recommendations are personalized
 *                     diversityFactor:
 *                       type: number
 *                     basedOnPreferences:
 *                       type: object
 *                       properties:
 *                         contentTypes:
 *                           type: integer
 *                         categories:
 *                           type: integer
 *                         destinations:
 *                           type: integer
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */

// GET /search/recommendations - Get Personalized Recommendations
router.get('/recommendations', authenticateToken, searchController.getRecommendations);

/**
 * @swagger
 * /api/v1/search/similar/{documentId}:
 *   get:
 *     summary: Find documents similar to a given document
 *     tags: [Search]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the reference document
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of similar documents to return
 *       - in: query
 *         name: similarityThreshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.6
 *         description: Minimum similarity score threshold
 *       - in: query
 *         name: sameType
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only return documents of the same type
 *       - in: query
 *         name: sameLocation
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Only return documents from the same location
 *     responses:
 *       200:
 *         description: Similar documents found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Similar documents found successfully"
 *                 referenceDocument:
 *                   type: object
 *                   properties:
 *                     documentId:
 *                       type: string
 *                     title:
 *                       type: string
 *                     type:
 *                       type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     similarityThreshold:
 *                       type: number
 *                     sameType:
 *                       type: boolean
 *                     sameLocation:
 *                       type: boolean
 *       400:
 *         description: Bad request - Invalid document ID
 *       404:
 *         description: Reference document not found
 *       500:
 *         description: Server error
 */

// GET /search/similar/:documentId - Find Similar Documents
router.get('/similar/:documentId', findSimilarValidation, searchController.findSimilar);

/**
 * @swagger
 * /api/v1/search/interaction:
 *   post:
 *     summary: Record user interaction with search results
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queryId
 *               - documentId
 *               - interactionType
 *               - position
 *             properties:
 *               queryId:
 *                 type: string
 *                 description: ID of the search query that returned this result
 *               documentId:
 *                 type: string
 *                 description: ID of the document user interacted with
 *               interactionType:
 *                 type: string
 *                 enum: [view, click, save, share, book]
 *                 description: Type of interaction
 *               position:
 *                 type: integer
 *                 minimum: 0
 *                 description: Position of the document in search results (0-based)
 *               additionalData:
 *                 type: object
 *                 properties:
 *                   timeSpent:
 *                     type: integer
 *                     description: Time spent viewing in seconds
 *                   satisfactionScore:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 5
 *                     description: User satisfaction score
 *                   actionType:
 *                     type: string
 *                     enum: [view_details, save_to_trip, share, get_directions, book]
 *                     description: Specific action taken
 *     responses:
 *       200:
 *         description: Interaction recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Interaction recorded successfully"
 *                 recorded:
 *                   type: boolean
 *       400:
 *         description: Bad request - Validation errors
 *       403:
 *         description: Access denied to this search query
 *       404:
 *         description: Search query not found
 *       500:
 *         description: Server error
 */

// POST /search/interaction - Record Search Interaction
router.post('/interaction', recordInteractionValidation, searchController.recordInteraction);

/**
 * @swagger
 * /api/v1/search/analytics:
 *   get:
 *     summary: Get user search analytics
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to include in analytics
 *       - in: query
 *         name: searchType
 *         schema:
 *           type: string
 *           enum: [vector, text, hybrid, location]
 *         description: Filter by search type
 *     responses:
 *       200:
 *         description: Search analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Search analytics retrieved successfully"
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     totalSearches:
 *                       type: integer
 *                     avgResultsFound:
 *                       type: number
 *                     avgProcessingTime:
 *                       type: number
 *                     successfulSearches:
 *                       type: integer
 *                     abandonedSearches:
 *                       type: integer
 *                     refinedSearches:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */

// GET /search/analytics - Get Search Analytics
router.get('/analytics', authenticateToken, getAnalyticsQueryValidation, searchController.getSearchAnalytics);

/**
 * @swagger
 * /api/v1/search/popular-terms:
 *   get:
 *     summary: Get popular search terms
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of popular terms to return
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 7
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Popular search terms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Popular search terms retrieved successfully"
 *                 popularTerms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       searchText:
 *                         type: string
 *                       searchCount:
 *                         type: integer
 *                       avgResultsFound:
 *                         type: number
 *                       uniqueUserCount:
 *                         type: integer
 *       400:
 *         description: Bad request - Invalid parameters
 *       500:
 *         description: Server error
 */

// GET /search/popular-terms - Get Popular Search Terms
router.get('/popular-terms', getPopularTermsQueryValidation, searchController.getPopularSearchTerms);

/**
 * @swagger
 * /api/v1/search/health:
 *   get:
 *     summary: Get search service health status
 *     tags: [Search]
 *     responses:
 *       200:
 *         description: Search service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Search service is healthy"
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 indexing:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                     avgQualityScore:
 *                       type: integer
 *                     byType:
 *                       type: array
 *                       items:
 *                         type: object
 *                 searchPerformance:
 *                   type: object
 *                 capabilities:
 *                   type: object
 *                   properties:
 *                     vectorSearch:
 *                       type: boolean
 *                     textSearch:
 *                       type: boolean
 *                     hybridSearch:
 *                       type: boolean
 *                     locationSearch:
 *                       type: boolean
 *                     personalizedRecommendations:
 *                       type: boolean
 *                     similaritySearch:
 *                       type: boolean
 *       500:
 *         description: Search service is unhealthy
 */

// GET /search/health - Search Service Health Check
router.get('/health', searchController.getSearchHealth);

// Content management routes
router.use('/content', require('./content'));

module.exports = router;