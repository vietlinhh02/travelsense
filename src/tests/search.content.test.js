const request = require('supertest');
const createTestApp = require('./setup/testApp');
const { clearMockDB } = require('./setup/mockDb');

// Create test app instance
const app = createTestApp();

// Mock dependencies
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock EmbeddingDocument model
const mockEmbeddingDocument = {
  findOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  deleteOne: jest.fn(),
  aggregate: jest.fn(),
  save: jest.fn()
};

// Mock contentIndexingService
const mockContentIndexingService = {
  indexDocument: jest.fn(),
  batchIndexDocuments: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getIndexingStats: jest.fn(),
  reindexAll: jest.fn()
};

jest.mock('../models/search', () => ({
  EmbeddingDocument: mockEmbeddingDocument
}));

jest.mock('../services/search', () => ({
  contentIndexingService: mockContentIndexingService
}));

describe('Search Content Management Test Suite', () => {
  const API_BASE = '/api/v1/search/content';

  beforeEach(async () => {
    await clearMockDB();
    jest.clearAllMocks();
    
    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/search/content/index - Index Single Document', () => {
    const validDocumentData = {
      documentId: 'test-doc-001',
      documentType: 'restaurant',
      content: {
        title: 'Test Restaurant',
        description: 'A great place to eat',
        category: 'japanese'
      },
      location: {
        city: 'Tokyo',
        country: 'Japan',
        coordinates: {
          longitude: 139.7671,
          latitude: 35.6719
        }
      },
      attributes: {
        rating: 4.5,
        priceRange: 'medium'
      },
      source: {
        provider: 'test',
        verified: true
      }
    };

    describe('Successful Document Indexing', () => {
      it('should successfully index a valid document', async () => {
        const mockResult = {
          documentId: 'test-doc-001',
          indexed: true,
          embeddings: {
            title: true,
            description: true
          }
        };

        mockContentIndexingService.indexDocument.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/index`)
          .send(validDocumentData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Document indexed successfully');
        expect(response.body.data).toEqual(mockResult);
        expect(mockContentIndexingService.indexDocument).toHaveBeenCalledWith(validDocumentData);
      });

      it('should log successful indexing', async () => {
        const mockResult = {
          documentId: 'test-doc-001',
          indexed: true
        };

        mockContentIndexingService.indexDocument.mockResolvedValue(mockResult);

        await request(app)
          .post(`${API_BASE}/index`)
          .send(validDocumentData)
          .expect(201);

        expect(console.log).toHaveBeenCalledWith('Document indexed: test-doc-001');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when document data is missing', async () => {
        const response = await request(app)
          .post(`${API_BASE}/index`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('required');
      });

      it('should return 400 when documentId is missing', async () => {
        const invalidData = { ...validDocumentData };
        delete invalidData.documentId;

        const response = await request(app)
          .post(`${API_BASE}/index`)
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Document ID is required');
      });

      it('should return 400 when documentType is invalid', async () => {
        const invalidData = {
          ...validDocumentData,
          documentType: 'invalid-type'
        };

        const response = await request(app)
          .post(`${API_BASE}/index`)
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Document type must be one of');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle indexing service errors', async () => {
        const serviceError = new Error('Indexing failed');
        mockContentIndexingService.indexDocument.mockRejectedValue(serviceError);

        const response = await request(app)
          .post(`${API_BASE}/index`)
          .send(validDocumentData)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Failed to index document');
        expect(console.error).toHaveBeenCalledWith('Index document error:', serviceError);
      });
    });
  });

  describe('POST /api/v1/search/content/batch-index - Batch Index Documents', () => {
    const validBatchData = {
      documents: [
        {
          documentId: 'test-doc-001',
          documentType: 'restaurant',
          content: { title: 'Restaurant 1' }
        },
        {
          documentId: 'test-doc-002',
          documentType: 'attraction',
          content: { title: 'Attraction 1' }
        }
      ]
    };

    describe('Successful Batch Indexing', () => {
      it('should successfully batch index documents', async () => {
        const mockResult = {
          total: 2,
          successful: 2,
          failed: 0,
          results: [
            { documentId: 'test-doc-001', status: 'success' },
            { documentId: 'test-doc-002', status: 'success' }
          ]
        };

        mockContentIndexingService.batchIndexDocuments.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/batch-index`)
          .send(validBatchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Batch indexing completed');
        expect(response.body.data).toEqual(mockResult);
        expect(mockContentIndexingService.batchIndexDocuments).toHaveBeenCalledWith(validBatchData.documents);
      });

      it('should log batch indexing completion', async () => {
        const mockResult = {
          total: 2,
          successful: 2,
          failed: 0
        };

        mockContentIndexingService.batchIndexDocuments.mockResolvedValue(mockResult);

        await request(app)
          .post(`${API_BASE}/batch-index`)
          .send(validBatchData)
          .expect(200);

        expect(console.log).toHaveBeenCalledWith('Batch indexing completed: 2/2 successful');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when documents array is missing', async () => {
        const response = await request(app)
          .post(`${API_BASE}/batch-index`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Documents array is required and cannot be empty');
      });

      it('should return 400 when documents array is empty', async () => {
        const response = await request(app)
          .post(`${API_BASE}/batch-index`)
          .send({ documents: [] })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Documents array is required and cannot be empty');
      });

      it('should return 400 when documents array exceeds maximum limit', async () => {
        const largeDocumentArray = Array(1001).fill().map((_, i) => ({
          documentId: `doc-${i}`,
          documentType: 'restaurant',
          content: { title: `Document ${i}` }
        }));

        const response = await request(app)
          .post(`${API_BASE}/batch-index`)
          .send({ documents: largeDocumentArray })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Maximum 1000 documents allowed per batch');
      });

      it('should return 400 when documents array is not an array', async () => {
        const response = await request(app)
          .post(`${API_BASE}/batch-index`)
          .send({ documents: 'not-an-array' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Documents array is required and cannot be empty');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle batch indexing service errors', async () => {
        const serviceError = new Error('Batch indexing failed');
        mockContentIndexingService.batchIndexDocuments.mockRejectedValue(serviceError);

        const response = await request(app)
          .post(`${API_BASE}/batch-index`)
          .send(validBatchData)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Failed to batch index documents');
        expect(console.error).toHaveBeenCalledWith('Batch index documents error:', serviceError);
      });
    });
  });

  describe('PUT /api/v1/search/content/:documentId - Update Document', () => {
    const documentId = 'test-doc-001';
    const updateData = {
      content: {
        title: 'Updated Restaurant',
        description: 'Updated description'
      },
      attributes: {
        rating: 4.8
      }
    };

    describe('Successful Document Update', () => {
      it('should successfully update a document', async () => {
        const mockResult = {
          documentId: 'test-doc-001',
          updated: true,
          reembedded: true
        };

        mockContentIndexingService.updateDocument.mockResolvedValue(mockResult);

        const response = await request(app)
          .put(`${API_BASE}/${documentId}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Document updated successfully');
        expect(response.body.data).toEqual(mockResult);
        expect(mockContentIndexingService.updateDocument).toHaveBeenCalledWith(documentId, updateData);
      });

      it('should log successful update', async () => {
        const mockResult = {
          documentId: 'test-doc-001',
          updated: true,
          reembedded: true
        };

        mockContentIndexingService.updateDocument.mockResolvedValue(mockResult);

        await request(app)
          .put(`${API_BASE}/${documentId}`)
          .send(updateData)
          .expect(200);

        expect(console.log).toHaveBeenCalledWith('Document updated: test-doc-001, re-embedded: true');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when documentId is invalid', async () => {
        const response = await request(app)
          .put(`${API_BASE}/invalid-id`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Document ID must be between 1 and 100 characters');
      });

      it('should return 400 when update data is empty', async () => {
        const response = await request(app)
          .put(`${API_BASE}/${documentId}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('At least one field must be provided for update');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle update service errors', async () => {
        const serviceError = new Error('Update failed');
        mockContentIndexingService.updateDocument.mockRejectedValue(serviceError);

        const response = await request(app)
          .put(`${API_BASE}/${documentId}`)
          .send(updateData)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Failed to update document');
        expect(console.error).toHaveBeenCalledWith('Update document error:', serviceError);
      });
    });
  });

  describe('DELETE /api/v1/search/content/:documentId - Delete Document', () => {
    const documentId = 'test-doc-001';

    describe('Successful Document Deletion', () => {
      it('should successfully delete a document', async () => {
        const mockResult = {
          documentId: 'test-doc-001',
          deleted: true
        };

        mockContentIndexingService.deleteDocument.mockResolvedValue(mockResult);

        const response = await request(app)
          .delete(`${API_BASE}/${documentId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Document deleted successfully');
        expect(response.body.data).toEqual(mockResult);
        expect(mockContentIndexingService.deleteDocument).toHaveBeenCalledWith(documentId);
      });

      it('should log successful deletion', async () => {
        const mockResult = {
          documentId: 'test-doc-001',
          deleted: true
        };

        mockContentIndexingService.deleteDocument.mockResolvedValue(mockResult);

        await request(app)
          .delete(`${API_BASE}/${documentId}`)
          .expect(200);

        expect(console.log).toHaveBeenCalledWith('Document deleted: test-doc-001');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when documentId is invalid', async () => {
        const response = await request(app)
          .delete(`${API_BASE}/`)
          .expect(404); // Express returns 404 for missing route params

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle delete service errors', async () => {
        const serviceError = new Error('Delete failed');
        mockContentIndexingService.deleteDocument.mockRejectedValue(serviceError);

        const response = await request(app)
          .delete(`${API_BASE}/${documentId}`)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Failed to delete document');
        expect(console.error).toHaveBeenCalledWith('Delete document error:', serviceError);
      });
    });
  });

  describe('GET /api/v1/search/content/:documentId - Get Document', () => {
    const documentId = 'test-doc-001';

    describe('Successful Document Retrieval', () => {
      it('should successfully retrieve a document without embedding', async () => {
        const mockDocument = {
          _id: 'mock-id',
          documentId: 'test-doc-001',
          content: { title: 'Test Restaurant' },
          recordSearch: jest.fn()
        };

        mockEmbeddingDocument.findOne.mockResolvedValue(mockDocument);

        const response = await request(app)
          .get(`${API_BASE}/${documentId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Document retrieved successfully');
        expect(response.body.data.document).toEqual(mockDocument);
        expect(mockEmbeddingDocument.findOne).toHaveBeenCalledWith(
          { documentId },
          { embedding: 0 }
        );
      });

      it('should successfully retrieve a document with embedding when requested', async () => {
        const mockDocument = {
          _id: 'mock-id',
          documentId: 'test-doc-001',
          content: { title: 'Test Restaurant' },
          embedding: [0.1, 0.2, 0.3],
          recordSearch: jest.fn()
        };

        mockEmbeddingDocument.findOne.mockResolvedValue(mockDocument);

        const response = await request(app)
          .get(`${API_BASE}/${documentId}?includeEmbedding=true`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.document).toEqual(mockDocument);
        expect(mockEmbeddingDocument.findOne).toHaveBeenCalledWith(
          { documentId },
          {}
        );
      });

      it('should log successful retrieval', async () => {
        const mockDocument = {
          _id: 'mock-id',
          documentId: 'test-doc-001',
          recordSearch: jest.fn()
        };

        mockEmbeddingDocument.findOne.mockResolvedValue(mockDocument);

        await request(app)
          .get(`${API_BASE}/${documentId}`)
          .expect(200);

        expect(console.log).toHaveBeenCalledWith('Document retrieved: test-doc-001');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when document is not found', async () => {
        mockEmbeddingDocument.findOne.mockResolvedValue(null);

        const response = await request(app)
          .get(`${API_BASE}/${documentId}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Document not found');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when documentId is invalid', async () => {
        const response = await request(app)
          .get(`${API_BASE}/`)
          .expect(404); // Express returns 404 for missing route params

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle retrieval service errors', async () => {
        const serviceError = new Error('Retrieval failed');
        mockEmbeddingDocument.findOne.mockRejectedValue(serviceError);

        const response = await request(app)
          .get(`${API_BASE}/${documentId}`)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Failed to retrieve document');
        expect(console.error).toHaveBeenCalledWith('Get document error:', serviceError);
      });
    });
  });
});