const POICache = require('../../models/poi/poiCache.model');
const POIExtractor = require('./poiExtractor.service');
const FoursquareClient = require('./foursquareClient.service');
const TripAdvisorClient = require('./tripadvisorClient.service');

/**
 * POI Cache Service
 * Main service for POI enrichment that handles cache lookup, API calls, data merging, and cache updates
 */
class POICacheService {
  constructor() {
    this.poiExtractor = new POIExtractor();
    this.foursquareClient = new FoursquareClient();
    this.tripAdvisorClient = new TripAdvisorClient();
    
    // Configuration
    this.config = {
      cacheExpiryDays: 30,
      maxApiRetries: 2,
      apiTimeoutMs: 15000,
      maxParallelRequests: 5,
      enableMockFallback: true
    };
  }

  /**
   * Enrich POI data for a list of activities from an itinerary
   * @param {Array} activities - Array of activity objects from AI-generated itinerary
   * @param {Object} tripContext - Trip context for better extraction
   * @returns {Promise<Array>} Array of enriched activities
   */
  async enrichActivities(activities, tripContext = {}) {
    console.log(`🌟 Starting POI enrichment for ${activities.length} activities`);
    
    try {
      // Step 1: Extract POIs from activities
      const extractedPOIs = await this.poiExtractor.extractPOIsFromItinerary(activities, tripContext);
      console.log(`🔍 Extracted ${extractedPOIs.length} POIs from activities`);

      // Step 2: Enrich each POI with external data
      const enrichedPOIs = await this._enrichPOIsBatch(extractedPOIs);

      // Step 3: Map enriched data back to activities
      const enrichedActivities = await this._mapEnrichedDataToActivities(activities, enrichedPOIs);

      console.log(`✅ POI enrichment completed: ${enrichedPOIs.length} POIs enriched`);
      return enrichedActivities;

    } catch (error) {
      console.error('❌ POI enrichment failed:', error.message);
      
      // Return original activities if enrichment fails
      return activities.map(activity => ({
        ...activity,
        enrichment_status: 'failed',
        enrichment_error: error.message
      }));
    }
  }

  /**
   * Get enriched POI data for a single place
   * @param {Object} poiQuery - POI query object
   * @param {string} poiQuery.name - Place name
   * @param {string} poiQuery.city - City name
   * @param {string} poiQuery.country - Country name
   * @param {string} poiQuery.category - POI category (optional)
   * @returns {Promise<Object>} Enriched POI data
   */
  async getEnrichedPOI(poiQuery) {
    console.log(`🔍 Getting enriched POI: ${poiQuery.name} in ${poiQuery.city}, ${poiQuery.country}`);

    try {
      // Step 1: Check cache first
      const cachedPOI = await this._getCachedPOI(poiQuery);
      if (cachedPOI && !cachedPOI.isExpired()) {
        console.log(`✅ Cache hit for ${poiQuery.name}`);
        await cachedPOI.recordHit();
        return cachedPOI.getEnrichedData();
      }

      // Step 2: Fetch from APIs if cache miss or expired
      console.log(`🌐 Cache miss for ${poiQuery.name}, fetching from APIs`);
      const enrichedData = await this._fetchAndMergePOIData(poiQuery);

      // Step 3: Update cache
      await this._updatePOICache(poiQuery, enrichedData);

      return enrichedData.enriched;

    } catch (error) {
      console.error(`❌ Failed to get enriched POI for ${poiQuery.name}:`, error.message);
      
      // Return basic POI structure on error
      return this._createBasicPOI(poiQuery);
    }
  }

  /**
   * Enrich multiple POIs in parallel batches
   * @param {Array} poiQueries - Array of POI query objects
   * @returns {Promise<Array>} Array of enriched POI data
   */
  async _enrichPOIsBatch(poiQueries) {
    const results = [];
    const batchSize = this.config.maxParallelRequests;

    for (let i = 0; i < poiQueries.length; i += batchSize) {
      const batch = poiQueries.slice(i, i + batchSize);
      console.log(`🔄 Processing POI batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(poiQueries.length / batchSize)}`);

      const batchPromises = batch.map(poiQuery => 
        this.getEnrichedPOI(poiQuery).catch(error => {
          console.error(`⚠️ Failed to enrich POI ${poiQuery.name}:`, error.message);
          return this._createBasicPOI(poiQuery);
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < poiQueries.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Check cache for existing POI data
   * @param {Object} poiQuery - POI query object
   * @returns {Promise<POICache|null>} Cached POI or null
   */
  async _getCachedPOI(poiQuery) {
    try {
      return await POICache.findByQuery(poiQuery);
    } catch (error) {
      console.error('❌ Cache lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch POI data from APIs and merge results
   * @param {Object} poiQuery - POI query object
   * @returns {Promise<Object>} Merged POI data
   */
  async _fetchAndMergePOIData(poiQuery) {
    const searchParams = {
      query: poiQuery.name,
      near: `${poiQuery.city}, ${poiQuery.country}`,
      category: poiQuery.category
    };

    console.log(`🌐 Fetching data from APIs for: ${poiQuery.name}`);

    // Fetch from both APIs in parallel
    const [foursquareResult, tripAdvisorResult] = await Promise.allSettled([
      this._fetchFromFoursquare(searchParams),
      this._fetchFromTripAdvisor(searchParams)
    ]);

    const foursquareData = foursquareResult.status === 'fulfilled' ? foursquareResult.value : null;
    const tripAdvisorData = tripAdvisorResult.status === 'fulfilled' ? tripAdvisorResult.value : null;

    // Merge the data
    const mergedData = this._mergeAPIData(poiQuery, foursquareData, tripAdvisorData);

    return {
      placeId: POICache.generatePlaceId(poiQuery),
      query: poiQuery,
      foursquare: foursquareData,
      tripadvisor: tripAdvisorData,
      enriched: mergedData,
      cache: {
        foursquare_fetched: !!foursquareData,
        tripadvisor_fetched: !!tripAdvisorData,
        fetch_errors: this._collectFetchErrors(foursquareResult, tripAdvisorResult)
      }
    };
  }

  /**
   * Fetch data from Foursquare API
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object|null>} Foursquare data or null
   */
  async _fetchFromFoursquare(searchParams) {
    try {
      const searchResult = await this.foursquareClient.searchPlaces(searchParams);
      
      if (searchResult.results && searchResult.results.length > 0) {
        const topResult = searchResult.results[0];
        
        // Get detailed information for the top result
        const detailsResult = await this.foursquareClient.getPlaceDetails(topResult.fsq_id);
        
        return {
          search_result: searchResult,
          details: detailsResult,
          source: searchResult.source
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Foursquare fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Fetch data from TripAdvisor API
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object|null>} TripAdvisor data or null
   */
  async _fetchFromTripAdvisor(searchParams) {
    try {
      const searchResult = await this.tripAdvisorClient.searchLocations(searchParams);
      
      if (searchResult.results && searchResult.results.length > 0) {
        const topResult = searchResult.results[0];
        
        // Get additional data for the top result
        const [detailsResult, reviewsResult] = await Promise.allSettled([
          this.tripAdvisorClient.getLocationDetails(topResult.location_id),
          this.tripAdvisorClient.getLocationReviews(topResult.location_id, 5)
        ]);

        return {
          search_result: searchResult,
          details: detailsResult.status === 'fulfilled' ? detailsResult.value : null,
          reviews: reviewsResult.status === 'fulfilled' ? reviewsResult.value : null,
          source: searchResult.source
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ TripAdvisor fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Merge data from Foursquare and TripAdvisor APIs
   * @param {Object} originalQuery - Original POI query
   * @param {Object} foursquareData - Data from Foursquare
   * @param {Object} tripAdvisorData - Data from TripAdvisor
   * @returns {Object} Merged POI data
   */
  _mergeAPIData(originalQuery, foursquareData, tripAdvisorData) {
    const merged = {
      name: originalQuery.name,
      description: null,
      coordinates: null,
      address: null,
      contact: null,
      rating: {},
      categories: [],
      price_level: null,
      hours: null,
      photos: [],
      verified: false
    };

    // Merge name (prefer original, fallback to API data)
    if (foursquareData?.details?.name) {
      merged.name = foursquareData.details.name;
    } else if (tripAdvisorData?.details?.name) {
      merged.name = tripAdvisorData.details.name;
    }

    // Merge description (prefer TripAdvisor)
    if (tripAdvisorData?.details?.description) {
      merged.description = tripAdvisorData.details.description;
    }

    // Merge coordinates (prefer Foursquare)
    if (foursquareData?.details?.coordinates) {
      merged.coordinates = {
        latitude: foursquareData.details.coordinates.latitude,
        longitude: foursquareData.details.coordinates.longitude
      };
    } else if (tripAdvisorData?.details?.latitude && tripAdvisorData?.details?.longitude) {
      merged.coordinates = {
        latitude: parseFloat(tripAdvisorData.details.latitude),
        longitude: parseFloat(tripAdvisorData.details.longitude)
      };
    }

    // Merge address (prefer Foursquare for standardization)
    if (foursquareData?.details?.location) {
      const loc = foursquareData.details.location;
      merged.address = {
        formatted: loc.formatted_address || loc.address,
        street: loc.address,
        city: loc.locality,
        state: loc.region,
        country: loc.country,
        postalcode: loc.postcode
      };
    } else if (tripAdvisorData?.details?.address_obj) {
      const addr = tripAdvisorData.details.address_obj;
      merged.address = {
        formatted: addr.address_string,
        street: addr.street1,
        city: addr.city,
        state: addr.state,
        country: addr.country,
        postalcode: addr.postalcode
      };
    }

    // Merge contact information
    merged.contact = {};
    if (foursquareData?.details?.tel) merged.contact.phone = foursquareData.details.tel;
    if (foursquareData?.details?.website) merged.contact.website = foursquareData.details.website;
    if (foursquareData?.details?.email) merged.contact.email = foursquareData.details.email;
    if (tripAdvisorData?.details?.web_url) merged.contact.tripadvisor_url = tripAdvisorData.details.web_url;

    // Merge ratings
    if (foursquareData?.details?.rating) {
      merged.rating.foursquare = foursquareData.details.rating;
    }
    if (tripAdvisorData?.details?.rating) {
      merged.rating.tripadvisor = parseFloat(tripAdvisorData.details.rating);
      merged.rating.total_reviews = tripAdvisorData.details.num_reviews || 0;
    }
    
    // Calculate average rating
    const ratings = [merged.rating.foursquare, merged.rating.tripadvisor].filter(r => r);
    if (ratings.length > 0) {
      merged.rating.average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }

    // Merge categories (prefer Foursquare)
    if (foursquareData?.details?.categories) {
      merged.categories = foursquareData.details.categories.map(cat => cat.name);
    } else if (tripAdvisorData?.details?.category) {
      merged.categories = [tripAdvisorData.details.category.name];
    }

    // Merge price level (prefer Foursquare)
    if (foursquareData?.details?.price) {
      merged.price_level = foursquareData.details.price;
    } else if (tripAdvisorData?.details?.price_level) {
      merged.price_level = this._convertTripAdvisorPriceLevel(tripAdvisorData.details.price_level);
    }

    // Merge hours (prefer Foursquare)
    if (foursquareData?.details?.hours) {
      merged.hours = {
        open_now: foursquareData.details.hours.open_now,
        formatted: foursquareData.details.hours.display,
        timezone: foursquareData.details.timezone
      };
    } else if (tripAdvisorData?.details?.hours) {
      merged.hours = {
        open_now: null, // TripAdvisor doesn't provide this
        formatted: 'See TripAdvisor for hours',
        timezone: tripAdvisorData.details.hours.timezone
      };
    }

    // Merge photos
    if (foursquareData?.details?.photos) {
      merged.photos.push(...foursquareData.details.photos.map(photo => ({
        url: `${photo.prefix}original${photo.suffix}`,
        source: 'foursquare',
        width: photo.width,
        height: photo.height
      })));
    }
    if (tripAdvisorData?.details?.photo?.images?.large) {
      merged.photos.push({
        url: tripAdvisorData.details.photo.images.large.url,
        source: 'tripadvisor',
        width: parseInt(tripAdvisorData.details.photo.images.large.width),
        height: parseInt(tripAdvisorData.details.photo.images.large.height)
      });
    }

    // Merge verification status
    merged.verified = foursquareData?.details?.verified || false;

    return merged;
  }

  /**
   * Update POI cache with new data
   * @param {Object} poiQuery - Original POI query
   * @param {Object} enrichedData - Enriched POI data
   * @returns {Promise<POICache>} Updated cache entry
   */
  async _updatePOICache(poiQuery, enrichedData) {
    try {
      const placeId = enrichedData.placeId;
      
      const updateData = {
        placeId: placeId,
        query: enrichedData.query,
        foursquare: enrichedData.foursquare,
        tripadvisor: enrichedData.tripadvisor,
        enriched: enrichedData.enriched,
        cache: {
          ...enrichedData.cache,
          created_at: new Date(),
          updated_at: new Date(),
          expires_at: new Date(Date.now() + this.config.cacheExpiryDays * 24 * 60 * 60 * 1000),
          hit_count: 0,
          last_accessed: new Date()
        }
      };

      const result = await POICache.findOneAndUpdate(
        { placeId: placeId },
        updateData,
        { upsert: true, new: true }
      );

      console.log(`💾 Updated cache for ${poiQuery.name}`);
      return result;

    } catch (error) {
      console.error('❌ Failed to update POI cache:', error.message);
      throw error;
    }
  }

  /**
   * Map enriched POI data back to original activities
   * @param {Array} originalActivities - Original activity array
   * @param {Array} enrichedPOIs - Array of enriched POI data
   * @returns {Promise<Array>} Activities with enriched POI data
   */
  async _mapEnrichedDataToActivities(originalActivities, enrichedPOIs) {
    return originalActivities.map(activity => {
      // Find matching enriched POI data for this activity
      const matchingPOI = enrichedPOIs.find(poi => {
        // Simple matching based on activity title/description containing POI name
        const activityText = `${activity.title} ${activity.description || ''}`.toLowerCase();
        const poiName = poi.name.toLowerCase();
        return activityText.includes(poiName) || poiName.includes(activityText);
      });

      if (matchingPOI) {
        return {
          ...activity,
          location: {
            ...activity.location,
            coordinates: matchingPOI.coordinates,
            address: matchingPOI.address,
            contact: matchingPOI.contact
          },
          poi_data: {
            rating: matchingPOI.rating,
            categories: matchingPOI.categories,
            price_level: matchingPOI.price_level,
            hours: matchingPOI.hours,
            photos: matchingPOI.photos,
            description: matchingPOI.description,
            verified: matchingPOI.verified
          },
          enrichment_status: 'success'
        };
      }

      return {
        ...activity,
        enrichment_status: 'no_match'
      };
    });
  }

  /**
   * Create basic POI structure when enrichment fails
   * @param {Object} poiQuery - POI query object
   * @returns {Object} Basic POI structure
   */
  _createBasicPOI(poiQuery) {
    return {
      name: poiQuery.name,
      description: null,
      coordinates: null,
      address: {
        formatted: `${poiQuery.city}, ${poiQuery.country}`,
        city: poiQuery.city,
        country: poiQuery.country
      },
      contact: {},
      rating: {},
      categories: poiQuery.category ? [poiQuery.category] : [],
      price_level: null,
      hours: null,
      photos: [],
      verified: false,
      enrichment_status: 'basic_fallback'
    };
  }

  /**
   * Collect fetch errors from API results
   * @param {Object} foursquareResult - Foursquare API result
   * @param {Object} tripAdvisorResult - TripAdvisor API result
   * @returns {Array} Array of error objects
   */
  _collectFetchErrors(foursquareResult, tripAdvisorResult) {
    const errors = [];
    
    if (foursquareResult.status === 'rejected') {
      errors.push({
        source: 'foursquare',
        error: foursquareResult.reason?.message || 'Unknown error',
        timestamp: new Date()
      });
    }
    
    if (tripAdvisorResult.status === 'rejected') {
      errors.push({
        source: 'tripadvisor',
        error: tripAdvisorResult.reason?.message || 'Unknown error',
        timestamp: new Date()
      });
    }
    
    return errors;
  }

  /**
   * Convert TripAdvisor price level to numeric scale
   * @param {string} priceLevel - TripAdvisor price level (e.g., "$", "$$")
   * @returns {number} Numeric price level (1-4)
   */
  _convertTripAdvisorPriceLevel(priceLevel) {
    if (!priceLevel) return null;
    
    const levelMap = {
      '$': 1,
      '$$': 2,
      '$$$': 3,
      '$$$$': 4
    };
    
    return levelMap[priceLevel] || null;
  }

  /**
   * Get service statistics and configuration
   * @returns {Object} Service stats
   */
  getServiceStats() {
    return {
      config: this.config,
      foursquareStats: this.foursquareClient.getUsageStats(),
      tripAdvisorStats: this.tripAdvisorClient.getUsageStats(),
      extractorStats: this.poiExtractor.getServiceStats()
    };
  }

  /**
   * Update service configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ POI Cache Service configuration updated:', newConfig);
  }

  /**
   * Clean up expired cache entries
   * @param {number} daysOld - Remove entries older than this many days
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupExpiredCache(daysOld = 90) {
    try {
      const result = await POICache.cleanupExpired(daysOld);
      console.log(`🧹 Cleaned up ${result.deletedCount} expired POI cache entries`);
      return result;
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error.message);
      throw error;
    }
  }
}

module.exports = POICacheService;