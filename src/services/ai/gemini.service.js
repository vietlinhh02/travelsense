const GeminiApiClient = require('./geminiApiClient');
const PromptBuilder = require('./promptBuilder');
const ResponseParser = require('./responseParser');
const ActivityTemplateService = require('./activityTemplateService');
const LongTripHandler = require('./longTripHandler');
const AIChatService = require('./aiChat.service');
const AIItineraryService = require('./aiItinerary.service');
const AIValidationService = require('./aiValidation.service');

/**
 * GeminiService - Main AI service combining all AI functionalities
 * Uses composition pattern with specialized service classes
 *
 * Structured Output Features:
 * - JSON Schema Support: Generate structured JSON responses with validation
 * - Enum Support: Constrain responses to specific values from a list
 * - Predefined Templates: Ready-to-use schemas for common use cases
 *
 * Usage Examples:
 *
 * // Generate recipes with structured output
 * const recipes = await geminiService.generateRecipeList('Italian', 5);
 *
 * // Classify content with enum
 * const result = await geminiService.classifyWithEnum(
 *   'A beautiful violin performance',
 *   ['Percussion', 'String', 'Woodwind', 'Brass', 'Keyboard']
 * );
 *
 * // Generate user profiles
 * const profile = await geminiService.generateUserProfile(
 *   'A 25-year-old software engineer who loves hiking'
 * );
 *
 * // Create custom schema
 * const customSchema = geminiService.createObjectSchema({
 *   title: { type: 'STRING' },
 *   rating: { type: 'NUMBER', minimum: 1, maximum: 5 }
 * }, ['title']);
 */
class GeminiService {
  constructor() {
    // Initialize core dependencies
    this.apiClient = new GeminiApiClient();
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ResponseParser();
    this.templateService = new ActivityTemplateService();
    this.longTripHandler = new LongTripHandler();

    // Initialize specialized services
    this.chatService = new AIChatService();
    this.itineraryService = new AIItineraryService();
    this.validationService = new AIValidationService();

    // Initialize services with dependencies
    this._initializeServices();

    // Initialize structured output templates and utilities
    this._initializeStructuredOutput();
  }

  /**
   * Initialize all services with dependencies
   * @private
   */
  _initializeServices() {
    const dependencies = {
      apiClient: this.apiClient,
      promptBuilder: this.promptBuilder,
      responseParser: this.responseParser,
      templateService: this.templateService,
      longTripHandler: this.longTripHandler
    };

    // Initialize itinerary service first
    this.itineraryService.initialize(dependencies);

    // Initialize chat service with basic dependencies
    this.chatService.initialize(dependencies);
    this.validationService.initialize(dependencies);
  }

  /**
   * Initialize structured output templates and utilities
   * @private
   */
  _initializeStructuredOutput() {
    // Common enum values for different use cases
    this.enums = {
      activityCategories: [
        "cultural", "food", "shopping", "nature", "technology",
        "leisure", "nightlife", "sports", "adventure", "religious"
      ],
      priorities: ["low", "medium", "high", "critical"],
      ratings: ["excellent", "good", "average", "poor"],
      timeOfDay: ["morning", "afternoon", "evening", "night"],
      difficulty: ["easy", "moderate", "challenging", "expert"],
      costRange: ["free", "budget", "moderate", "expensive", "luxury"]
    };

          // Initialize predefined schema templates
      this._initializeTemplates();

      // Current date for template examples (avoid future dates)
      this.currentDate = new Date().toISOString().split('T')[0];
  }

  /**
   * Initialize predefined schema templates
   * @private
   */
  _initializeTemplates() {
    this.templates = {
      // Recipe template (from documentation example)
      recipe: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            recipeName: { type: "STRING" },
            ingredients: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          propertyOrdering: ["recipeName", "ingredients"]
        }
      },

      // Activity suggestion template
      activitySuggestion: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          category: {
            type: "STRING",
            enum: this.enums.activityCategories
          },
          duration: { type: "INTEGER", minimum: 15, maximum: 480 },
          estimatedCost: { type: "NUMBER", minimum: 0 },
          location: { type: "STRING" },
          timeOfDay: {
            type: "STRING",
            enum: this.enums.timeOfDay
          },
          priority: {
            type: "STRING",
            enum: this.enums.priorities
          },
          tags: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        },
        required: ["title", "description", "category", "duration"],
        propertyOrdering: ["title", "description", "category", "duration", "estimatedCost", "location", "timeOfDay"]
      },

      // Trip itinerary day template
      itineraryDay: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", format: "date" },
          activities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                time: { type: "STRING" },
                title: { type: "STRING" },
                description: { type: "STRING" },
                location: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    address: { type: "STRING" },
                    coordinates: {
                      type: "OBJECT",
                      properties: {
                        lat: { type: "NUMBER" },
                        lng: { type: "NUMBER" }
                      }
                    }
                  }
                },
                duration: { type: "INTEGER" },
                cost: { type: "NUMBER" },
                category: {
                  type: "STRING",
                  enum: this.enums.activityCategories
                },
                notes: { type: "STRING" }
              },
              required: ["time", "title", "location", "category"],
              propertyOrdering: ["time", "title", "description", "location", "duration", "cost", "category"]
            }
          }
        },
        required: ["date", "activities"],
        propertyOrdering: ["date", "activities"]
      },

      // User profile template
      userProfile: {
        type: "OBJECT",
        properties: {
          username: { type: "STRING", description: "User's unique name" },
          age: { type: "INTEGER", minimum: 0, maximum: 120 },
          roles: {
            type: "ARRAY",
            items: {
              type: "STRING",
              enum: ["admin", "viewer"]
            },
            minItems: 1
          },
          contact: {
            type: "OBJECT",
            properties: {
              street: { type: "STRING" },
              city: { type: "STRING" }
            },
            required: ["street", "city"]
          }
        },
        required: ["username", "roles"],
        propertyOrdering: ["username", "age", "roles", "contact"]
      }
    };
  }

  /**
   * Create a custom schema for JSON output
   * @param {Object} schemaDefinition - Schema definition object
   * @returns {Object} Complete schema configuration
   */
  createJSONSchema(schemaDefinition) {
    return {
      responseMimeType: "application/json",
      responseSchema: schemaDefinition
    };
  }

  /**
   * Create an enum schema for single value selection
   * @param {Array} enumValues - Array of possible string values
   * @returns {Object} Enum schema configuration
   */
  createEnumSchema(enumValues) {
    if (!Array.isArray(enumValues) || enumValues.length === 0) {
      throw new Error('Enum values must be a non-empty array');
    }

    return {
      responseMimeType: "text/x.enum",
      responseSchema: {
        type: "STRING",
        enum: enumValues
      }
    };
  }

  /**
   * Get a predefined template by name
   * @param {string} templateName - Name of the template
   * @returns {Object} Schema configuration
   */
  getTemplate(templateName) {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Template '${templateName}' not found. Available: ${Object.keys(this.templates).join(', ')}`);
    }

    return this.createJSONSchema(template);
  }

  /**
   * Create an array schema with specified item type
   * @param {Object} itemSchema - Schema for array items
   * @param {Object} options - Additional options (minItems, maxItems)
   * @returns {Object} Array schema configuration
   */
  createArraySchema(itemSchema, options = {}) {
    const schema = {
      type: "ARRAY",
      items: itemSchema
    };

    if (options.minItems !== undefined) {
      schema.minItems = options.minItems;
    }

    if (options.maxItems !== undefined) {
      schema.maxItems = options.maxItems;
    }

    return this.createJSONSchema(schema);
  }

  /**
   * Create an object schema with specified properties
   * @param {Object} properties - Object properties definition
   * @param {Array} required - Array of required property names
   * @param {Array} propertyOrdering - Array defining property order
   * @returns {Object} Object schema configuration
   */
  createObjectSchema(properties, required = [], propertyOrdering = null) {
    const schema = {
      type: "OBJECT",
      properties
    };

    if (required.length > 0) {
      schema.required = required;
    }

    if (propertyOrdering && Array.isArray(propertyOrdering)) {
      schema.propertyOrdering = propertyOrdering;
    }

    return this.createJSONSchema(schema);
  }

  /**
   * Create a recipe list schema (from documentation example)
   * @param {number} maxRecipes - Maximum number of recipes to return
   * @returns {Object} Recipe schema configuration
   */
  createRecipeListSchema(maxRecipes = 10) {
    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          recipeName: { type: "STRING" },
          ingredients: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        },
        propertyOrdering: ["recipeName", "ingredients"]
      },
      maxItems: maxRecipes
    };

    return this.createJSONSchema(schema);
  }

  /**
   * Create a complete itinerary schema with date validation
   * @param {number} maxDays - Maximum number of days
   * @param {Array} validDates - Array of valid date strings (YYYY-MM-DD format)
   * @returns {Object} Itinerary schema configuration
   */
  createItinerarySchema(maxDays = 14, validDates = null) {
    // Simplified schema to avoid 500 errors
    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: {
            type: "STRING",
            description: "Date in YYYY-MM-DD format"
          },
          activities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                time: { type: "STRING", description: "Time in HH:MM format" },
                title: { type: "STRING" },
                description: { type: "STRING" },
                location: { type: "STRING", description: "Location name and address" },
                duration: { type: "INTEGER", minimum: 15, maximum: 480 },
                cost: { type: "NUMBER", minimum: 0 },
                category: { type: "STRING" }
              },
              required: ["time", "title", "location"]
            },
            minItems: 1,
            maxItems: 6
          }
        },
        required: ["date", "activities"]
      },
      minItems: 1,
      maxItems: maxDays
    };

    return this.createJSONSchema(schema);
  }

  // Delegate methods to specialized services

  /**
   * Chat with AI
   */
  async chatWithAI(userId, chatData) {
    return await this.chatService.chatWithAI(userId, chatData);
  }

  /**
   * Generate trip itinerary using structured output (simplified)
   */
  async generateItinerary(userId, tripId, options = {}) {
    try {
      // Get trip data from database
      const { Trip } = require('../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Check if trip already has a complete itinerary
      if (trip.itinerary && trip.itinerary.days && trip.itinerary.days.length > 0) {
        console.log('ℹ️ Trip already has itinerary, returning existing data...');
        return {
          itinerary: trip.itinerary.days,
          tokensUsed: 0,
          processingTime: 0,
          rateLimitRemaining: 0,
          status: 'exists',
          message: 'Itinerary already exists for this trip'
        };
      }

      console.log('🎯 Generating itinerary with AI...');

      // Use simplified structured output approach
      const result = await this.generateStructuredItinerary(userId, tripId, options);

                      // Save itinerary to database
                if (result.itinerary && result.itinerary.length > 0) {
                  trip.itinerary = {
                    destination: trip.destination.destination,
                    overview: `Lịch trình ${trip.duration} ngày tại ${trip.destination.destination} được tạo bởi AI`,
                    days: result.itinerary,
                    totalCost: trip.budget?.total || 0,
                    tips: result.tips || [
                      'Đặt phòng khách sạn và hoạt động trước để có giá tốt nhất',
                      'Mang theo kem chống nắng, mũ nón và nước uống',
                      'Học một vài từ tiếng Việt cơ bản để giao tiếp với người dân địa phương',
                      'Thử các món ăn đường phố đặc trưng của vùng miền',
                      'Sử dụng ứng dụng Grab hoặc taxi để di chuyển an toàn'
                    ]
                  };
                  trip.status = 'completed'; // Mark as completed when successfully generated
                  await trip.save();

                  console.log('✅ Itinerary saved to database successfully!');
                }

      // Return structured JSON directly
      return {
        itinerary: result.itinerary,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime,
        rateLimitRemaining: result.rateLimitRemaining,
        status: 'success',
        saved: true
      };

    } catch (error) {
      console.error('Generate itinerary error:', error);
      throw error;
    }
  }

  /**
   * Optimize trip schedule and save to database
   */
  async optimizeSchedule(userId, tripId, options = {}) {
    try {
      // Get trip data from database
      const { Trip } = require('../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Check if trip has itinerary to optimize
      if (!trip.itinerary || !trip.itinerary.days || trip.itinerary.days.length === 0) {
        throw new Error('NO_ITINERARY_TO_OPTIMIZE');
      }

      // Use itinerary service to optimize schedule
      const result = await this.itineraryService.optimizeSchedule(userId, tripId, {
        ...options,
        preferences: trip.preferences || {},
        currentItinerary: trip.itinerary // Pass current itinerary for optimization
      });

      // Update trip with optimized itinerary
      trip.itinerary = result.optimizedSchedule;
      trip.status = 'optimized';
      await trip.save();

      return {
        optimizedSchedule: result.optimizedSchedule,
        optimizations: result.optimizations,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime,
        rateLimitRemaining: result.rateLimitRemaining
      };

    } catch (error) {
      console.error('Optimize schedule error:', error);
      throw error;
    }
  }

  /**
   * Validate trip constraints and save results
   */
  async validateConstraints(userId, tripId, options = {}) {
    try {
      // Get trip data from database
      const { Trip } = require('../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Use itinerary service to validate constraints
      const result = await this.itineraryService.validateConstraints(userId, tripId, {
        ...options,
        checkType: options.checkType || 'all',
        preferences: trip.preferences || {},
        itinerary: trip.itinerary
      });

      // Save validation results to trip
      if (!trip.validationResults) {
        trip.validationResults = [];
      }
      trip.validationResults.push({
        timestamp: new Date(),
        checkType: options.checkType || 'all',
        results: result.validationResults,
        violations: result.violations,
        warnings: result.warnings,
        suggestions: result.suggestions
      });
      await trip.save();

      return {
        validationResults: result.validationResults,
        violations: result.violations,
        warnings: result.warnings,
        suggestions: result.suggestions,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime,
        rateLimitRemaining: result.rateLimitRemaining
      };

    } catch (error) {
      console.error('Validate constraints error:', error);
      throw error;
    }
  }

  /**
   * Generate activity suggestions and save to database
   */
  async generateActivitySuggestions(userId, suggestionData) {
    try {
      let trip = null;

      // Get trip data if tripId is provided
      if (suggestionData.tripId) {
        const { Trip } = require('../../models/trips');
        trip = await Trip.findById(suggestionData.tripId);

        if (!trip) {
          throw new Error('TRIP_NOT_FOUND');
        }

        if (!trip.isOwnedBy(userId)) {
          throw new Error('TRIP_ACCESS_DENIED');
        }
      }

      // Use itinerary service to generate activity suggestions
      const result = await this.itineraryService.generateActivitySuggestions(userId, {
        ...suggestionData,
        preferences: trip ? trip.preferences : {}
      });

      // Save suggestions to trip if tripId is provided
      if (trip) {
        if (!trip.activitySuggestions) {
          trip.activitySuggestions = [];
        }
        trip.activitySuggestions.push({
          timestamp: new Date(),
          date: suggestionData.date,
          timePeriod: suggestionData.timePeriod,
          suggestions: result.suggestions
        });
        await trip.save();
      }

      return {
        suggestions: result.suggestions,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime,
        rateLimitRemaining: result.rateLimitRemaining
      };

    } catch (error) {
      console.error('Generate activity suggestions error:', error);
      throw error;
    }
  }

  /**
   * Update trip information from chat message
   */
  async updateTripInfoFromChat(userId, tripId, message) {
    try {
      // Get trip data from database
      const { Trip } = require('../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Extract information from message using chat service
      const extractedInfo = await this.chatService._extractTripInfoFromMessage(message, trip);

      if (!extractedInfo || Object.keys(extractedInfo).length === 0) {
        return {
          extractedInfo: {},
          updatedFields: [],
          trip: trip
        };
      }

      // Update trip with extracted information
      await this.chatService._updateTripWithExtractedInfo(tripId, extractedInfo);

      // Get updated trip
      const updatedTrip = await Trip.findById(tripId);

      return {
        extractedInfo,
        updatedFields: Object.keys(extractedInfo),
        trip: updatedTrip
      };

    } catch (error) {
      console.error('Update trip info from chat error:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    return await this.validationService.getHealthStatus();
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(userId) {
    return await this.validationService.getRateLimitStatus(userId);
  }

  /**
   * Get user AI interaction statistics
   */
  async getInteractionStats(userId, timeframe = 30) {
    return await this.validationService.getInteractionStats(userId, timeframe);
  }



  // ============================================
  // STRUCTURED OUTPUT METHODS
  // ============================================

  /**
   * Generate structured itinerary using predefined schema
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Structured itinerary response
   */
  async generateStructuredItinerary(userId, tripId, options = {}) {
    try {
      // Get trip data
      const { Trip } = require('../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      console.log('🎯 Generating structured itinerary...');

      // Calculate actual dates for the trip FIRST (Fix hoisting error)
      const startDate = new Date(trip.destination.startDate);
      const actualDates = [];
      for (let i = 0; i < trip.duration; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        actualDates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD format
      }

      console.log('📅 Trip dates calculated:', actualDates);

      // Create simple itinerary schema with actual dates validation
      const itinerarySchema = this.createItinerarySchema(trip.duration || 3, actualDates);

      // Build prompt with VND currency support and correct dates
      const currency = trip.budget?.currency || 'VND'; // VND as default
      const budgetText = trip.budget?.total ?
        `Budget: ${trip.budget.total.toLocaleString()} ${currency}` : '';

      const prompt = `Tạo lịch trình ${trip.duration} ngày cho ${trip.destination.destination} từ ${actualDates[0]} đến ${actualDates[actualDates.length - 1]}.
      ${budgetText}

      QUAN TRỌNG: Sử dụng ĐÚNG các ngày này cho mỗi ngày: ${actualDates.join(', ')}

      Yêu cầu trả về bằng tiếng Việt, bao gồm:
      - Các hoạt động hàng ngày với thời gian, tiêu đề, mô tả chi tiết, địa chỉ cụ thể, thời lượng, chi phí, và ghi chú hữu ích
      - Địa chỉ chi tiết và tên địa điểm cụ thể
      - Ghi chú thực tế như: cách di chuyển, thời gian tốt nhất, lưu ý đặc biệt, kinh nghiệm du lịch
      - Giá cả thực tế cho địa điểm Việt Nam (VD: ăn uống 50,000-200,000 VND, hoạt động 100,000-500,000 VND)

      Cuối cùng, thêm phần tips du lịch hữu ích.

      Trả về dưới dạng JSON với cấu trúc ĐÚNG như sau:
      {
        "days": [
          {
            "date": "${actualDates[0]}",
            "activities": [
              {
                "time": "09:00",
                "title": "Tên hoạt động",
                "description": "Mô tả chi tiết bằng tiếng Việt",
                "location": "Tên địa điểm cụ thể, Địa chỉ đầy đủ",
                "duration": 120,
                "cost": 0,
                "category": "cultural",
                "notes": "Ghi chú hữu ích bằng tiếng Việt"
              }
            ]
          }
        ],
        "tips": [
          "Mẹo du lịch 1",
          "Mẹo du lịch 2",
          "Mẹo du lịch 3"
        ]
      }`;

      // Call Gemini with structured output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'pro',
        prompt,
        itinerarySchema,
        options
      );

      // Return structured JSON directly (Gemini already parsed it)
      let structuredData = response.isStructured ? response.content :
        JSON.parse(response.content);

      // Transform Gemini response to match Mongoose schema
      console.log('🔄 Transforming Gemini response to Mongoose format...');
      structuredData = this._transformGeminiToMongoose(structuredData);

      // Extract tips from response if available
      const tips = structuredData.tips || [
        'Đặt phòng khách sạn và hoạt động trước để có giá tốt nhất',
        'Mang theo kem chống nắng, mũ nón và nước uống',
        'Học một vài từ tiếng Việt cơ bản để giao tiếp với người dân địa phương',
        'Thử các món ăn đường phố đặc trưng của vùng miền',
        'Sử dụng ứng dụng Grab hoặc taxi để di chuyển an toàn'
      ];

      // Validate dates and structure
      const validation = this.responseParser.validateItinerary(structuredData, trip);
      if (!validation.ok) {
        console.warn('⚠️ Itinerary validation warnings:', validation.issues);
        // Continue anyway but log warnings
      }

      console.log('✅ Structured itinerary generated successfully!');

      return {
        itinerary: structuredData,
        tokensUsed: response.tokensUsed,
        processingTime: response.processingTime || 0,
        rateLimitRemaining: response.rateLimitRemaining || 0,
        tips: tips
      };

    } catch (error) {
      console.error('Generate structured itinerary error:', error);
      throw error;
    }
  }

  /**
   * Generate activity suggestions with structured output
   * @param {string} userId - User ID
   * @param {Object} suggestionData - Suggestion parameters
   * @returns {Promise<Object>} Structured suggestions
   */
  async generateStructuredActivitySuggestions(userId, suggestionData) {
    try {
      console.log('🎯 Generating structured activity suggestions...');

      // Create activity suggestion schema
      const suggestionSchema = this.createArraySchema(
        this.templates.activitySuggestion,
        { minItems: 1, maxItems: 10 }
      );

      // Build prompt for activity suggestions
      const prompt = this.promptBuilder.buildActivitySuggestionPrompt(suggestionData);

      // Call Gemini with structured output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'flash',
        prompt,
        suggestionSchema
      );

      // Process structured response - Gemini already returns parsed JSON
      const structuredData = response.isStructured ? response.content :
        this.responseParser.extractStructuredData(
          response.content,
          'json',
          suggestionSchema.responseSchema
        );

      console.log('✅ Structured activity suggestions generated successfully!');

      return {
        suggestions: structuredData,
        tokensUsed: response.tokensUsed,
        processingTime: response.processingTime || 0
      };

    } catch (error) {
      console.error('Generate structured activity suggestions error:', error);
      throw error;
    }
  }

  /**
   * Classify content using enum structured output
   * @param {string} content - Content to classify
   * @param {Array} categories - Array of possible categories
   * @returns {Promise<string>} Classification result
   */
  async classifyWithEnum(content, categories) {
    try {
      console.log('🎯 Classifying content with enum...');

      // Create enum schema
      const enumSchema = this.createEnumSchema(categories);

      // Build classification prompt
      const prompt = `Please classify the following content into one of these categories: ${categories.join(', ')}\n\nContent: ${content}`;

      // Call Gemini with enum output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'flash',
        prompt,
        enumSchema
      );

      // Process enum response - Gemini already returns parsed JSON for structured output
      const classification = response.isStructured ? response.content :
        this.responseParser.extractStructuredData(
          response.content,
          'enum',
          enumSchema.responseSchema
        );

      console.log(`✅ Content classified as: ${classification}`);

      return {
        classification,
        confidence: 0.9, // Could be enhanced with actual confidence scores
        tokensUsed: response.tokensUsed
      };

    } catch (error) {
      console.error('Classification error:', error);
      throw error;
    }
  }

  /**
   * Generate recipe list using structured output (example from docs)
   * @param {string} cuisine - Type of cuisine
   * @param {number} maxRecipes - Maximum number of recipes
   * @returns {Promise<Object>} Recipe list
   */
  async generateRecipeList(cuisine = 'Italian', maxRecipes = 5) {
    try {
      console.log(`🎯 Generating ${cuisine} recipes with structured output...`);

      // Create recipe schema
      const recipeSchema = this.createRecipeListSchema(maxRecipes);

      // Build recipe prompt
      const prompt = `List ${maxRecipes} popular ${cuisine} cookie recipes, and include the amounts of ingredients.`;

      // Call Gemini with structured output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'flash',
        prompt,
        recipeSchema
      );

      // Process structured response - Gemini already returns parsed JSON
      const recipes = response.isStructured ? response.content :
        this.responseParser.extractStructuredData(
          response.content,
          'json',
          recipeSchema.responseSchema
        );

      console.log(`✅ Generated ${recipes.length} ${cuisine} recipes!`);

      return {
        recipes,
        cuisine,
        tokensUsed: response.tokensUsed,
        processingTime: response.processingTime || 0
      };

    } catch (error) {
      console.error('Generate recipe list error:', error);
      throw error;
    }
  }

  /**
   * Generate user profile with structured output
   * @param {string} description - Description of the person
   * @returns {Promise<Object>} User profile
   */
  async generateUserProfile(description) {
    try {
      console.log('🎯 Generating user profile with structured output...');

      // Create user profile schema
      const profileSchema = this.getTemplate('userProfile');

      // Build profile prompt
      const prompt = `Please create a user profile based on this description: "${description}". Fill in all available information.`;

      // Call Gemini with structured output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'flash',
        prompt,
        profileSchema
      );

      // Process structured response - Gemini already returns parsed JSON
      const profile = response.isStructured ? response.content :
        this.responseParser.extractStructuredData(
          response.content,
          'json',
          profileSchema.responseSchema
        );

      console.log('✅ User profile generated successfully!');

      return {
        profile,
        tokensUsed: response.tokensUsed,
        processingTime: response.processingTime || 0
      };

    } catch (error) {
      console.error('Generate user profile error:', error);
      throw error;
    }
  }

  /**
   * Convert structured itinerary to standard format
   * @private
   * @param {Object} structuredItinerary - Structured itinerary data
   * @param {Object} trip - Trip object
   * @returns {Object} Standard itinerary format
   */
  _convertStructuredItineraryToStandard(structuredItinerary, trip) {
    if (!structuredItinerary.days || !Array.isArray(structuredItinerary.days)) {
      throw new Error('Invalid structured itinerary format');
    }

    return {
      destination: structuredItinerary.destination || trip.destination.destination,
      overview: structuredItinerary.overview || '',
      days: structuredItinerary.days.map(day => ({
        date: new Date(day.date),
        activities: day.activities.map(activity => ({
          time: activity.time,
          title: activity.title,
          description: activity.description || activity.notes || 'AI-generated activity',
          location: {
            name: activity.location?.name || activity.venue || activity.title,
            address: activity.location?.address || activity.address || `${activity.title}, ${trip.destination.destination}`,
            coordinates: activity.location?.coordinates || this._generateCoordinates(trip.destination.destination)
          },
          duration: activity.duration || 120,
          cost: activity.cost || 0,
          category: activity.category,
          notes: 'Generated by Gemini AI with structured output'
        }))
      })),
      totalCost: structuredItinerary.totalCost || 0,
      tips: structuredItinerary.tips || []
    };
  }

  /**
   * Convert structured itinerary to standard format using template service
   * @private
   * @param {Object} structuredItinerary - Structured itinerary data
   * @param {Object} trip - Trip object
   * @returns {Object} Standard itinerary format
   */
  _convertStructuredToStandardItinerary(structuredItinerary, trip) {
    if (!structuredItinerary.days || !Array.isArray(structuredItinerary.days)) {
      throw new Error('Invalid structured itinerary format');
    }

    return {
      destination: structuredItinerary.destination || trip.destination.destination,
      overview: structuredItinerary.overview || '',
      days: structuredItinerary.days.map(day => ({
        date: new Date(day.date),
        activities: day.activities.map(activity => ({
          time: activity.time,
          title: activity.title,
          description: activity.description || activity.notes || 'AI-generated activity',
          location: {
            name: activity.location?.name || activity.venue || activity.title,
            address: activity.location?.address || activity.address || `${activity.title}, ${trip.destination.destination}`,
            coordinates: activity.location?.coordinates || this.templateService._generateCoordinates(trip.destination.destination)
          },
          duration: activity.duration || 120,
          cost: activity.cost || 0,
          category: activity.category,
          notes: 'Generated by Gemini AI with structured output'
        }))
      })),
      totalCost: structuredItinerary.totalCost || 0,
      tips: structuredItinerary.tips || []
    };
  }

  /**
   * Transform Gemini response to Mongoose format
   * @param {Object} geminiData - Raw response from Gemini with days and tips
   * @returns {Array} Transformed data matching Mongoose schema
   */
  _transformGeminiToMongoose(geminiData) {
    console.log('🔄 Transforming Gemini format to Mongoose format...');

    // Handle both old format (direct array) and new format (with days property)
    const days = geminiData.days || geminiData;

    // Preserve tips if present
    const result = Array.isArray(days) ? days.map(day => ({
      date: day.date, // Keep as string for now, will be converted to Date when saving
      activities: day.activities.map(activity => ({
        time: activity.time,
        title: activity.title,
        description: activity.description || '',
        location: {
          name: typeof activity.location === 'string' ? activity.location : activity.location?.name || activity.title,
          address: typeof activity.location === 'object' ? activity.location?.address || activity.location : `${activity.title} location`
        },
        duration: activity.duration || 120,
        cost: activity.cost || 0,
        category: this._mapCategoryToEnum(activity.category),
        notes: activity.notes || ''
      }))
    })) : [];

    // Attach tips to result for later use
    result.tips = geminiData.tips || [];

    return result;
  }

  /**
   * Map AI-generated category to valid enum values
   * @param {string} aiCategory - Category from AI
   * @returns {string} Valid enum category
   */
  _mapCategoryToEnum(aiCategory) {
    if (!aiCategory) return 'cultural';

    // Normalize category string
    const normalized = aiCategory.toLowerCase().trim();

    // Mapping from AI categories to valid enum values
    const categoryMap = {
      // English categories
      'cultural': 'cultural',
      'culture': 'cultural',
      'historical': 'cultural',
      'museum': 'cultural',
      'temple': 'cultural',
      'pagoda': 'cultural',
      'church': 'cultural',
      'cathedral': 'cultural',

      'food': 'food',
      'restaurant': 'food',
      'cafe': 'food',
      'coffee': 'food',
      'meal': 'food',
      'dining': 'food',
      'cuisine': 'food',
      'snack': 'food',

      'nature': 'nature',
      'beach': 'nature',
      'park': 'nature',
      'mountain': 'nature',
      'scenery': 'nature',
      'landscape': 'nature',
      'outdoor': 'nature',
      'natural': 'nature',

      'shopping': 'shopping',
      'market': 'shopping',
      'mall': 'shopping',
      'boutique': 'shopping',
      'store': 'shopping',

      'adventure': 'adventure',
      'sport': 'adventure',
      'sports': 'adventure',
      'hiking': 'adventure',
      'trekking': 'adventure',

      'nightlife': 'nightlife',
      'night': 'nightlife',
      'bar': 'nightlife',
      'club': 'nightlife',
      'entertainment': 'nightlife',

      'relaxation': 'relaxation',
      'relax': 'relaxation',
      'spa': 'relaxation',
      'massage': 'relaxation',
      'wellness': 'relaxation',
      'leisure': 'relaxation',

      'transportation': 'transportation',
      'transport': 'transportation',
      'travel': 'transportation',
      'bus': 'transportation',
      'taxi': 'transportation',

      'accommodation': 'accommodation',
      'hotel': 'accommodation',
      'resort': 'accommodation',
      'stay': 'accommodation',
      'lodging': 'accommodation',

      // Tiếng Việt categories
      'văn hóa': 'cultural',
      'lịch sử': 'cultural',
      'di tích': 'cultural',
      'đền': 'cultural',
      'chùa': 'cultural',
      'nhà thờ': 'cultural',
      'bảo tàng': 'cultural',

      'ẩm thực': 'food',
      'đồ ăn': 'food',
      'quán ăn': 'food',
      'cafe': 'food',
      'cà phê': 'food',
      'bữa ăn': 'food',
      'món ăn': 'food',
      'ăn vặt': 'food',

      'thiên nhiên': 'nature',
      'bãi biển': 'nature',
      'công viên': 'nature',
      'núi': 'nature',
      'phong cảnh': 'nature',
      'ngoài trời': 'nature',

      'mua sắm': 'shopping',
      'chợ': 'shopping',
      'trung tâm thương mại': 'shopping',
      'cửa hàng': 'shopping',

      'phiêu lưu': 'adventure',
      'thể thao': 'adventure',
      'leo núi': 'adventure',
      'đi bộ': 'adventure',

      'giải trí đêm': 'nightlife',
      'quán bar': 'nightlife',
      'câu lạc bộ': 'nightlife',
      'vui chơi': 'nightlife',

      'nghỉ ngơi': 'relaxation',
      'thư giãn': 'relaxation',
      'spa': 'relaxation',
      'massage': 'relaxation',
      'sức khỏe': 'relaxation',

      'giao thông': 'transportation',
      'di chuyển': 'transportation',
      'du lịch': 'transportation',
      'xe buýt': 'transportation',
      'taxi': 'transportation',

      'khách sạn': 'accommodation',
      'resort': 'accommodation',
      'lưu trú': 'accommodation',

      // Default fallback for unmapped categories
      'sightseeing': 'cultural',
      'landmark': 'cultural',
      'attraction': 'cultural',
      'tour': 'cultural',
      'visit': 'cultural',
      'exploration': 'cultural',
      'experience': 'cultural',
      'thăm quan': 'cultural',
      'khám phá': 'cultural',
      'trải nghiệm': 'cultural'
    };

    return categoryMap[normalized] || 'cultural'; // Default to cultural if not found
  }
}

module.exports = GeminiService;