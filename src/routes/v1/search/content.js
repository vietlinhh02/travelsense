const express = require('express');
const router = express.Router();
const { contentController } = require('../../../controllers/search');
const {
  indexDocumentValidation,
  batchIndexDocumentsValidation,
  updateDocumentValidation,
  documentIdValidation,
  getDocumentsQueryValidation,
  reindexDocumentsValidation
} = require('../../../validations/search.validation');
const { authenticateToken } = require('../../../validations/user.validation');

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Content indexing and document management endpoints
 */

/**
 * @swagger
 * /api/v1/search/content:
 *   post:
 *     summary: Index a single document for vector search
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - documentType
 *               - content
 *               - location
 *               - source
 *             properties:
 *               documentId:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Unique document identifier
 *                 example: "restaurant-tokyo-sushi-hanasaki-001"
 *               documentType:
 *                 type: string
 *                 enum: [activity, location, accommodation, restaurant, itinerary, review, guide, event, transportation]
 *                 description: Type of document
 *               content:
 *                 type: object
 *                 required:
 *                   - title
 *                   - description
 *                 properties:
 *                   title:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 200
 *                     description: Document title
 *                     example: "Sushi Hanasaki - Premium Omakase Experience"
 *                   description:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 2000
 *                     description: Detailed description
 *                     example: "An intimate 8-seat sushi counter offering the finest seasonal ingredients..."
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                       maxLength: 50
 *                     description: Content tags
 *                     example: ["sushi", "omakase", "premium", "intimate"]
 *                   category:
 *                     type: string
 *                     maxLength: 50
 *                     description: Content category
 *                     example: "fine-dining"
 *                   subcategory:
 *                     type: string
 *                     maxLength: 50
 *                     description: Content subcategory
 *                     example: "japanese"
 *               location:
 *                 type: object
 *                 required:
 *                   - name
 *                   - country
 *                   - city
 *                   - longitude
 *                   - latitude
 *                 properties:
 *                   name:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 100
 *                     description: Location name
 *                     example: "Ginza District, Tokyo"
 *                   country:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 50
 *                     description: Country name
 *                     example: "Japan"
 *                   city:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 50
 *                     description: City name
 *                     example: "Tokyo"
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                     description: Longitude coordinate
 *                     example: 139.7671
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                     description: Latitude coordinate
 *                     example: 35.6719
 *                   region:
 *                     type: string
 *                     maxLength: 50
 *                     description: Region or state
 *               attributes:
 *                 type: object
 *                 properties:
 *                   price:
 *                     type: string
 *                     enum: [budget, mid-range, luxury, free]
 *                     description: Price range
 *                   duration:
 *                     type: integer
 *                     minimum: 0
 *                     maximum: 10080
 *                     description: Duration in minutes
 *                   rating:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 5
 *                     description: Average rating
 *                   reviewCount:
 *                     type: integer
 *                     minimum: 0
 *                     description: Number of reviews
 *                   openingHours:
 *                     type: string
 *                     maxLength: 200
 *                     description: Opening hours information
 *                   seasons:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [spring, summer, autumn, winter, year-round]
 *                     description: Best seasons to visit
 *                   accessibility:
 *                     type: object
 *                     properties:
 *                       wheelchairAccessible:
 *                         type: boolean
 *                       familyFriendly:
 *                         type: boolean
 *                       petFriendly:
 *                         type: boolean
 *               source:
 *                 type: object
 *                 required:
 *                   - name
 *                 properties:
 *                   name:
 *                     type: string
 *                     minLength: 1
 *                     maxLength: 100
 *                     description: Source name
 *                     example: "TravelGuide API"
 *                   url:
 *                     type: string
 *                     maxLength: 500
 *                     description: Source URL
 *                   lastUpdated:
 *                     type: string
 *                     format: date-time
 *                     description: Last update timestamp
 *                   verified:
 *                     type: boolean
 *                     description: Whether the source is verified
 *     responses:
 *       201:
 *         description: Document indexed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document indexed successfully"
 *                 documentId:
 *                   type: string
 *                 success:
 *                   type: boolean
 *                 embeddingGenerated:
 *                   type: boolean
 *       400:
 *         description: Bad request - Validation errors or document already exists
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */

// POST /content - Index Single Document
router.post('/', authenticateToken, indexDocumentValidation, contentController.indexDocument);

/**
 * @swagger
 * /api/v1/search/content/batch:
 *   post:
 *     summary: Batch index multiple documents
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1000
 *                 items:
 *                   type: object
 *                   description: Document data (same schema as single document)
 *                 description: Array of documents to index
 *     responses:
 *       200:
 *         description: Batch indexing completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Batch indexing completed"
 *                 total:
 *                   type: integer
 *                   description: Total documents processed
 *                 successful:
 *                   type: integer
 *                   description: Successfully indexed documents
 *                 failed:
 *                   type: integer
 *                   description: Failed documents
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentId:
 *                         type: string
 *                       error:
 *                         type: string
 *                   description: Error details for failed documents
 *                 processingTime:
 *                   type: integer
 *                   description: Total processing time in milliseconds
 *       400:
 *         description: Bad request - Validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */

// POST /content/batch - Batch Index Documents
router.post('/batch', authenticateToken, batchIndexDocumentsValidation, contentController.batchIndexDocuments);

/**
 * @swagger
 * /api/v1/search/content/{documentId}:
 *   get:
 *     summary: Get document by ID
 *     tags: [Content]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *       - in: query
 *         name: includeEmbedding
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include the embedding vector in response
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document retrieved successfully"
 *                 document:
 *                   type: object
 *                   description: Document data
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update an existing document
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: object
 *                 description: Updated content fields
 *               location:
 *                 type: object
 *                 description: Updated location fields
 *               attributes:
 *                 type: object
 *                 description: Updated attributes
 *               source:
 *                 type: object
 *                 description: Updated source information
 *             description: At least one field must be provided
 *     responses:
 *       200:
 *         description: Document updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document updated successfully"
 *                 documentId:
 *                   type: string
 *                 success:
 *                   type: boolean
 *                 reembedded:
 *                   type: boolean
 *                   description: Whether the document was re-embedded due to content changes
 *       400:
 *         description: Bad request - Validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete a document from the index
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID to delete
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Document deleted successfully"
 *                 documentId:
 *                   type: string
 *                 success:
 *                   type: boolean
 *                 deleted:
 *                   type: boolean
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */

// GET /content/:documentId - Get Document
router.get('/:documentId', documentIdValidation, contentController.getDocument);

// PUT /content/:documentId - Update Document
router.put('/:documentId', authenticateToken, updateDocumentValidation, contentController.updateDocument);

// DELETE /content/:documentId - Delete Document
router.delete('/:documentId', authenticateToken, documentIdValidation, contentController.deleteDocument);

/**
 * @swagger
 * /api/v1/search/content:
 *   get:
 *     summary: Get documents with filtering and pagination
 *     tags: [Content]
 *     parameters:
 *       - in: query
 *         name: documentType
 *         schema:
 *           type: string
 *           enum: [activity, location, accommodation, restaurant, itinerary, review, guide, event, transportation]
 *         description: Filter by document type
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Filter by verified content only
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of documents to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of documents to skip
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [popularityScore, qualityScore, rating, createdAt, searchCount]
 *           default: popularityScore
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Documents retrieved successfully"
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       400:
 *         description: Bad request - Invalid parameters
 *       500:
 *         description: Server error
 */

// GET /content - Get Documents
router.get('/', getDocumentsQueryValidation, contentController.getDocuments);

/**
 * @swagger
 * /api/v1/search/content/stats:
 *   get:
 *     summary: Get indexing statistics
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Indexing statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Indexing statistics retrieved successfully"
 *                 overview:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                     avgRating:
 *                       type: number
 *                     avgPopularityScore:
 *                       type: number
 *                     avgQualityScore:
 *                       type: number
 *                 byType:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       avgRating:
 *                         type: number
 *                       verifiedCount:
 *                         type: integer
 *                 topLocations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */

// GET /content/stats - Get Indexing Statistics
router.get('/stats', authenticateToken, contentController.getIndexingStats);

/**
 * @swagger
 * /api/v1/search/content/reindex:
 *   post:
 *     summary: Reindex documents (regenerate embeddings)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [activity, location, accommodation, restaurant, itinerary, review, guide, event, transportation]
 *                 description: Only reindex documents of this type
 *               batchSize:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 1000
 *                 default: 100
 *                 description: Number of documents to process per batch
 *               forceUpdate:
 *                 type: boolean
 *                 default: false
 *                 description: Force update all documents regardless of age
 *     responses:
 *       200:
 *         description: Reindexing completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Reindexing completed successfully"
 *                 totalDocuments:
 *                   type: integer
 *                 successful:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                   description: Error details (limited to first 100)
 *       400:
 *         description: Bad request - Validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */

// POST /content/reindex - Reindex Documents
router.post('/reindex', authenticateToken, reindexDocumentsValidation, contentController.reindexDocuments);

/**
 * @swagger
 * /api/v1/search/content/health:
 *   get:
 *     summary: Get content management service health status
 *     tags: [Content]
 *     responses:
 *       200:
 *         description: Content service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Content service health checked"
 *                 status:
 *                   type: string
 *                   enum: [healthy, warning, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 issues:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of issues if any
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                     avgQualityScore:
 *                       type: integer
 *                     avgRating:
 *                       type: number
 *                     verifiedRatio:
 *                       type: integer
 *                       description: Percentage of verified content
 *                     typeDistribution:
 *                       type: integer
 *                       description: Number of different document types
 *                 indexing:
 *                   type: object
 *                   properties:
 *                     capabilities:
 *                       type: array
 *                       items:
 *                         type: string
 *                     embeddingModel:
 *                       type: string
 *                     embeddingDimensions:
 *                       type: integer
 *       500:
 *         description: Content service is unhealthy
 */

// GET /content/health - Content Management Health Check
router.get('/health', contentController.getContentHealth);

module.exports = router;