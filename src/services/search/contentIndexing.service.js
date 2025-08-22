const { EmbeddingDocument } = require('../../models/search');
const { geminiService } = require('../ai');

class ContentIndexingService {
  constructor() {
    this.batchSize = 100;
    this.embeddingDimensions = 768;
  }

  /**
   * Index a single document for vector search
   * @param {Object} documentData - Document data to index
   * @returns {Promise<Object>} Indexed document
   */
  async indexDocument(documentData) {
    try {
      const {
        documentId,
        documentType,
        content,
        location,
        attributes = {},
        source
      } = documentData;

      // Validate required fields
      this._validateDocumentData(documentData);

      // Check if document already exists
      const existingDoc = await EmbeddingDocument.findOne({ documentId });
      if (existingDoc) {
        throw new Error('DOCUMENT_ALREADY_EXISTS');
      }

      // Generate text for embedding
      const textForEmbedding = this._prepareTextForEmbedding(content);

      // Generate embedding
      const embedding = await this._generateEmbedding(textForEmbedding);

      // Create document
      const embeddingDoc = new EmbeddingDocument({
        documentId,
        documentType,
        content: {
          title: content.title,
          description: content.description,
          tags: content.tags || [],
          category: content.category,
          subcategory: content.subcategory
        },
        location: {
          name: location.name,
          country: location.country,
          city: location.city,
          coordinates: {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
          },
          region: location.region
        },
        embedding,
        attributes: {
          price: attributes.price,
          duration: attributes.duration,
          rating: attributes.rating || 0,
          reviewCount: attributes.reviewCount || 0,
          openingHours: attributes.openingHours,
          seasons: attributes.seasons || [],
          accessibility: {
            wheelchairAccessible: attributes.accessibility?.wheelchairAccessible || false,
            familyFriendly: attributes.accessibility?.familyFriendly || false,
            petFriendly: attributes.accessibility?.petFriendly || false
          }
        },
        source: {
          name: source.name,
          url: source.url,
          lastUpdated: source.lastUpdated || new Date(),
          verified: source.verified || false
        },
        searchMetadata: {
          popularityScore: this._calculatePopularityScore(attributes),
          relevanceScore: this._calculateRelevanceScore(content, attributes),
          qualityScore: this._calculateQualityScore(attributes, source)
        }
      });

      await embeddingDoc.save();

      console.log(`Document indexed: ${documentId}`);

      return {
        documentId: embeddingDoc.documentId,
        success: true,
        embeddingGenerated: true
      };

    } catch (error) {
      console.error(`Failed to index document ${documentData.documentId}:`, error);
      throw error;
    }
  }

  /**
   * Batch index multiple documents
   * @param {Array} documents - Array of document data
   * @returns {Promise<Object>} Batch indexing results
   */
  async batchIndexDocuments(documents) {
    const results = {
      total: documents.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    const startTime = Date.now();

    // Process documents in batches
    for (let i = 0; i < documents.length; i += this.batchSize) {
      const batch = documents.slice(i, i + this.batchSize);
      
      console.log(`Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(documents.length / this.batchSize)}`);

      // Process batch with parallel embedding generation
      const batchPromises = batch.map(async (doc) => {
        try {
          await this.indexDocument(doc);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            documentId: doc.documentId,
            error: error.message
          });
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to avoid overwhelming the embedding service
      if (i + this.batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`Batch indexing completed: ${results.successful}/${results.total} successful in ${processingTime}ms`);

    return {
      ...results,
      processingTime
    };
  }

  /**
   * Update an existing document
   * @param {string} documentId - Document ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated document
   */
  async updateDocument(documentId, updateData) {
    try {
      const existingDoc = await EmbeddingDocument.findOne({ documentId });
      if (!existingDoc) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }

      let needsReembedding = false;

      // Check if content changed (requires re-embedding)
      if (updateData.content) {
        if (updateData.content.title !== existingDoc.content.title ||
            updateData.content.description !== existingDoc.content.description ||
            JSON.stringify(updateData.content.tags || []) !== JSON.stringify(existingDoc.content.tags || [])) {
          needsReembedding = true;
        }
      }

      // Update fields
      if (updateData.content) {
        Object.assign(existingDoc.content, updateData.content);
      }

      if (updateData.location) {
        Object.assign(existingDoc.location, updateData.location);
        if (updateData.location.longitude && updateData.location.latitude) {
          existingDoc.location.coordinates = {
            type: 'Point',
            coordinates: [updateData.location.longitude, updateData.location.latitude]
          };
        }
      }

      if (updateData.attributes) {
        Object.assign(existingDoc.attributes, updateData.attributes);
      }

      if (updateData.source) {
        Object.assign(existingDoc.source, updateData.source);
        existingDoc.source.lastUpdated = new Date();
      }

      // Regenerate embedding if content changed
      if (needsReembedding) {
        const textForEmbedding = this._prepareTextForEmbedding(existingDoc.content);
        existingDoc.embedding = await this._generateEmbedding(textForEmbedding);
      }

      // Recalculate scores
      existingDoc.searchMetadata.popularityScore = this._calculatePopularityScore(existingDoc.attributes);
      existingDoc.searchMetadata.relevanceScore = this._calculateRelevanceScore(existingDoc.content, existingDoc.attributes);
      existingDoc.searchMetadata.qualityScore = this._calculateQualityScore(existingDoc.attributes, existingDoc.source);

      await existingDoc.save();

      console.log(`Document updated: ${documentId}, re-embedded: ${needsReembedding}`);

      return {
        documentId,
        success: true,
        reembedded: needsReembedding
      };

    } catch (error) {
      console.error(`Failed to update document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document from the index
   * @param {string} documentId - Document ID to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteDocument(documentId) {
    try {
      const result = await EmbeddingDocument.deleteOne({ documentId });
      
      if (result.deletedCount === 0) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }

      console.log(`Document deleted: ${documentId}`);

      return {
        documentId,
        success: true,
        deleted: true
      };

    } catch (error) {
      console.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Get indexing statistics
   * @returns {Promise<Object>} Indexing statistics
   */
  async getIndexingStats() {
    try {
      const stats = await EmbeddingDocument.aggregate([
        {
          $group: {
            _id: null,
            totalDocuments: { $sum: 1 },
            byType: {
              $push: {
                type: '$documentType',
                verified: '$source.verified'
              }
            },
            avgRating: { $avg: '$attributes.rating' },
            avgPopularityScore: { $avg: '$searchMetadata.popularityScore' },
            avgQualityScore: { $avg: '$searchMetadata.qualityScore' }
          }
        }
      ]);

      const typeBreakdown = await EmbeddingDocument.aggregate([
        {
          $group: {
            _id: '$documentType',
            count: { $sum: 1 },
            avgRating: { $avg: '$attributes.rating' },
            verifiedCount: {
              $sum: { $cond: ['$source.verified', 1, 0] }
            }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const locationBreakdown = await EmbeddingDocument.aggregate([
        {
          $group: {
            _id: {
              country: '$location.country',
              city: '$location.city'
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 20
        }
      ]);

      return {
        overview: stats[0] || {
          totalDocuments: 0,
          avgRating: 0,
          avgPopularityScore: 0,
          avgQualityScore: 0
        },
        byType: typeBreakdown,
        topLocations: locationBreakdown,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Failed to get indexing stats:', error);
      throw error;
    }
  }

  /**
   * Reindex all documents (regenerate embeddings)
   * @param {Object} options - Reindexing options
   * @returns {Promise<Object>} Reindexing results
   */
  async reindexAll(options = {}) {
    const {
      documentType = null,
      batchSize = this.batchSize,
      forceUpdate = false
    } = options;

    try {
      const query = {};
      if (documentType) {
        query.documentType = documentType;
      }

      if (!forceUpdate) {
        // Only reindex documents older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        query['source.lastUpdated'] = { $lt: thirtyDaysAgo };
      }

      const totalDocuments = await EmbeddingDocument.countDocuments(query);
      console.log(`Starting reindexing of ${totalDocuments} documents`);

      let processed = 0;
      let successful = 0;
      let failed = 0;
      const errors = [];

      const cursor = EmbeddingDocument.find(query).cursor();

      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        try {
          // Regenerate embedding
          const textForEmbedding = this._prepareTextForEmbedding(doc.content);
          doc.embedding = await this._generateEmbedding(textForEmbedding);

          // Recalculate scores
          doc.searchMetadata.popularityScore = this._calculatePopularityScore(doc.attributes);
          doc.searchMetadata.relevanceScore = this._calculateRelevanceScore(doc.content, doc.attributes);
          doc.searchMetadata.qualityScore = this._calculateQualityScore(doc.attributes, doc.source);

          doc.source.lastUpdated = new Date();
          await doc.save();

          successful++;
        } catch (error) {
          failed++;
          errors.push({
            documentId: doc.documentId,
            error: error.message
          });
        }

        processed++;

        if (processed % 100 === 0) {
          console.log(`Reindexing progress: ${processed}/${totalDocuments} (${Math.round(processed/totalDocuments*100)}%)`);
        }

        // Small delay to avoid overwhelming the system
        if (processed % batchSize === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`Reindexing completed: ${successful}/${totalDocuments} successful`);

      return {
        totalDocuments,
        successful,
        failed,
        errors: errors.slice(0, 100) // Limit error list
      };

    } catch (error) {
      console.error('Failed to reindex documents:', error);
      throw error;
    }
  }

  /**
   * Validate document data before indexing
   * @private
   */
  _validateDocumentData(data) {
    const required = ['documentId', 'documentType', 'content', 'location', 'source'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`MISSING_REQUIRED_FIELD: ${field}`);
      }
    }

    if (!data.content.title || !data.content.description) {
      throw new Error('MISSING_CONTENT_FIELDS');
    }

    if (!data.location.name || !data.location.country || !data.location.city) {
      throw new Error('MISSING_LOCATION_FIELDS');
    }

    if (!data.location.longitude || !data.location.latitude) {
      throw new Error('MISSING_COORDINATES');
    }

    if (!data.source.name) {
      throw new Error('MISSING_SOURCE_NAME');
    }
  }

  /**
   * Prepare text for embedding generation
   * @private
   */
  _prepareTextForEmbedding(content) {
    let text = `${content.title}. ${content.description}`;
    
    if (content.tags && content.tags.length > 0) {
      text += `. Tags: ${content.tags.join(', ')}`;
    }

    if (content.category) {
      text += `. Category: ${content.category}`;
    }

    if (content.subcategory) {
      text += `. ${content.subcategory}`;
    }

    return text.trim();
  }

  /**
   * Generate embedding for text
   * @private
   */
  async _generateEmbedding(text) {
    try {
      // In a real implementation, this would call the Gemini embeddings API
      // For now, return a mock embedding with consistent dimensions
      const mockEmbedding = new Array(this.embeddingDimensions).fill(0).map(() => 
        Math.random() * 2 - 1 // Random values between -1 and 1
      );
      
      return mockEmbedding;
    } catch (error) {
      throw new Error('EMBEDDING_GENERATION_FAILED');
    }
  }

  /**
   * Calculate popularity score based on attributes
   * @private
   */
  _calculatePopularityScore(attributes) {
    let score = 0;

    // Rating contribution (0-40 points)
    if (attributes.rating) {
      score += (attributes.rating / 5) * 40;
    }

    // Review count contribution (0-30 points)
    if (attributes.reviewCount) {
      score += Math.min(30, Math.log10(attributes.reviewCount + 1) * 10);
    }

    // Base score for having information (30 points)
    score += 30;

    return Math.round(Math.min(100, score));
  }

  /**
   * Calculate relevance score based on content richness
   * @private
   */
  _calculateRelevanceScore(content, attributes) {
    let score = 0;

    // Content richness (0-50 points)
    score += Math.min(30, content.description.length / 20); // Reward detailed descriptions
    score += content.tags ? Math.min(10, content.tags.length * 2) : 0; // Reward good tagging
    score += content.category ? 10 : 0; // Reward categorization

    // Attribute completeness (0-50 points)
    let attributeCount = 0;
    if (attributes.price) attributeCount++;
    if (attributes.duration) attributeCount++;
    if (attributes.openingHours) attributeCount++;
    if (attributes.seasons && attributes.seasons.length > 0) attributeCount++;
    
    score += attributeCount * 12.5; // Up to 50 points for complete attributes

    return Math.round(Math.min(100, score));
  }

  /**
   * Calculate quality score based on source and verification
   * @private
   */
  _calculateQualityScore(attributes, source) {
    let score = 50; // Base score

    // Source verification (0-30 points)
    if (source.verified) {
      score += 30;
    }

    // Source recency (0-20 points)
    if (source.lastUpdated) {
      const daysSinceUpdate = (Date.now() - new Date(source.lastUpdated)) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 30) {
        score += 20;
      } else if (daysSinceUpdate < 90) {
        score += 10;
      }
    }

    return Math.round(Math.min(100, score));
  }
}

module.exports = new ContentIndexingService();