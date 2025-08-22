const { EmbeddingDocument, SearchQueryLog, SearchPreferences } = require('../../models/search');
const { geminiService } = require('../ai');

class VectorSearchService {
  constructor() {
    // MongoDB Atlas Vector Search configuration
    this.vectorSearchIndex = 'vector_index'; // Atlas Vector Search index name
    this.embeddingDimensions = 768; // text-embedding-004 dimensions
    this.maxResults = 100;
    this.defaultSimilarityThreshold = 0.7;
  }

  /**
   * Perform vector similarity search using MongoDB Atlas Vector Search
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results with metadata
   */
  async vectorSearch(searchParams) {
    const startTime = Date.now();
    
    try {
      const {
        query,
        queryVector,
        userId,
        sessionId,
        filters = {},
        limit = 20,
        offset = 0,
        similarityThreshold = this.defaultSimilarityThreshold
      } = searchParams;

      // Generate embedding for the query if not provided
      let embedding = queryVector;
      if (!embedding && query) {
        embedding = await this._generateEmbedding(query);
      }

      if (!embedding) {
        throw new Error('INVALID_SEARCH_QUERY');
      }

      // Build MongoDB Atlas Vector Search aggregation pipeline
      const pipeline = this._buildVectorSearchPipeline({
        embedding,
        filters,
        limit: limit + offset, // Get extra results for offset
        similarityThreshold
      });

      // Execute vector search
      const results = await EmbeddingDocument.aggregate(pipeline);
      
      // Apply offset and limit
      const paginatedResults = results.slice(offset, offset + limit);
      
      const processingTime = Date.now() - startTime;

      // Log the search query
      await this._logSearchQuery({
        userId,
        sessionId,
        query,
        searchType: 'vector',
        filters,
        results: {
          totalFound: results.length,
          totalReturned: paginatedResults.length,
          processingTime,
          searchMethod: 'atlas_vector',
          hasMoreResults: results.length > offset + limit
        },
        technical: {
          embeddingModel: 'text-embedding-004',
          queryVector: embedding
        }
      });

      // Update user preferences if applicable
      if (userId) {
        await this._updateUserPreferences(userId, searchParams, paginatedResults);
      }

      return {
        results: paginatedResults,
        metadata: {
          totalFound: results.length,
          totalReturned: paginatedResults.length,
          processingTime,
          hasMoreResults: results.length > offset + limit,
          searchMethod: 'vector',
          similarityThreshold,
          offset,
          limit
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log failed search
      await this._logSearchQuery({
        userId: searchParams.userId,
        sessionId: searchParams.sessionId,
        query: searchParams.query,
        searchType: 'vector',
        results: {
          totalFound: 0,
          totalReturned: 0,
          processingTime,
          searchMethod: 'atlas_vector',
          hasMoreResults: false
        },
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Perform hybrid search combining vector and text search
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Combined search results
   */
  async hybridSearch(searchParams) {
    const startTime = Date.now();
    
    try {
      const {
        query,
        userId,
        sessionId,
        filters = {},
        limit = 20,
        offset = 0,
        vectorWeight = 0.7,
        textWeight = 0.3
      } = searchParams;

      // Perform both vector and text searches in parallel
      const [vectorResults, textResults] = await Promise.all([
        this.vectorSearch({
          ...searchParams,
          limit: Math.ceil(limit * 1.5), // Get more results for merging
          offset: 0
        }),
        this.textSearch({
          ...searchParams,
          limit: Math.ceil(limit * 1.5),
          offset: 0
        })
      ]);

      // Merge and rank results
      const mergedResults = this._mergeSearchResults(
        vectorResults.results,
        textResults.results,
        vectorWeight,
        textWeight
      );

      // Apply pagination
      const paginatedResults = mergedResults.slice(offset, offset + limit);
      
      const processingTime = Date.now() - startTime;

      // Log hybrid search
      await this._logSearchQuery({
        userId,
        sessionId,
        query,
        searchType: 'hybrid',
        filters,
        results: {
          totalFound: mergedResults.length,
          totalReturned: paginatedResults.length,
          processingTime,
          searchMethod: 'hybrid',
          hasMoreResults: mergedResults.length > offset + limit
        }
      });

      return {
        results: paginatedResults,
        metadata: {
          totalFound: mergedResults.length,
          totalReturned: paginatedResults.length,
          processingTime,
          hasMoreResults: mergedResults.length > offset + limit,
          searchMethod: 'hybrid',
          vectorWeight,
          textWeight,
          offset,
          limit
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform text-based search using MongoDB text indexes
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Text search results
   */
  async textSearch(searchParams) {
    const startTime = Date.now();
    
    try {
      const {
        query,
        userId,
        sessionId,
        filters = {},
        limit = 20,
        offset = 0
      } = searchParams;

      if (!query || query.trim().length === 0) {
        throw new Error('SEARCH_QUERY_REQUIRED');
      }

      // Build text search query
      const searchQuery = {
        $text: { $search: query }
      };

      // Apply filters
      this._applyFilters(searchQuery, filters);

      // Execute text search with scoring
      const results = await EmbeddingDocument
        .find(searchQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, 'attributes.rating': -1 })
        .skip(offset)
        .limit(limit);

      // Get total count for pagination
      const totalCount = await EmbeddingDocument.countDocuments(searchQuery);
      
      const processingTime = Date.now() - startTime;

      // Log text search
      await this._logSearchQuery({
        userId,
        sessionId,
        query,
        searchType: 'text',
        filters,
        results: {
          totalFound: totalCount,
          totalReturned: results.length,
          processingTime,
          searchMethod: 'mongodb_text',
          hasMoreResults: totalCount > offset + limit
        }
      });

      return {
        results: results.map(doc => ({
          ...doc.toObject(),
          similarityScore: doc.score || 0
        })),
        metadata: {
          totalFound: totalCount,
          totalReturned: results.length,
          processingTime,
          hasMoreResults: totalCount > offset + limit,
          searchMethod: 'text',
          offset,
          limit
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform location-based search with optional text query
   * @param {Object} searchParams - Search parameters including location
   * @returns {Promise<Object>} Location-based search results
   */
  async locationSearch(searchParams) {
    const startTime = Date.now();
    
    try {
      const {
        longitude,
        latitude,
        radius = 25000, // 25km default
        query,
        userId,
        sessionId,
        filters = {},
        limit = 20,
        offset = 0
      } = searchParams;

      if (!longitude || !latitude) {
        throw new Error('LOCATION_COORDINATES_REQUIRED');
      }

      // Build location query
      const searchQuery = {
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: radius
          }
        }
      };

      // Add text search if query provided
      if (query && query.trim().length > 0) {
        searchQuery.$text = { $search: query };
      }

      // Apply additional filters
      this._applyFilters(searchQuery, filters);

      // Execute location search
      const results = await EmbeddingDocument
        .find(searchQuery)
        .skip(offset)
        .limit(limit);

      // Calculate distances and add to results
      const resultsWithDistance = results.map(doc => {
        const distance = doc.distanceFrom(longitude, latitude);
        return {
          ...doc.toObject(),
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        };
      });

      const totalCount = await EmbeddingDocument.countDocuments(searchQuery);
      const processingTime = Date.now() - startTime;

      // Log location search
      await this._logSearchQuery({
        userId,
        sessionId,
        query: query || `Location search near ${latitude}, ${longitude}`,
        searchType: 'location',
        filters: {
          ...filters,
          location: {
            coordinates: { longitude, latitude },
            radius
          }
        },
        results: {
          totalFound: totalCount,
          totalReturned: results.length,
          processingTime,
          searchMethod: 'mongodb_geo',
          hasMoreResults: totalCount > offset + limit
        }
      });

      return {
        results: resultsWithDistance,
        metadata: {
          totalFound: totalCount,
          totalReturned: results.length,
          processingTime,
          hasMoreResults: totalCount > offset + limit,
          searchMethod: 'location',
          searchCenter: { longitude, latitude },
          searchRadius: radius,
          offset,
          limit
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get personalized recommendations based on user preferences
   * @param {string} userId - User ID
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Personalized recommendations
   */
  async getPersonalizedRecommendations(userId, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        limit = 20,
        location,
        documentTypes,
        diversityFactor = 0.3 // 0 = no diversity, 1 = maximum diversity
      } = options;

      // Get user preferences
      const preferences = await SearchPreferences.getOrCreatePreferences(userId);
      const recommendations = await SearchPreferences.getRecommendations(userId);

      if (!recommendations.personalized) {
        // Fall back to popular content
        return await this._getPopularContent(options);
      }

      // Build personalized query based on preferences
      const query = {};
      
      // Prefer user's favorite document types
      if (recommendations.contentTypes && recommendations.contentTypes.length > 0) {
        const preferredTypes = recommendations.contentTypes.map(t => t.documentType);
        query.documentType = { $in: documentTypes || preferredTypes };
      }

      // Prefer user's favorite categories
      if (recommendations.categories && recommendations.categories.length > 0) {
        const preferredCategories = recommendations.categories.map(c => c.category);
        query['content.category'] = { $in: preferredCategories };
      }

      // Location-based preferences
      if (location) {
        query['location.coordinates'] = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [location.longitude, location.latitude]
            },
            $maxDistance: location.radius || 25000
          }
        };
      } else if (recommendations.destinations && recommendations.destinations.length > 0) {
        // Use frequently searched destinations
        const cities = recommendations.destinations.map(d => d.city);
        query['location.city'] = { $in: cities };
      }

      // Quality preferences
      if (recommendations.priceRange && recommendations.priceRange !== 'mixed') {
        query['attributes.price'] = recommendations.priceRange;
      }

      // Execute personalized search
      let results = await EmbeddingDocument
        .find(query)
        .sort({ 
          'attributes.rating': -1, 
          'searchMetadata.popularityScore': -1 
        })
        .limit(limit * 2); // Get more for diversity

      // Apply diversity if requested
      if (diversityFactor > 0 && results.length > limit) {
        results = this._applyDiversityFilter(results, limit, diversityFactor);
      } else {
        results = results.slice(0, limit);
      }

      const processingTime = Date.now() - startTime;

      return {
        results: results.map(doc => doc.toObject()),
        metadata: {
          totalReturned: results.length,
          processingTime,
          personalized: true,
          diversityFactor,
          basedOnPreferences: {
            contentTypes: recommendations.contentTypes?.length || 0,
            categories: recommendations.categories?.length || 0,
            destinations: recommendations.destinations?.length || 0
          }
        }
      };

    } catch (error) {
      // Fall back to popular content
      return await this._getPopularContent(options);
    }
  }

  /**
   * Find similar documents to a given document
   * @param {string} documentId - Reference document ID
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Similar documents
   */
  async findSimilarDocuments(documentId, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        limit = 10,
        similarityThreshold = 0.6,
        sameType = true,
        sameLocation = false
      } = options;

      // Get the reference document
      const referenceDoc = await EmbeddingDocument.findOne({ documentId });
      if (!referenceDoc) {
        throw new Error('REFERENCE_DOCUMENT_NOT_FOUND');
      }

      // Build similarity search pipeline
      const pipeline = this._buildVectorSearchPipeline({
        embedding: referenceDoc.embedding,
        filters: {
          documentId: { $ne: documentId }, // Exclude the reference document
          ...(sameType && { documentType: referenceDoc.documentType }),
          ...(sameLocation && { 
            'location.city': referenceDoc.location.city,
            'location.country': referenceDoc.location.country
          })
        },
        limit,
        similarityThreshold
      });

      const results = await EmbeddingDocument.aggregate(pipeline);
      const processingTime = Date.now() - startTime;

      return {
        referenceDocument: {
          documentId: referenceDoc.documentId,
          title: referenceDoc.content.title,
          type: referenceDoc.documentType
        },
        results,
        metadata: {
          totalReturned: results.length,
          processingTime,
          similarityThreshold,
          sameType,
          sameLocation
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Build MongoDB Atlas Vector Search aggregation pipeline
   * @private
   */
  _buildVectorSearchPipeline({ embedding, filters, limit, similarityThreshold }) {
    const pipeline = [
      {
        $vectorSearch: {
          index: this.vectorSearchIndex,
          path: 'embedding',
          queryVector: embedding,
          numCandidates: Math.max(limit * 10, 150), // Search more candidates for better results
          limit: limit,
          ...(similarityThreshold && {
            filter: {
              score: { $gte: similarityThreshold }
            }
          })
        }
      },
      {
        $addFields: {
          similarityScore: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    // Add filters if provided
    if (filters && Object.keys(filters).length > 0) {
      const matchStage = { $match: {} };
      this._applyFilters(matchStage.$match, filters);
      pipeline.push(matchStage);
    }

    // Add sorting and projection
    pipeline.push(
      {
        $sort: {
          similarityScore: -1,
          'attributes.rating': -1,
          'searchMetadata.popularityScore': -1
        }
      },
      {
        $project: {
          embedding: 0 // Exclude embedding from results to save bandwidth
        }
      }
    );

    return pipeline;
  }

  /**
   * Apply filters to search query
   * @private
   */
  _applyFilters(query, filters) {
    if (filters.documentTypes && filters.documentTypes.length > 0) {
      query.documentType = { $in: filters.documentTypes };
    }

    if (filters.location) {
      if (filters.location.country) {
        query['location.country'] = new RegExp(filters.location.country, 'i');
      }
      if (filters.location.city) {
        query['location.city'] = new RegExp(filters.location.city, 'i');
      }
    }

    if (filters.attributes) {
      if (filters.attributes.priceRange && filters.attributes.priceRange.length > 0) {
        query['attributes.price'] = { $in: filters.attributes.priceRange };
      }

      if (filters.attributes.minRating) {
        query['attributes.rating'] = { $gte: filters.attributes.minRating };
      }

      if (filters.attributes.maxDuration) {
        query['attributes.duration'] = { $lte: filters.attributes.maxDuration };
      }

      if (filters.attributes.categories && filters.attributes.categories.length > 0) {
        query['content.category'] = { $in: filters.attributes.categories };
      }

      if (filters.attributes.accessibility) {
        Object.keys(filters.attributes.accessibility).forEach(key => {
          if (filters.attributes.accessibility[key]) {
            query[`attributes.accessibility.${key}`] = true;
          }
        });
      }

      if (filters.attributes.seasons && filters.attributes.seasons.length > 0) {
        query['attributes.seasons'] = { $in: filters.attributes.seasons };
      }
    }

    if (filters.verified) {
      query['source.verified'] = true;
    }
  }

  /**
   * Generate embedding for text using Gemini AI service
   * @private
   */
  async _generateEmbedding(text) {
    try {
      // In a real implementation, this would call the Gemini embeddings API
      // For now, return a mock embedding
      const mockEmbedding = new Array(this.embeddingDimensions).fill(0).map(() => 
        Math.random() * 2 - 1 // Random values between -1 and 1
      );
      
      return mockEmbedding;
    } catch (error) {
      throw new Error('EMBEDDING_GENERATION_FAILED');
    }
  }

  /**
   * Merge vector and text search results
   * @private
   */
  _mergeSearchResults(vectorResults, textResults, vectorWeight, textWeight) {
    const merged = new Map();

    // Add vector results with weighted scores
    vectorResults.forEach(doc => {
      const score = (doc.similarityScore || 0) * vectorWeight;
      merged.set(doc.documentId, {
        ...doc,
        combinedScore: score,
        sources: ['vector']
      });
    });

    // Add or merge text results
    textResults.forEach(doc => {
      const textScore = (doc.similarityScore || doc.score || 0) * textWeight;
      
      if (merged.has(doc.documentId)) {
        const existing = merged.get(doc.documentId);
        existing.combinedScore += textScore;
        existing.sources.push('text');
      } else {
        merged.set(doc.documentId, {
          ...doc,
          combinedScore: textScore,
          sources: ['text']
        });
      }
    });

    // Sort by combined score and return array
    return Array.from(merged.values())
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Apply diversity filter to results
   * @private
   */
  _applyDiversityFilter(results, limit, diversityFactor) {
    if (diversityFactor === 0) return results.slice(0, limit);

    const selected = [];
    const categories = new Set();
    const locations = new Set();

    for (const doc of results) {
      if (selected.length >= limit) break;

      const category = doc.content.category;
      const location = `${doc.location.city}-${doc.location.country}`;
      
      // Calculate diversity score
      const categoryPenalty = categories.has(category) ? diversityFactor : 0;
      const locationPenalty = locations.has(location) ? diversityFactor * 0.5 : 0;
      const diversityPenalty = categoryPenalty + locationPenalty;

      // Only skip if penalties are high and we have other options
      if (diversityPenalty < 0.5 || selected.length < limit * 0.3) {
        selected.push(doc);
        categories.add(category);
        locations.add(location);
      }
    }

    // Fill remaining slots if needed
    for (const doc of results) {
      if (selected.length >= limit) break;
      if (!selected.includes(doc)) {
        selected.push(doc);
      }
    }

    return selected.slice(0, limit);
  }

  /**
   * Get popular content as fallback
   * @private
   */
  async _getPopularContent(options = {}) {
    const { limit = 20, documentTypes } = options;
    
    const query = {};
    if (documentTypes && documentTypes.length > 0) {
      query.documentType = { $in: documentTypes };
    }

    const results = await EmbeddingDocument
      .find(query)
      .sort({ 
        'searchMetadata.popularityScore': -1,
        'attributes.rating': -1,
        'searchMetadata.searchCount': -1
      })
      .limit(limit);

    return {
      results: results.map(doc => doc.toObject()),
      metadata: {
        totalReturned: results.length,
        personalized: false,
        fallback: true
      }
    };
  }

  /**
   * Log search query
   * @private
   */
  async _logSearchQuery(logData) {
    try {
      await SearchQueryLog.logSearch(logData);
    } catch (error) {
      console.error('Failed to log search query:', error);
      // Don't throw error to avoid disrupting search flow
    }
  }

  /**
   * Update user preferences based on search
   * @private
   */
  async _updateUserPreferences(userId, searchParams, results) {
    try {
      const preferences = await SearchPreferences.getOrCreatePreferences(userId);
      
      // Update search behavior
      await preferences.updateSearchBehavior({
        queryLength: searchParams.query?.length || 0,
        usedFilters: Object.keys(searchParams.filters || {}).length > 0,
        wasRefined: false // This would be set by the controller based on session data
      });

      // Update location preferences if location search
      if (searchParams.longitude && searchParams.latitude) {
        // Would need to reverse geocode to get city/country
        // For now, skip location preference updates
      }

    } catch (error) {
      console.error('Failed to update user preferences:', error);
      // Don't throw error to avoid disrupting search flow
    }
  }
}

module.exports = new VectorSearchService();