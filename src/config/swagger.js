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
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
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