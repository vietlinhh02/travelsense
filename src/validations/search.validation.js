const { body, param, query } = require('express-validator');

// Vector Search validation
const vectorSearchValidation = [
  body('query')
    .optional()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be a string between 1 and 500 characters'),
  
  body('queryVector')
    .optional()
    .isArray()
    .withMessage('Query vector must be an array')
    .custom((vector) => {
      if (vector && vector.length !== 768) {
        throw new Error('Query vector must have exactly 768 dimensions');
      }
      return true;
    }),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('filters.documentTypes')
    .optional()
    .isArray()
    .withMessage('Document types must be an array')
    .custom((types) => {
      const validTypes = ['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation'];
      if (types && !types.every(type => validTypes.includes(type))) {
        throw new Error('Invalid document type');
      }
      return true;
    }),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  body('similarityThreshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Similarity threshold must be between 0 and 1'),
  
  body()
    .custom((body) => {
      if (!body.query && !body.queryVector) {
        throw new Error('Either query text or queryVector is required');
      }
      return true;
    })
];

// Hybrid Search validation
const hybridSearchValidation = [
  body('query')
    .notEmpty()
    .withMessage('Query is required for hybrid search')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be a string between 1 and 500 characters'),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  body('vectorWeight')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Vector weight must be between 0 and 1'),
  
  body('textWeight')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Text weight must be between 0 and 1')
];

// Text Search validation
const textSearchValidation = [
  body('query')
    .notEmpty()
    .withMessage('Query is required for text search')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be a string between 1 and 500 characters'),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

// Location Search validation
const locationSearchValidation = [
  body('longitude')
    .notEmpty()
    .withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  
  body('latitude')
    .notEmpty()
    .withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  
  body('radius')
    .optional()
    .isInt({ min: 100, max: 100000 })
    .withMessage('Radius must be between 100 and 100000 meters'),
  
  body('query')
    .optional()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be a string between 1 and 500 characters'),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

// Find Similar validation
const findSimilarValidation = [
  param('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Document ID must be between 1 and 100 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  
  query('similarityThreshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Similarity threshold must be between 0 and 1'),
  
  query('sameType')
    .optional()
    .isBoolean()
    .withMessage('sameType must be a boolean'),
  
  query('sameLocation')
    .optional()
    .isBoolean()
    .withMessage('sameLocation must be a boolean')
];

// Record Interaction validation
const recordInteractionValidation = [
  body('queryId')
    .notEmpty()
    .withMessage('Query ID is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Query ID must be between 1 and 100 characters'),
  
  body('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Document ID must be between 1 and 100 characters'),
  
  body('interactionType')
    .notEmpty()
    .withMessage('Interaction type is required')
    .isIn(['view', 'click', 'save', 'share', 'book'])
    .withMessage('Interaction type must be one of: view, click, save, share, book'),
  
  body('position')
    .notEmpty()
    .withMessage('Position is required')
    .isInt({ min: 0 })
    .withMessage('Position must be a non-negative integer'),
  
  body('additionalData')
    .optional()
    .isObject()
    .withMessage('Additional data must be an object'),
  
  body('additionalData.satisfactionScore')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Satisfaction score must be between 1 and 5')
];

// Document ID validation
const documentIdValidation = [
  param('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Document ID must be between 1 and 100 characters')
];

// Index Document validation
const indexDocumentValidation = [
  body('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Document ID must be between 1 and 100 characters'),
  
  body('documentType')
    .notEmpty()
    .withMessage('Document type is required')
    .isIn(['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation'])
    .withMessage('Invalid document type'),
  
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isObject()
    .withMessage('Content must be an object'),
  
  body('content.title')
    .notEmpty()
    .withMessage('Content title is required')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Content title must be between 1 and 200 characters'),
  
  body('content.description')
    .notEmpty()
    .withMessage('Content description is required')
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Content description must be between 1 and 2000 characters'),
  
  body('content.tags')
    .optional()
    .isArray()
    .withMessage('Content tags must be an array'),
  
  body('content.category')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Content category must be at most 50 characters'),
  
  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .isObject()
    .withMessage('Location must be an object'),
  
  body('location.name')
    .notEmpty()
    .withMessage('Location name is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location name must be between 1 and 100 characters'),
  
  body('location.country')
    .notEmpty()
    .withMessage('Location country is required')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Location country must be between 1 and 50 characters'),
  
  body('location.city')
    .notEmpty()
    .withMessage('Location city is required')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Location city must be between 1 and 50 characters'),
  
  body('location.longitude')
    .notEmpty()
    .withMessage('Location longitude is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Location longitude must be between -180 and 180'),
  
  body('location.latitude')
    .notEmpty()
    .withMessage('Location latitude is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Location latitude must be between -90 and 90'),
  
  body('source')
    .notEmpty()
    .withMessage('Source is required')
    .isObject()
    .withMessage('Source must be an object'),
  
  body('source.name')
    .notEmpty()
    .withMessage('Source name is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Source name must be between 1 and 100 characters'),
  
  body('attributes.rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),
  
  body('attributes.duration')
    .optional()
    .isInt({ min: 0, max: 10080 })
    .withMessage('Duration must be between 0 and 10080 minutes')
];

// Batch Index Documents validation
const batchIndexDocumentsValidation = [
  body('documents')
    .notEmpty()
    .withMessage('Documents array is required')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Documents must be an array with 1-1000 items'),
  
  body('documents.*.documentId')
    .notEmpty()
    .withMessage('Each document must have a document ID')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Document ID must be between 1 and 100 characters'),
  
  body('documents.*.documentType')
    .notEmpty()
    .withMessage('Each document must have a document type')
    .isIn(['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation'])
    .withMessage('Invalid document type')
];

// Update Document validation
const updateDocumentValidation = [
  param('documentId')
    .notEmpty()
    .withMessage('Document ID is required')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Document ID must be between 1 and 100 characters'),
  
  body()
    .custom((body) => {
      const allowedFields = ['content', 'location', 'attributes', 'source'];
      const hasValidField = Object.keys(body).some(key => allowedFields.includes(key));
      if (!hasValidField) {
        throw new Error('At least one valid field must be provided for update');
      }
      return true;
    })
];

// Get Documents query validation
const getDocumentsQueryValidation = [
  query('documentType')
    .optional()
    .isIn(['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation'])
    .withMessage('Invalid document type'),
  
  query('country')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Country must be between 1 and 50 characters'),
  
  query('city')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('City must be between 1 and 50 characters'),
  
  query('category')
    .optional()
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  
  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Minimum rating must be between 0 and 5'),
  
  query('verified')
    .optional()
    .isBoolean()
    .withMessage('Verified must be a boolean'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  query('sortBy')
    .optional()
    .isIn(['popularityScore', 'qualityScore', 'rating', 'createdAt', 'searchCount'])
    .withMessage('sortBy must be one of: popularityScore, qualityScore, rating, createdAt, searchCount'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc')
];

// Reindex Documents validation
const reindexDocumentsValidation = [
  body('documentType')
    .optional()
    .isIn(['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation'])
    .withMessage('Invalid document type'),
  
  body('batchSize')
    .optional()
    .isInt({ min: 10, max: 1000 })
    .withMessage('Batch size must be between 10 and 1000'),
  
  body('forceUpdate')
    .optional()
    .isBoolean()
    .withMessage('Force update must be a boolean')
];

// Get Analytics query validation
const getAnalyticsQueryValidation = [
  query('timeframe')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Timeframe must be between 1 and 365 days'),
  
  query('searchType')
    .optional()
    .isIn(['vector', 'text', 'hybrid', 'location'])
    .withMessage('Search type must be one of: vector, text, hybrid, location')
];

// Get Popular Terms query validation
const getPopularTermsQueryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('timeframe')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Timeframe must be between 1 and 365 days')
];

module.exports = {
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
};