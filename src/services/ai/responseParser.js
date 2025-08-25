/**
 * ResponseParser - Simplified parser for fallback and validation
 * Now mainly used for: Validation, fallback parsing, and complex itinerary processing
 *
 * NOTE: Most parsing is now handled by Gemini's structured output directly
 */
class ResponseParser {
  constructor() {
    // Minimal categories for fallback
    this.activityCategories = {
      cultural: ['temple', 'museum', 'palace'],
      food: ['restaurant', 'food', 'cafe'],
      nature: ['park', 'mountain', 'beach'],
      shopping: ['shop', 'mall'],
      leisure: ['relax', 'entertainment']
    };
  }

  /**
   * Fallback method for itinerary parsing (when structured output fails)
   * @param {string} content - AI response content (JSON)
   * @param {Object} trip - Trip object
   * @returns {Object} Processed itinerary
   */
  processItineraryResponse(content, trip) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      throw new Error('Invalid JSON response from AI');
    }

    // For structured output, return as-is if it's already in correct format
    if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].date) {
      return { days: jsonData };
    }

    const parsedItinerary = this._parseJSONItineraryResponse(jsonData, trip);
    if (!parsedItinerary || !parsedItinerary.days || parsedItinerary.days.length === 0) {
      throw new Error('Empty or invalid itinerary data');
    }

    console.log('Successfully parsed fallback itinerary response');
    return parsedItinerary;
  }



  /**
   * Process chunked itinerary response (simplified for long trips)
   * @param {string} content - AI response content (JSON)
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @returns {Object} Processed chunk itinerary
   */
  processChunkedItineraryResponse(content, trip, chunk) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      throw new Error(`Invalid JSON response for chunk ${chunk.id}`);
    }

    // Return as-is if already in correct format
    if (jsonData.days) return jsonData;

    console.log(`Successfully parsed chunk ${chunk.id} (fallback)`);
    return this._parseJSONItineraryResponse(jsonData, trip);
  }









  /**
   * Process validation response (simplified)
   * @param {string} content - AI response content (JSON)
   * @returns {Object} Validation results
   */
  processValidationResponse(content) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
    return {
      valid: true,
      violations: [],
        warnings: ['Unable to parse validation response'],
        suggestions: []
      };
    }

    return {
      valid: jsonData.valid !== false,
      violations: jsonData.violations || [],
      warnings: jsonData.warnings || [],
      suggestions: jsonData.suggestions || []
    };
  }

  /**
   * Process suggestion response (simplified)
   * @param {string} content - AI response content (JSON)
   * @returns {Array} Activity suggestions
   */
  processSuggestionResponse(content) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      return [{
          title: 'Unable to parse suggestions',
          description: 'Please try again',
          category: 'general',
          duration: 60,
          estimatedCost: 0,
          location: 'TBD',
          tags: ['error']
      }];
    }

    // Return as-is if already in correct format
    if (Array.isArray(jsonData)) return jsonData;
    if (jsonData.suggestions && Array.isArray(jsonData.suggestions)) {
      return jsonData.suggestions;
    }

    return [jsonData]; // Single suggestion
  }

  /**
   * Process optimization response (simplified)
   * @param {string} content - AI response content (JSON)
   * @param {Object} trip - Trip object
   * @returns {Object} Processed itinerary
   */
  processOptimizationResponse(content, trip) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      throw new Error('Invalid JSON response for optimization');
    }

    // Return as-is if already in correct format
    if (jsonData.days) return jsonData;

    return this._parseJSONItineraryResponse(jsonData, trip);
  }



  /**
   * Generate coordinates based on destination
   * @param {string} destination - Destination name
   * @returns {Object} Coordinates object
   */
  _generateCoordinates(destination) {
    const coords = {
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'saigon': { lat: 10.7769, lng: 106.7009 },
      'ho chi minh': { lat: 10.7769, lng: 106.7009 },
      'vietnam': { lat: 10.7769, lng: 106.7009 }
    };
    
    const destLower = destination.toLowerCase();
    for (const [key, value] of Object.entries(coords)) {
      if (destLower.includes(key)) {
        return { 
          lat: value.lat + (Math.random() - 0.5) * 0.01, 
          lng: value.lng + (Math.random() - 0.5) * 0.01 
        };
      }
    }
    
    return { lat: 0, lng: 0 };
  }

  /**
   * Try to parse JSON content from response
   * @param {string} content - Response content
   * @returns {Object|null} Parsed JSON or null if parsing fails
   */
  _tryParseJSON(content) {
    if (!content || typeof content !== 'string') return null;

    // Check for common error messages that AI might return
    const errorMessages = [
      'No content generated',
      'Unable to generate',
      'Error',
      'Failed to',
      'Cannot generate'
    ];

    const lowerContent = content.toLowerCase();
    if (errorMessages.some(msg => lowerContent.includes(msg.toLowerCase()))) {
      console.warn('AI returned error message instead of JSON:', content);
      return null;
    }

    try {
      // Try to extract JSON from markdown code blocks first
      let jsonString = content.trim();

      // Check for markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
      }

      // Find the start and end of JSON array/object
      const startIndex = jsonString.indexOf('[');
      const endIndex = jsonString.lastIndexOf(']');

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Extract just the JSON part
        const cleanJsonString = jsonString.substring(startIndex, endIndex + 1);
        return JSON.parse(cleanJsonString);
      }

      // Fallback: try to parse the entire string
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON from response:', error.message);
      console.warn('Content preview:', content.substring(0, 100) + '...');
      return null;
    }
  }

  /**
   * Parse JSON itinerary response
   * @param {Object} jsonData - Parsed JSON data
   * @param {Object} trip - Trip object
   * @returns {Object} Parsed itinerary
   */
  _parseJSONItineraryResponse(jsonData, trip) {
    if (!Array.isArray(jsonData)) {
      throw new Error('JSON itinerary response is not an array');
    }

    const processedDays = jsonData.map(day => {
      return {
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
          duration: activity.duration || 120, // Default 2 hours
          cost: activity.cost || 0, // Default free
          category: activity.category,
          notes: 'Generated by Gemini AI'
        }))
      };
    });

    return { days: processedDays };
  }

  /**
   * Simple itinerary validation with date checking
   * @param {Object} itinerary - Itinerary to validate
   * @param {Object} trip - Trip object for date validation
   * @param {Object} prefs - User preferences
   * @returns {Object} Validation result
   */
  validateItinerary(itinerary, trip = null, prefs = {}) {
    if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
      return { ok: false, issues: [{ type: 'empty', message: 'No itinerary data' }] };
    }

    const issues = [];
    const expectedDates = [];

    // Calculate expected dates if trip is provided
    if (trip && trip.destination && trip.destination.startDate && trip.duration) {
      const startDate = new Date(trip.destination.startDate);
      for (let i = 0; i < trip.duration; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        expectedDates.push(date.toISOString().split('T')[0]);
      }
    }

    itinerary.forEach((day, dayIndex) => {
      // Check date format and validity
      if (!day.date) {
        issues.push({ type: 'missing_date', message: `Day ${dayIndex + 1} missing date` });
      } else {
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(day.date)) {
          issues.push({ type: 'invalid_date_format', message: `Day ${dayIndex + 1} has invalid date format: ${day.date}` });
        }

        // Check if date is in expected range
        if (expectedDates.length > 0 && !expectedDates.includes(day.date)) {
          issues.push({
            type: 'date_out_of_range',
            message: `Day ${dayIndex + 1} date ${day.date} not in trip range: ${expectedDates.join(', ')}`
          });
        }

        // Check if date is not in the past (only for trips starting in future)
        if (trip && trip.destination && trip.destination.startDate) {
          const tripStartDate = new Date(trip.destination.startDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Only check past date for trips starting more than 30 days in future
          const thirtyDaysFromNow = new Date(today);
          thirtyDaysFromNow.setDate(today.getDate() + 30);

          if (tripStartDate > thirtyDaysFromNow) {
            const dayDate = new Date(day.date);
            if (dayDate < today) {
          issues.push({
                type: 'past_date',
                message: `Day ${dayIndex + 1} date ${day.date} is in the past but trip starts ${tripStartDate.toISOString().split('T')[0]}`
              });
            }
          }
        }
      }

      // Check activities
      if (!day.activities || !Array.isArray(day.activities) || day.activities.length === 0) {
        issues.push({ type: 'empty_day', message: `Day ${dayIndex + 1} has no activities` });
      } else {
        day.activities.forEach((activity, activityIndex) => {
          if (!activity.title || !activity.location || !activity.category) {
          issues.push({
              type: 'incomplete_activity',
              message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} missing required fields`
          });
        }
      });
      }
    });

    return { ok: issues.length === 0, issues };
  }

  /**
   * Process structured output response (JSON format)
   * @param {string} content - AI response content
   * @param {Object} schema - Schema definition used for the request
   * @returns {Object} Parsed structured response
   */
  processStructuredOutput(content, schema = null) {
    const parsedData = this._tryParseJSON(content);
    if (!parsedData) {
      throw new Error('Invalid structured output response from AI');
    }

    // Basic validation if schema is provided
    if (schema) {
      const validation = this.validateStructuredResponse(parsedData, schema);
      if (!validation.valid) {
        console.warn('Structured response validation warnings:', validation.warnings);
      }
    }

    console.log('Successfully parsed structured output response');
    return parsedData;
  }

  /**
   * Process enum response
   * @param {string} content - AI response content (enum value)
   * @param {Array} allowedValues - Array of allowed enum values
   * @returns {string} Validated enum value
   */
  processEnumResponse(content, allowedValues = null) {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid enum response: content must be a string');
    }

    const enumValue = content.trim();

    // Validate against allowed values if provided
    if (allowedValues && Array.isArray(allowedValues)) {
      if (!allowedValues.includes(enumValue)) {
        console.warn(`Enum value '${enumValue}' not in allowed values: ${allowedValues.join(', ')}`);
        // Return the closest match or the first allowed value
        return allowedValues[0];
      }
    }

    console.log(`Successfully processed enum response: ${enumValue}`);
    return enumValue;
  }

  /**
   * Validate structured response against schema
   * @param {any} data - Parsed response data
   * @param {Object} schema - Schema definition
   * @returns {Object} Validation result
   */
  validateStructuredResponse(data, schema) {
    const warnings = [];

    if (!schema) {
      return { valid: true, warnings: [] };
    }

    // Basic type validation
    switch (schema.type) {
      case 'STRING':
        if (typeof data !== 'string') {
          warnings.push(`Expected string, got ${typeof data}`);
        }
        // Check enum if specified
        if (schema.enum && !schema.enum.includes(data)) {
          warnings.push(`Value '${data}' not in enum: ${schema.enum.join(', ')}`);
        }
        break;

      case 'INTEGER':
        if (!Number.isInteger(data)) {
          warnings.push(`Expected integer, got ${typeof data}`);
        }
        if (schema.minimum !== undefined && data < schema.minimum) {
          warnings.push(`Value ${data} below minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && data > schema.maximum) {
          warnings.push(`Value ${data} above maximum ${schema.maximum}`);
        }
        break;

      case 'NUMBER':
        if (typeof data !== 'number') {
          warnings.push(`Expected number, got ${typeof data}`);
        }
        if (schema.minimum !== undefined && data < schema.minimum) {
          warnings.push(`Value ${data} below minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && data > schema.maximum) {
          warnings.push(`Value ${data} above maximum ${schema.maximum}`);
        }
        break;

      case 'BOOLEAN':
        if (typeof data !== 'boolean') {
          warnings.push(`Expected boolean, got ${typeof data}`);
        }
        break;

      case 'ARRAY':
        if (!Array.isArray(data)) {
          warnings.push(`Expected array, got ${typeof data}`);
        } else {
          if (schema.minItems !== undefined && data.length < schema.minItems) {
            warnings.push(`Array length ${data.length} below minimum ${schema.minItems}`);
          }
          if (schema.maxItems !== undefined && data.length > schema.maxItems) {
            warnings.push(`Array length ${data.length} above maximum ${schema.maxItems}`);
          }
          // Validate array items if schema provided
          if (schema.items && data.length > 0) {
            data.forEach((item, index) => {
              const itemValidation = this.validateStructuredResponse(item, schema.items);
              if (!itemValidation.valid) {
                warnings.push(`Item ${index}: ${itemValidation.warnings.join(', ')}`);
              }
            });
          }
        }
        break;

      case 'OBJECT':
        if (typeof data !== 'object' || data === null) {
          warnings.push(`Expected object, got ${typeof data}`);
        } else {
          // Check required properties
          if (schema.required) {
            schema.required.forEach(prop => {
              if (!(prop in data)) {
                warnings.push(`Missing required property: ${prop}`);
              }
            });
          }
          // Validate property types
          if (schema.properties) {
            Object.entries(schema.properties).forEach(([prop, propSchema]) => {
              if (prop in data) {
                const propValidation = this.validateStructuredResponse(data[prop], propSchema);
                if (!propValidation.valid) {
                  warnings.push(`Property ${prop}: ${propValidation.warnings.join(', ')}`);
                }
              }
            });
          }
        }
        break;
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }

  /**
   * Extract and validate structured data from response content
   * @param {string} content - Raw response content
   * @param {string} responseType - Type of structured response ('json' or 'enum')
   * @param {Object} schema - Schema definition for validation
   * @returns {any} Processed and validated response
   */
  extractStructuredData(content, responseType = 'json', schema = null) {
    try {
      switch (responseType) {
        case 'json':
        case 'application/json':
          return this.processStructuredOutput(content, schema);

        case 'enum':
        case 'text/x.enum':
          const allowedValues = schema?.enum || null;
          return this.processEnumResponse(content, allowedValues);

        default:
          console.warn(`Unknown response type: ${responseType}, treating as JSON`);
          return this.processStructuredOutput(content, schema);
      }
    } catch (error) {
      console.error(`Error processing ${responseType} response:`, error.message);
      throw error;
    }
  }

    // Removed complex utility methods - simplified for structured output
}

module.exports = ResponseParser;