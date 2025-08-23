/**
 * POI Extractor Service - Extracts Point of Interest data from AI-generated itineraries
 * Uses rule-based extraction combined with AI hints to identify POIs
 */
class POIExtractorService {
  constructor() {
    // POI type patterns for classification
    this.poiPatterns = {
      cultural: [
        /temple|shrine|pagoda|cathedral|church|mosque|monastery/i,
        /museum|gallery|cultural center|heritage|historic/i,
        /palace|castle|fort|citadel|imperial/i,
        /memorial|monument|statue|tomb/i,
        /ancient|archaeological|ruins/i
      ],
      food: [
        /restaurant|cafe|coffee|dining|eatery|bistro/i,
        /market|food court|street food|vendor/i,
        /bar|pub|brewery|winery/i,
        /cooking class|food tour/i
      ],
      nature: [
        /park|garden|botanical|zoo|safari/i,
        /beach|lake|river|waterfall|hot spring/i,
        /mountain|hill|volcano|cave|canyon/i,
        /forest|jungle|nature reserve|national park/i
      ],
      shopping: [
        /mall|shopping center|market|bazaar/i,
        /boutique|store|shop|outlet/i,
        /souvenir|handicraft|artisan/i
      ],
      entertainment: [
        /theater|cinema|show|performance|concert/i,
        /amusement park|theme park|water park/i,
        /nightclub|disco|karaoke|entertainment/i,
        /sports|stadium|arena|gym/i
      ],
      accommodation: [
        /hotel|resort|hostel|guesthouse|lodge/i,
        /apartment|airbnb|homestay|villa/i
      ],
      transportation: [
        /airport|station|terminal|port/i,
        /taxi|bus|train|metro|subway/i,
        /car rental|transport|transfer/i
      ],
      logistics: [
        /check-in|check-out|arrival|departure/i,
        /luggage|baggage|storage/i,
        /visa|immigration|customs/i,
        /rest|free time|leisure|break/i
      ]
    };

    // Location indicators
    this.locationIndicators = [
      /at\s+([^,\.\n]+)/i,
      /visit\s+([^,\.\n]+)/i,
      /explore\s+([^,\.\n]+)/i,
      /go\s+to\s+([^,\.\n]+)/i,
      /tour\s+([^,\.\n]+)/i,
      /see\s+([^,\.\n]+)/i,
      /experience\s+([^,\.\n]+)/i
    ];

    // Common non-POI words to filter out
    this.excludeWords = [
      'local', 'area', 'vicinity', 'nearby', 'around', 'general',
      'traditional', 'authentic', 'popular', 'famous', 'best',
      'recommended', 'suggested', 'optional', 'various', 'different'
    ];

    // Configuration
    this.confidenceThreshold = 0.5;
  }

  /**
   * Extract POIs from itinerary activities
   * @param {Array} activities - Array of activity objects
   * @param {Object} tripContext - Trip context with destination info
   * @returns {Promise<Array>} Array of extracted POI objects
   */
  async extractPOIsFromItinerary(activities, tripContext) {
    const extractedPOIs = [];
    const seenPlaces = new Set(); // Avoid duplicates

    for (const activity of activities) {
      try {
        const pois = await this.extractPOIsFromActivity(activity, tripContext);
        
        for (const poi of pois) {
          const placeKey = `${poi.name}-${poi.city}-${poi.country}`.toLowerCase();
          if (!seenPlaces.has(placeKey)) {
            seenPlaces.add(placeKey);
            extractedPOIs.push(poi);
          }
        }
      } catch (error) {
        console.error('Error extracting POI from activity:', error);
        // Continue processing other activities
      }
    }

    return extractedPOIs;
  }

  /**
   * Extract POIs from a single activity
   * @param {Object} activity - Activity object
   * @param {Object} tripContext - Trip context
   * @returns {Promise<Array>} Array of POI objects
   */
  async extractPOIsFromActivity(activity, tripContext) {
    const pois = [];

    // Extract from title
    const titlePOIs = this.extractFromText(
      activity.title,
      tripContext,
      activity.category || 'unknown'
    );
    pois.push(...titlePOIs);

    // Extract from description
    const descriptionPOIs = this.extractFromText(
      activity.description,
      tripContext,
      activity.category || 'unknown'
    );
    pois.push(...descriptionPOIs);

    // Extract from location if it's a specific place
    if (activity.location && activity.location.name && 
        !this.isGenericLocation(activity.location.name)) {
      const locationPOI = this.createPOIFromLocation(activity.location, tripContext, activity.category);
      if (locationPOI) {
        pois.push(locationPOI);
      }
    }

    return this.deduplicatePOIs(pois);
  }

  /**
   * Extract POI information from text using rule-based approach
   * @param {string} text - Text to extract from
   * @param {Object} tripContext - Trip context
   * @param {string} activityCategory - Category hint from activity
   * @returns {Array} Array of POI objects
   */
  extractFromText(text, tripContext, activityCategory) {
    const pois = [];
    
    // Try each location indicator pattern
    for (const pattern of this.locationIndicators) {
      const matches = text.match(pattern);
      if (matches && matches[1]) {
        const placeName = this.cleanPlaceName(matches[1]);
        if (placeName && !this.isGenericLocation(placeName)) {
          const poi = this.createPOI(placeName, tripContext, activityCategory);
          if (poi) {
            pois.push(poi);
          }
        }
      }
    }

    // Extract capitalized place names (proper nouns)
    const properNouns = this.extractProperNouns(text);
    for (const noun of properNouns) {
      if (!this.isGenericLocation(noun)) {
        const poi = this.createPOI(noun, tripContext, activityCategory);
        if (poi) {
          pois.push(poi);
        }
      }
    }

    return pois;
  }

  /**
   * Create POI object from extracted information
   * @param {string} placeName - Name of the place
   * @param {Object} tripContext - Trip context
   * @param {string} activityCategory - Activity category hint
   * @returns {Object|null} POI object or null if invalid
   */
  createPOI(placeName, tripContext, activityCategory) {
    const cleanName = this.cleanPlaceName(placeName);
    if (!cleanName || cleanName.length < 3) {
      return null;
    }

    // Determine POI category
    const category = this.classifyPOI(cleanName, activityCategory);

    return {
      type: 'poi',
      name: cleanName,
      city: tripContext.destination?.city || tripContext.destination?.destination || 'Unknown',
      country: tripContext.destination?.country || this.extractCountryFromDestination(tripContext.destination?.destination) || 'Unknown',
      category: category,
      confidence: this.calculateConfidence(cleanName, category, activityCategory),
      extractedFrom: 'text',
      originalText: placeName
    };
  }

  /**
   * Create POI from location object
   * @param {Object} location - Location object from activity
   * @param {Object} tripContext - Trip context
   * @param {string} activityCategory - Activity category
   * @returns {Object|null} POI object
   */
  createPOIFromLocation(location, tripContext, activityCategory) {
    const placeName = this.cleanPlaceName(location.name);
    if (!placeName || this.isGenericLocation(placeName)) {
      return null;
    }

    const category = this.classifyPOI(placeName, activityCategory);

    return {
      type: 'poi',
      name: placeName,
      city: tripContext.destination?.city || tripContext.destination?.destination || 'Unknown',
      country: tripContext.destination?.country || this.extractCountryFromDestination(tripContext.destination?.destination) || 'Unknown',
      category: category,
      confidence: this.calculateConfidence(placeName, category, activityCategory),
      extractedFrom: 'location',
      originalLocation: location,
      coordinates: location.coordinates
    };
  }

  /**
   * Classify POI into category based on name and context
   * @param {string} placeName - Name of the place
   * @param {string} activityCategory - Activity category hint
   * @returns {string} POI category
   */
  classifyPOI(placeName, activityCategory) {
    const nameLower = placeName.toLowerCase();

    // Check if activity category matches POI patterns
    if (activityCategory && this.poiPatterns[activityCategory]) {
      for (const pattern of this.poiPatterns[activityCategory]) {
        if (pattern.test(nameLower)) {
          return activityCategory;
        }
      }
    }

    // Check all patterns to find best match
    for (const [category, patterns] of Object.entries(this.poiPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(nameLower)) {
          return category;
        }
      }
    }

    // Default to cultural if no match found
    return 'cultural';
  }

  /**
   * Clean and normalize place name
   * @param {string} placeName - Raw place name
   * @returns {string} Cleaned place name
   */
  cleanPlaceName(placeName) {
    if (!placeName || typeof placeName !== 'string') {
      return '';
    }

    return placeName
      .trim()
      .replace(/^(the|a|an)\s+/i, '') // Remove articles
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[()[\]{}]/g, '') // Remove brackets
      .replace(/^\W+|\W+$/g, '') // Remove leading/trailing punctuation
      .trim();
  }

  /**
   * Check if location name is too generic to be useful
   * @param {string} locationName - Location name to check
   * @returns {boolean} True if generic
   */
  isGenericLocation(locationName) {
    if (!locationName || typeof locationName !== 'string') {
      return true;
    }

    const nameLower = locationName.toLowerCase().trim();
    
    // Check against exclude words
    for (const word of this.excludeWords) {
      if (nameLower.includes(word)) {
        return true;
      }
    }

    // Check for generic patterns
    const genericPatterns = [
      /^(local|nearby|around|general)\s+/i,
      /\b(area|vicinity|region|district)\b/i,
      /^(city|town|village)\s+(center|centre)$/i,
      /^(free\s+time|leisure|rest|break)$/i,
      /^(various|different|multiple)\s+/i
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(nameLower)) {
        return true;
      }
    }

    // Too short or too long
    if (nameLower.length < 3 || nameLower.length > 100) {
      return true;
    }

    return false;
  }

  /**
   * Extract proper nouns (capitalized words) from text
   * @param {string} text - Text to extract from
   * @returns {Array} Array of proper nouns
   */
  extractProperNouns(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Match sequences of capitalized words
    const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    
    return matches
      .filter(match => match.length > 2)
      .filter(match => !this.isCommonWord(match))
      .map(match => match.trim());
  }

  /**
   * Check if word is a common English word (not a place name)
   * @param {string} word - Word to check
   * @returns {boolean} True if common word
   */
  isCommonWord(word) {
    const commonWords = [
      'Morning', 'Afternoon', 'Evening', 'Night', 'Day', 'Time',
      'Visit', 'Explore', 'Tour', 'Experience', 'Enjoy', 'Discover',
      'Traditional', 'Local', 'Famous', 'Popular', 'Best', 'Great',
      'Beautiful', 'Historic', 'Ancient', 'Modern', 'New', 'Old',
      'Food', 'Meal', 'Lunch', 'Dinner', 'Breakfast', 'Activity'
    ];

    return commonWords.includes(word);
  }

  /**
   * Calculate confidence score for extracted POI
   * @param {string} placeName - Place name
   * @param {string} category - Determined category
   * @param {string} activityCategory - Activity category hint
   * @returns {number} Confidence score 0-1
   */
  calculateConfidence(placeName, category, activityCategory) {
    let confidence = 0.5; // Base confidence

    // Boost confidence for specific patterns
    const nameLower = placeName.toLowerCase();
    
    // Check for location-specific keywords
    if (this.poiPatterns[category]) {
      for (const pattern of this.poiPatterns[category]) {
        if (pattern.test(nameLower)) {
          confidence += 0.2;
          break;
        }
      }
    }

    // Boost if category matches activity category
    if (category === activityCategory) {
      confidence += 0.1;
    }

    // Boost for longer, more specific names
    if (placeName.length > 10) {
      confidence += 0.1;
    }

    // Boost for proper noun patterns
    if (/^[A-Z]/.test(placeName)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Remove duplicate POIs from array
   * @param {Array} pois - Array of POI objects
   * @returns {Array} Deduplicated array
   */
  deduplicatePOIs(pois) {
    const seen = new Map();
    const result = [];

    for (const poi of pois) {
      const key = `${poi.name}-${poi.city}-${poi.country}`.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, poi);
        result.push(poi);
      } else {
        // Keep the one with higher confidence
        const existing = seen.get(key);
        if (poi.confidence > existing.confidence) {
          seen.set(key, poi);
          const index = result.findIndex(p => p.name.toLowerCase() === existing.name.toLowerCase());
          if (index !== -1) {
            result[index] = poi;
          }
        }
      }
    }

    return result;
  }

  /**
   * Extract country from destination string
   * @param {string} destination - Destination string
   * @returns {string|null} Country name or null
   */
  extractCountryFromDestination(destination) {
    if (!destination || typeof destination !== 'string') {
      return null;
    }

    const countryPatterns = {
      'Vietnam': /vietnam|viet nam/i,
      'Japan': /japan|nippon/i,
      'Thailand': /thailand/i,
      'China': /china/i,
      'Korea': /korea/i,
      'Singapore': /singapore/i,
      'Malaysia': /malaysia/i,
      'Indonesia': /indonesia/i,
      'Philippines': /philippines/i,
      'France': /france/i,
      'Italy': /italy/i,
      'Spain': /spain/i,
      'Germany': /germany/i,
      'United Kingdom': /uk|united kingdom|britain|england/i,
      'United States': /usa|united states|america/i
    };

    for (const [country, pattern] of Object.entries(countryPatterns)) {
      if (pattern.test(destination)) {
        return country;
      }
    }

    return null;
  }

  /**
   * Validate extracted POI data
   * @param {Object} poi - POI object to validate
   * @returns {boolean} True if valid
   */
  validatePOI(poi) {
    return !!(
      poi &&
      typeof poi === 'object' &&
      poi.name &&
      typeof poi.name === 'string' &&
      poi.name.length >= 3 &&
      poi.city &&
      typeof poi.city === 'string' &&
      poi.country &&
      typeof poi.country === 'string' &&
      poi.category &&
      typeof poi.category === 'string' &&
      typeof poi.confidence === 'number' &&
      poi.confidence >= 0 &&
      poi.confidence <= 1
    );
  }

  /**
   * Get service statistics and configuration
   * @returns {Object} Service statistics
   */
  getServiceStats() {
    return {
      patterns: Object.keys(this.poiPatterns).reduce((acc, key) => {
        acc[key] = this.poiPatterns[key].length;
        return acc;
      }, {}),
      categoryKeywords: Object.keys(this.poiPatterns),
      confidenceThreshold: this.confidenceThreshold || 0.5,
      locationIndicators: this.locationIndicators.length,
      excludeWords: this.excludeWords.length
    };
  }

  /**
   * Update configuration
   * @param {Object} config - Configuration object
   */
  updateConfig(config) {
    if (config.confidenceThreshold !== undefined) {
      this.confidenceThreshold = config.confidenceThreshold;
    }
    if (config.excludeWords && Array.isArray(config.excludeWords)) {
      this.excludeWords = [...this.excludeWords, ...config.excludeWords];
    }
  }
}

module.exports = POIExtractorService;