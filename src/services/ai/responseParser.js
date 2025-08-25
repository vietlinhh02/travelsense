/**
 * ResponseParser - Handles parsing and processing of AI responses
 * Responsible for: Itinerary parsing, activity extraction, response validation, mock generation
 */
class ResponseParser {
  constructor() {
    // Common activity categories for classification
    this.activityCategories = {
      cultural: ['temple', 'shrine', 'museum', 'palace', 'cathedral', 'monument', 'heritage'],
      food: ['restaurant', 'market', 'food', 'cuisine', 'meal', 'dining', 'cafe', 'coffee'],
      shopping: ['shop', 'market', 'mall', 'boutique', 'souvenir', 'store'],
      nature: ['park', 'garden', 'river', 'mountain', 'beach', 'forest', 'nature'],
      technology: ['tower', 'observatory', 'digital', 'tech', 'innovation'],
      leisure: ['free time', 'exploration', 'relax', 'entertainment']
    };
  }

  /**
   * Main method to process itinerary response (JSON only)
   * @param {string} content - AI response content (JSON)
   * @param {Object} trip - Trip object
   * @returns {Object} Processed itinerary
   */
  processItineraryResponse(content, trip) {
    // Parse as JSON (structured output)
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      throw new Error('Invalid JSON response from AI');
    }

    const parsedItinerary = this._parseJSONItineraryResponse(jsonData, trip);
    if (!parsedItinerary || !parsedItinerary.days || parsedItinerary.days.length === 0) {
      throw new Error('Empty or invalid itinerary data');
    }

    console.log('Successfully parsed JSON itinerary response');
    return parsedItinerary;
  }



  /**
   * Process chunked itinerary response for long trips (JSON only)
   * @param {string} content - AI response content (JSON)
   * @param {Object} trip - Trip object (chunk-specific)
   * @param {Object} chunk - Chunk configuration
   * @returns {Object} Processed chunk itinerary
   */
  processChunkedItineraryResponse(content, trip, chunk) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      throw new Error(`Invalid JSON response for chunk ${chunk.id}`);
    }

    const parsedItinerary = this._parseJSONItineraryResponse(jsonData, trip);
    if (!parsedItinerary || !parsedItinerary.days || parsedItinerary.days.length === 0) {
      throw new Error(`Empty itinerary for chunk ${chunk.id}`);
    }

    console.log(`Successfully parsed chunked JSON response for ${chunk.id}`);
    return parsedItinerary;
  }









  /**
   * Process validation response (JSON only)
   * @param {string} content - AI response content (JSON)
   * @returns {Object} Validation results
   */
  processValidationResponse(content) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
    return {
      valid: true,
      violations: [],
      warnings: [],
        suggestions: ['Unable to parse validation response']
      };
    }

    // Return the parsed validation data
    return {
      valid: jsonData.valid !== false,
      violations: jsonData.violations || [],
      warnings: jsonData.warnings || [],
      suggestions: jsonData.suggestions || []
    };
  }

  /**
   * Process suggestion response (JSON only)
   * @param {string} content - AI response content (JSON)
   * @returns {Array} Activity suggestions
   */
  processSuggestionResponse(content) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      return [
        {
          title: 'Unable to parse suggestions',
          description: 'Please try again',
          category: 'general',
          duration: 60,
          estimatedCost: 0,
          location: 'TBD',
          tags: ['error']
        }
      ];
    }

    // Return the parsed suggestions array
    if (Array.isArray(jsonData)) {
      return jsonData;
    }

    // If it's an object with suggestions property
    if (jsonData.suggestions && Array.isArray(jsonData.suggestions)) {
      return jsonData.suggestions;
    }

    // Fallback
    return [
      {
        title: jsonData.title || 'AI-suggested Activity',
        description: jsonData.description || 'Based on your preferences',
        category: jsonData.category || 'general',
        duration: jsonData.duration || 120,
        estimatedCost: jsonData.cost || jsonData.estimatedCost || 0,
        location: jsonData.location || 'City Center',
        tags: jsonData.tags || ['ai-generated']
      }
    ];
  }

  /**
   * Process optimization response (JSON only)
   * @param {string} content - AI response content (JSON)
   * @param {Object} trip - Trip object
   * @returns {Object} Processed itinerary
   */
  processOptimizationResponse(content, trip) {
    const jsonData = this._tryParseJSON(content);
    if (!jsonData) {
      throw new Error('Invalid JSON response for optimization');
    }

    const parsedItinerary = this._parseJSONItineraryResponse(jsonData, trip);
    if (!parsedItinerary || !parsedItinerary.days || parsedItinerary.days.length === 0) {
      throw new Error('Empty or invalid optimized itinerary');
    }

    console.log('Successfully parsed optimization JSON response');
    return parsedItinerary;
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

    try {
      // Try to extract JSON from markdown code blocks first
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
      const jsonString = jsonMatch ? jsonMatch[1] : content;

      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON from response:', error.message);
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
          description: activity.notes,
        location: {
            name: activity.venue,
            address: activity.address,
          coordinates: this._generateCoordinates(trip.destination.destination)
        },
          duration: this._estimateActivityDuration(activity.notes),
          cost: this._estimateActivityCost(activity.notes, trip),
          category: activity.category,
          notes: 'Generated by Gemini AI'
        }))
      };
    });

    return { days: processedDays };
  }

  /**
   * Validate itinerary against preferences and constraints
   * @param {Object} itinerary - Itinerary to validate
   * @param {Object} prefs - User preferences
   * @returns {Object} Validation result with issues
   */
  validateItinerary(itinerary, prefs = {}) {
    const issues = [];

    if (!itinerary || !itinerary.days || itinerary.days.length === 0) {
      issues.push({ type: 'empty', message: 'Itinerary has no days' });
      return { ok: false, issues };
    }

    itinerary.days.forEach((day, dayIndex) => {
      if (!day.activities || day.activities.length === 0) {
        issues.push({ type: 'empty_day', message: `Day ${dayIndex + 1} has no activities` });
      }

      day.activities.forEach((activity, activityIndex) => {
        // Check venue and address
        if (!activity.location?.name || this._isGenericLocationName(activity.location.name)) {
          issues.push({
            type: 'generic_venue',
            message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} has generic venue name`,
            day: dayIndex,
            activity: activityIndex
          });
        }

        // Check time within preferences
        if (prefs.dayStart && activity.time < prefs.dayStart) {
          issues.push({
            type: 'early_activity',
            message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} starts before preferred day start`,
            day: dayIndex,
            activity: activityIndex
          });
        }

        if (prefs.dayEnd && activity.time > prefs.dayEnd) {
          issues.push({
            type: 'late_activity',
            message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} starts after preferred day end`,
            day: dayIndex,
            activity: activityIndex
          });
        }

        // Check nightlife preference
        if (prefs.nightlife === 'none' && activity.category === 'nightlife') {
          issues.push({
            type: 'nightlife_preference',
            message: `Nightlife activity found but user prefers no nightlife`,
            day: dayIndex,
            activity: activityIndex
          });
        }

        if (prefs.nightlife === 'heavy' && !this._hasNightlifeActivity(day)) {
          issues.push({
            type: 'missing_nightlife',
            message: `Day ${dayIndex + 1} missing nightlife activity despite heavy preference`,
            day: dayIndex
          });
        }
      });
    });

    return { ok: issues.length === 0, issues };
  }

  /**
   * Check if day has nightlife activity
   * @param {Object} day - Day object
   * @returns {boolean} True if has nightlife
   */
  _hasNightlifeActivity(day) {
    return day.activities.some(activity =>
      activity.category === 'nightlife' ||
      activity.time >= '21:00' ||
      activity.title.toLowerCase().includes('night') ||
      activity.title.toLowerCase().includes('bar') ||
      activity.title.toLowerCase().includes('club')
    );
  }

  /**
   * Generate auto-repair prompt for itinerary issues
   * @param {Array} issues - Array of validation issues
   * @param {Object} originalItinerary - Original itinerary
   * @param {Object} prefs - User preferences
   * @returns {string} Repair prompt
   */
  autoRepairPrompt(issues, originalItinerary, prefs = {}) {
    let prompt = `Fix the following issues in this itinerary:\n\n`;

    prompt += `Original itinerary:\n${JSON.stringify(originalItinerary, null, 2)}\n\n`;

    prompt += `Issues to fix:\n`;
    issues.forEach((issue, index) => {
      prompt += `${index + 1}. ${issue.message}\n`;
    });

    prompt += `\nUser preferences:\n${JSON.stringify(prefs, null, 2)}\n\n`;

    prompt += `Please provide a corrected itinerary in the same JSON format, addressing all the issues above.`;

    return prompt;
  }

  /**
   * Clean location name by removing common prefixes and suffixes
   * @param {string} location - Raw location string
   * @returns {string} Cleaned location name
   */
  _cleanLocationName(location) {
    if (!location) return location;
    
    return location
      .replace(/^(the|a|an)\s+/i, '') // Remove articles
      .replace(/\s+(area|district|neighborhood|zone)$/i, '') // Remove generic suffixes
      .replace(/\s+(in|at|near)\s+.*/i, '') // Remove location descriptions
      .trim();
  }

  /**
   * Check if location name is too generic to be useful for API searches
   * @param {string} location - Location name to check
   * @returns {boolean} True if location is generic
   */
  _isGenericLocationName(location) {
    if (!location || location.length < 3) return true;
    
    const genericTerms = [
      'this', 'that', 'the', 'a', 'an',
      'iconic', 'famous', 'popular', 'renowned', 'well-known',
      'landmark', 'attraction', 'site', 'place', 'spot', 'venue',
      'temple', 'museum', 'market', 'restaurant', 'shop', 'mall',
      'park', 'garden', 'beach', 'mountain', 'river', 'lake',
      'unknown', 'various', 'local', 'nearby', 'area', 'vicinity',
      'around', 'general', 'different', 'several', 'multiple'
    ];
    
    const locationLower = location.toLowerCase();
    
    // Check if location is just a generic term
    if (genericTerms.includes(locationLower)) return true;
    
    // Check if location starts with generic phrases
    const genericPhrases = [
      'this iconic', 'this famous', 'this popular', 'this renowned',
      'the iconic', 'the famous', 'the popular', 'the renowned',
      'a famous', 'a popular', 'an iconic', 'a renowned',
      'famous landmark', 'iconic landmark', 'popular attraction',
      'well-known', 'renowned', 'historic site'
    ];
    
    for (const phrase of genericPhrases) {
      if (locationLower.startsWith(phrase)) return true;
    }
    
    return false;
  }
}

module.exports = ResponseParser;