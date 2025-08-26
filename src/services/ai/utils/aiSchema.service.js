/**
 * AISchemaService - Handles JSON Schema creation and structured output templates
 * Manages predefined templates and custom schema generation for Gemini AI
 */
class AISchemaService {
  constructor() {
    this._initializeEnums();
    this._initializeTemplates();
  }

  /**
   * Initialize common enum values
   * @private
   */
  _initializeEnums() {
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
  }

  /**
   * Initialize predefined schema templates
   * @private
   */
  _initializeTemplates() {
    this.templates = {
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
   * Create a complete itinerary schema with date validation
   * @param {number} maxDays - Maximum number of days
   * @param {Array} validDates - Array of valid date strings (YYYY-MM-DD format)
   * @returns {Object} Itinerary schema configuration
   */
  createItinerarySchema(maxDays = 14, validDates = null) {
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

  /**
   * Get common enums
   * @param {string} enumType - Type of enum to get
   * @returns {Array} Enum values
   */
  getEnum(enumType) {
    return this.enums[enumType] || [];
  }
}

module.exports = AISchemaService;
