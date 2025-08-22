const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TravelSense Backend API',
      version: '1.0.0',
      description: 'TravelSense v2 Backend API Documentation',
      contact: {
        name: 'TravelSense Team',
        email: 'support@travelsense.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether email is verified'
            },
            phoneVerified: {
              type: 'boolean',
              description: 'Whether phone is verified'
            },
            twoFactorEnabled: {
              type: 'boolean',
              description: 'Whether 2FA is enabled'
            },
            googleId: {
              type: 'string',
              description: 'Google OAuth ID (if applicable)'
            },
            preferences: {
              type: 'object',
              properties: {
                interests: {
                  type: 'array',
                  items: { type: 'string' }
                },
                constraints: {
                  type: 'array',
                  items: { type: 'string' }
                },
                travelStyle: {
                  type: 'string',
                  enum: ['budget', 'luxury', 'adventure', 'cultural', 'family', 'business']
                },
                budgetRange: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'luxury']
                }
              }
            },
            profile: {
              type: 'object',
              properties: {
                dateOfBirth: {
                  type: 'string',
                  format: 'date'
                },
                nationality: {
                  type: 'string'
                },
                languages: {
                  type: 'array',
                  items: { type: 'string' }
                },
                specialRequirements: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            },
            lastLogin: {
              type: 'string',
              format: 'date-time'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string'
            },
            user: {
              $ref: '#/components/schemas/User'
            },
            accessToken: {
              type: 'string'
            }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Validation error message'
            }
          }
        },
        Trip: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Trip ID'
            },
            name: {
              type: 'string',
              description: 'Trip name'
            },
            destination: {
              type: 'object',
              properties: {
                country: { type: 'string' },
                city: { type: 'string' },
                coordinates: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' }
                  }
                }
              }
            },
            travelers: {
              type: 'object',
              properties: {
                adults: { type: 'integer', minimum: 0 },
                children: { type: 'integer', minimum: 0 },
                infants: { type: 'integer', minimum: 0 }
              }
            },
            budget: {
              type: 'object',
              properties: {
                total: { type: 'number', minimum: 0 },
                currency: { type: 'string' },
                breakdown: {
                  type: 'object',
                  properties: {
                    accommodation: { type: 'number' },
                    transportation: { type: 'number' },
                    activities: { type: 'number' },
                    food: { type: 'number' },
                    other: { type: 'number' }
                  }
                }
              }
            },
            preferences: {
              type: 'object',
              properties: {
                interests: { type: 'array', items: { type: 'string' } },
                constraints: { type: 'array', items: { type: 'string' } },
                travelStyle: { type: 'string', enum: ['budget', 'luxury', 'adventure', 'cultural', 'family', 'business'] },
                accommodationType: { type: 'string', enum: ['hotel', 'hostel', 'resort', 'apartment', 'cabin', 'camping'] },
                transportation: { type: 'string', enum: ['flight', 'train', 'bus', 'car', 'boat', 'walking'] }
              }
            },
            duration: {
              type: 'integer',
              description: 'Duration in days'
            },
            status: {
              type: 'string',
              enum: ['draft', 'planned', 'ongoing', 'completed', 'cancelled'],
              description: 'Trip status'
            },
            startDate: {
              type: 'string',
              format: 'date'
            },
            endDate: {
              type: 'string',
              format: 'date'
            },
            userId: {
              type: 'string',
              description: 'User ID who owns the trip'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        AIResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                  metadata: { type: 'object' }
                }
              }
            },
            suggestions: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        SearchResult: {
          type: 'object',
          properties: {
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  type: { type: 'string' },
                  location: { type: 'string' },
                  score: { type: 'number' },
                  metadata: { type: 'object' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer' },
                totalPages: { type: 'integer' },
                totalCount: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' }
              }
            },
            totalFound: { type: 'integer' }
          }
        },
        HealthStatus: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            memory: {
              type: 'object',
              properties: {
                rss: { type: 'number' },
                heapTotal: { type: 'number' },
                heapUsed: { type: 'number' },
                external: { type: 'number' }
              }
            },
            mongodb: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                state: { type: 'integer' }
              }
            }
          }
        },
        SearchFilters: {
          type: 'object',
          properties: {
            documentTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation']
              },
              description: 'Filter by document types'
            },
            location: {
              type: 'object',
              properties: {
                country: {
                  type: 'string',
                  description: 'Filter by country'
                },
                city: {
                  type: 'string',
                  description: 'Filter by city'
                }
              }
            },
            attributes: {
              type: 'object',
              properties: {
                priceRange: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['budget', 'mid-range', 'luxury', 'free']
                  },
                  description: 'Filter by price ranges'
                },
                minRating: {
                  type: 'number',
                  minimum: 0,
                  maximum: 5,
                  description: 'Minimum rating filter'
                },
                maxDuration: {
                  type: 'integer',
                  description: 'Maximum duration in minutes'
                },
                categories: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Filter by categories'
                },
                accessibility: {
                  type: 'object',
                  properties: {
                    wheelchairAccessible: {
                      type: 'boolean'
                    },
                    familyFriendly: {
                      type: 'boolean'
                    },
                    petFriendly: {
                      type: 'boolean'
                    }
                  }
                },
                seasons: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['spring', 'summer', 'autumn', 'winter', 'year-round']
                  }
                }
              }
            },
            verified: {
              type: 'boolean',
              description: 'Filter by verified content only'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health Check',
          description: 'Get server health status and system information',
          tags: ['System'],
          responses: {
            200: {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/HealthStatus'
                  }
                }
              }
            }
          }
        }
      },
      '/api/v1/auth/refresh': {
        post: {
          summary: 'Refresh Access Token',
          description: 'Refresh access token using refresh token cookie',
          tags: ['Authentication'],
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Token refreshed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            400: { description: 'Invalid refresh token' },
            401: { description: 'Refresh token required' }
          }
        }
      },
      '/api/v1/users/register': {
        post: {
          summary: 'User Registration',
          description: 'Register a new user account',
          tags: ['Users'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'firstName', 'lastName'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' }
                }
              }
            },
            400: { description: 'Validation error' },
            409: { description: 'User already exists' }
          }
        }
      },
      '/api/v1/users/login': {
        post: {
          summary: 'User Login',
          description: 'Authenticate user and get tokens',
          tags: ['Users'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' }
                }
              }
            },
            400: { description: 'Invalid credentials' },
            401: { description: 'Authentication failed' }
          }
        }
      },
      '/api/v1/users/profile': {
        get: {
          summary: 'Get User Profile',
          description: 'Get current user profile',
          tags: ['Users'],
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Profile retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' }
                }
              }
            },
            401: { description: 'Unauthorized' },
            404: { description: 'User not found' }
          }
        },
        put: {
          summary: 'Update User Profile',
          description: 'Update current user profile',
          tags: ['Users'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    preferences: { type: 'object' },
                    profile: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Profile updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' }
                }
              }
            },
            400: { description: 'Validation error' },
            401: { description: 'Unauthorized' }
          }
        }
      },
      '/api/v1/trips': {
        get: {
          summary: 'Get User Trips',
          description: 'Get all trips for current user',
          tags: ['Trips'],
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'planned', 'ongoing', 'completed', 'cancelled'] } }
          ],
          responses: {
            200: {
              description: 'Trips retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      trips: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Trip' }
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          currentPage: { type: 'integer' },
                          totalPages: { type: 'integer' },
                          totalCount: { type: 'integer' },
                          hasNext: { type: 'boolean' },
                          hasPrev: { type: 'boolean' }
                        }
                      }
                    }
                  }
                }
              }
            },
            401: { description: 'Unauthorized' }
          }
        },
        post: {
          summary: 'Create Trip',
          description: 'Create a new trip',
          tags: ['Trips'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Trip' }
              }
            }
          },
          responses: {
            201: {
              description: 'Trip created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Trip' }
                }
              }
            },
            400: { description: 'Validation error' },
            401: { description: 'Unauthorized' }
          }
        }
      },
      '/api/v1/search/vector': {
        post: {
          summary: 'Vector Search',
          description: 'Perform semantic search using vector embeddings',
          tags: ['Search'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    query: { type: 'string' },
                    filters: { $ref: '#/components/schemas/SearchFilters' },
                    limit: { type: 'integer', default: 10 }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Search completed successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SearchResult' }
                }
              }
            },
            400: { description: 'Invalid query' },
            401: { description: 'Unauthorized' }
          }
        }
      },
      '/api/v1/ai/chat': {
        post: {
          summary: 'AI Chat',
          description: 'Chat with AI for travel recommendations',
          tags: ['AI'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message: { type: 'string' },
                    context: { type: 'string' },
                    userPreferences: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'AI response generated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AIResponse' }
                }
              }
            },
            400: { description: 'Invalid message' },
            401: { description: 'Unauthorized' }
          }
        }
      }
    }
  },
  apis: [
    './src/routes/v1/**/*.js',
    './src/controllers/**/*.js',
    './src/models/**/*.js'
  ]
};

const specs = swaggerJSDoc(options);

const swaggerSetup = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TravelSense API Documentation'
  }));

  // Serve swagger.json
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

module.exports = {
  swaggerSetup,
  swaggerSpecs: specs
};