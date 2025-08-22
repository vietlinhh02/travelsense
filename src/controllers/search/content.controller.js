const { validationResult } = require('express-validator');
const { contentIndexingService } = require('../../services/search');
const { responseService } = require('../../services/common');

// Index Single Document
const indexDocument = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const documentData = req.body;

    // Index the document
    const result = await contentIndexingService.indexDocument(documentData);

    console.log(`Document indexed: ${result.documentId}`);
    
    responseService.sendSuccess(res, result, 'Document indexed successfully', 201);
  } catch (error) {
    console.error('Index document error:', error);
    responseService.handleServiceError(res, error, 'Failed to index document');
  }
};

// Batch Index Documents
const batchIndexDocuments = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { documents } = req.body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return responseService.sendError(res, 'Documents array is required and cannot be empty', 400);
    }

    if (documents.length > 1000) {
      return responseService.sendError(res, 'Maximum 1000 documents allowed per batch', 400);
    }

    // Batch index documents
    const result = await contentIndexingService.batchIndexDocuments(documents);

    console.log(`Batch indexing completed: ${result.successful}/${result.total} successful`);
    
    responseService.sendSuccess(res, result, 'Batch indexing completed');
  } catch (error) {
    console.error('Batch index documents error:', error);
    responseService.handleServiceError(res, error, 'Failed to batch index documents');
  }
};

// Update Document
const updateDocument = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { documentId } = req.params;
    const updateData = req.body;

    // Update the document
    const result = await contentIndexingService.updateDocument(documentId, updateData);

    console.log(`Document updated: ${result.documentId}, re-embedded: ${result.reembedded}`);
    
    responseService.sendSuccess(res, result, 'Document updated successfully');
  } catch (error) {
    console.error('Update document error:', error);
    responseService.handleServiceError(res, error, 'Failed to update document');
  }
};

// Delete Document
const deleteDocument = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { documentId } = req.params;

    // Delete the document
    const result = await contentIndexingService.deleteDocument(documentId);

    console.log(`Document deleted: ${result.documentId}`);
    
    responseService.sendSuccess(res, result, 'Document deleted successfully');
  } catch (error) {
    console.error('Delete document error:', error);
    responseService.handleServiceError(res, error, 'Failed to delete document');
  }
};

// Get Document by ID
const getDocument = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const { documentId } = req.params;
    const { includeEmbedding = false } = req.query;

    // Find the document
    const { EmbeddingDocument } = require('../../models/search');
    const projection = includeEmbedding === 'true' ? {} : { embedding: 0 };
    
    const document = await EmbeddingDocument.findOne({ documentId }, projection);

    if (!document) {
      return responseService.sendError(res, 'Document not found', 404);
    }

    // Record search if user is authenticated
    if (req.user?.userId) {
      await document.recordSearch();
    }

    console.log(`Document retrieved: ${documentId}`);
    
    responseService.sendSuccess(res, { document }, 'Document retrieved successfully');
  } catch (error) {
    console.error('Get document error:', error);
    responseService.handleServiceError(res, error, 'Failed to retrieve document');
  }
};

// Get Documents by Type and Location
const getDocuments = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const {
      documentType,
      country,
      city,
      category,
      minRating,
      verified,
      limit = 20,
      offset = 0,
      sortBy = 'popularityScore',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const { EmbeddingDocument } = require('../../models/search');
    const query = {};
    
    if (documentType) {
      query.documentType = documentType;
    }
    
    if (country) {
      query['location.country'] = new RegExp(country, 'i');
    }
    
    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }
    
    if (category) {
      query['content.category'] = new RegExp(category, 'i');
    }
    
    if (minRating) {
      query['attributes.rating'] = { $gte: parseFloat(minRating) };
    }
    
    if (verified === 'true') {
      query['source.verified'] = true;
    }

    // Build sort
    const sort = {};
    const validSortFields = ['popularityScore', 'qualityScore', 'rating', 'createdAt', 'searchCount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'popularityScore';
    
    if (sortField === 'popularityScore' || sortField === 'qualityScore') {
      sort[`searchMetadata.${sortField}`] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortField === 'rating') {
      sort['attributes.rating'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortField === 'searchCount') {
      sort['searchMetadata.searchCount'] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortField] = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute query
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offsetNum = Math.max(0, parseInt(offset) || 0);

    const [documents, totalCount] = await Promise.all([
      EmbeddingDocument
        .find(query, { embedding: 0 }) // Exclude embedding
        .sort(sort)
        .skip(offsetNum)
        .limit(limitNum),
      EmbeddingDocument.countDocuments(query)
    ]);

    console.log(`Documents retrieved: ${documents.length}/${totalCount} total`);
    
    responseService.sendSuccess(res, {
      documents,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: totalCount > offsetNum + limitNum
      }
    }, 'Documents retrieved successfully');
  } catch (error) {
    console.error('Get documents error:', error);
    responseService.handleServiceError(res, error, 'Failed to retrieve documents');
  }
};

// Get Indexing Statistics
const getIndexingStats = async (req, res) => {
  try {
    // Get indexing statistics
    const stats = await contentIndexingService.getIndexingStats();

    console.log('Indexing statistics retrieved');
    
    responseService.sendSuccess(res, stats, 'Indexing statistics retrieved successfully');
  } catch (error) {
    console.error('Get indexing stats error:', error);
    responseService.handleServiceError(res, error, 'Failed to get indexing statistics');
  }
};

// Reindex Documents
const reindexDocuments = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    const {
      documentType,
      batchSize = 100,
      forceUpdate = false
    } = req.body;

    const options = {
      documentType,
      batchSize: Math.min(1000, Math.max(10, parseInt(batchSize) || 100)),
      forceUpdate: forceUpdate === true
    };

    // Start reindexing (this is a long-running operation)
    const result = await contentIndexingService.reindexAll(options);

    console.log(`Reindexing completed: ${result.successful}/${result.totalDocuments} successful`);
    
    responseService.sendSuccess(res, result, 'Reindexing completed successfully');
  } catch (error) {
    console.error('Reindex documents error:', error);
    responseService.handleServiceError(res, error, 'Failed to reindex documents');
  }
};

// Content Management Health Check
const getContentHealth = async (req, res) => {
  try {
    // Get indexing statistics
    const stats = await contentIndexingService.getIndexingStats();

    // Calculate health metrics
    const totalDocuments = stats.overview.totalDocuments || 0;
    const avgQualityScore = stats.overview.avgQualityScore || 0;
    const avgRating = stats.overview.avgRating || 0;

    // Determine health status
    let status = 'healthy';
    const issues = [];

    if (totalDocuments < 100) {
      status = 'warning';
      issues.push('Low document count');
    }

    if (avgQualityScore < 60) {
      status = 'warning';
      issues.push('Low average quality score');
    }

    if (avgRating < 3.0) {
      status = 'warning';
      issues.push('Low average rating');
    }

    // Check for verified content ratio
    const verifiedRatio = stats.byType.reduce((sum, type) => {
      return sum + (type.verifiedCount / type.count);
    }, 0) / (stats.byType.length || 1);

    if (verifiedRatio < 0.3) {
      status = 'warning';
      issues.push('Low verified content ratio');
    }

    const healthStatus = {
      status,
      timestamp: new Date().toISOString(),
      issues,
      metrics: {
        totalDocuments,
        avgQualityScore: Math.round(avgQualityScore),
        avgRating: Math.round(avgRating * 10) / 10,
        verifiedRatio: Math.round(verifiedRatio * 100),
        typeDistribution: stats.byType.length
      },
      indexing: {
        capabilities: ['single', 'batch', 'update', 'delete', 'reindex'],
        embeddingModel: 'text-embedding-004',
        embeddingDimensions: 768
      }
    };

    console.log(`Content health status: ${status}`);
    
    responseService.sendSuccess(res, healthStatus, 'Content service health checked');
  } catch (error) {
    console.error('Get content health error:', error);
    responseService.handleServiceError(res, error, 'Content health check failed');
  }
};

module.exports = {
  indexDocument,
  batchIndexDocuments,
  updateDocument,
  deleteDocument,
  getDocument,
  getDocuments,
  getIndexingStats,
  reindexDocuments,
  getContentHealth
};