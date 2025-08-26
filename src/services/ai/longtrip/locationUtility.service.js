/**
 * LocationUtilityService - Handles location-related operations and utilities
 * Focuses on coordinate calculations, address formatting, and location validation
 */
class LocationUtilityService {
  constructor() {
    // Common destinations and their coordinates
    this.destinationDatabase = {
      'vietnam': {
        'ho chi minh city': { lat: 10.7769, lng: 106.7009, timezone: 'Asia/Ho_Chi_Minh' },
        'saigon': { lat: 10.7769, lng: 106.7009, timezone: 'Asia/Ho_Chi_Minh' },
        'hanoi': { lat: 21.0285, lng: 105.8542, timezone: 'Asia/Ho_Chi_Minh' },
        'da nang': { lat: 16.0678, lng: 108.2208, timezone: 'Asia/Ho_Chi_Minh' },
        'nha trang': { lat: 12.2585, lng: 109.0526, timezone: 'Asia/Ho_Chi_Minh' },
        'hue': { lat: 16.4637, lng: 107.5909, timezone: 'Asia/Ho_Chi_Minh' },
        'can tho': { lat: 10.0452, lng: 105.7469, timezone: 'Asia/Ho_Chi_Minh' },
        'vung tau': { lat: 10.4113, lng: 107.1365, timezone: 'Asia/Ho_Chi_Minh' },
        'dalat': { lat: 11.9404, lng: 108.4583, timezone: 'Asia/Ho_Chi_Minh' },
        'phu quoc': { lat: 10.2899, lng: 103.9840, timezone: 'Asia/Ho_Chi_Minh' }
      },
      'japan': {
        'tokyo': { lat: 35.6762, lng: 139.6503, timezone: 'Asia/Tokyo' },
        'kyoto': { lat: 35.0116, lng: 135.7681, timezone: 'Asia/Tokyo' },
        'osaka': { lat: 34.6937, lng: 135.5023, timezone: 'Asia/Tokyo' },
        'hiroshima': { lat: 34.3853, lng: 132.4553, timezone: 'Asia/Tokyo' },
        'nara': { lat: 34.6851, lng: 135.8048, timezone: 'Asia/Tokyo' }
      },
      'thailand': {
        'bangkok': { lat: 13.7563, lng: 100.5018, timezone: 'Asia/Bangkok' },
        'chiang mai': { lat: 18.7883, lng: 98.9853, timezone: 'Asia/Bangkok' },
        'phuket': { lat: 7.8804, lng: 98.3923, timezone: 'Asia/Bangkok' },
        'pattaya': { lat: 12.9236, lng: 100.8825, timezone: 'Asia/Bangkok' }
      },
      'singapore': {
        'singapore': { lat: 1.3521, lng: 103.8198, timezone: 'Asia/Singapore' }
      },
      'europe': {
        'paris': { lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' },
        'london': { lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
        'rome': { lat: 41.9028, lng: 12.4964, timezone: 'Europe/Rome' },
        'barcelona': { lat: 41.3851, lng: 2.1734, timezone: 'Europe/Madrid' },
        'amsterdam': { lat: 52.3676, lng: 4.9041, timezone: 'Europe/Amsterdam' }
      },
      'usa': {
        'new york': { lat: 40.7128, lng: -74.0060, timezone: 'America/New_York' },
        'los angeles': { lat: 34.0522, lng: -118.2437, timezone: 'America/Los_Angeles' },
        'san francisco': { lat: 37.7749, lng: -122.4194, timezone: 'America/Los_Angeles' },
        'chicago': { lat: 41.8781, lng: -87.6298, timezone: 'America/Chicago' }
      }
    };

    // Distance calculation constants
    this.EARTH_RADIUS_KM = 6371;
    this.KM_TO_MILES = 0.621371;
  }

  /**
   * Find destination coordinates by name
   * @param {string} destination - Destination name
   * @returns {Object|null} Coordinates and timezone info
   */
  findDestinationCoordinates(destination) {
    if (!destination) return null;

    const destLower = destination.toLowerCase().trim();
    
    // Search through all regions
    for (const region of Object.values(this.destinationDatabase)) {
      for (const [cityName, coords] of Object.entries(region)) {
        if (destLower.includes(cityName) || cityName.includes(destLower)) {
          return {
            ...coords,
            city: cityName,
            found: true
          };
        }
      }
    }

    // Fallback search for partial matches
    for (const region of Object.values(this.destinationDatabase)) {
      for (const [cityName, coords] of Object.entries(region)) {
        const words = destLower.split(/\s+/);
        const cityWords = cityName.split(/\s+/);
        
        const hasMatch = words.some(word => 
          cityWords.some(cityWord => 
            cityWord.includes(word) || word.includes(cityWord)
          )
        );
        
        if (hasMatch) {
          return {
            ...coords,
            city: cityName,
            found: true,
            partialMatch: true
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {Object} coord1 - First coordinate {lat, lng}
   * @param {Object} coord2 - Second coordinate {lat, lng}
   * @param {string} unit - Distance unit ('km' or 'miles')
   * @returns {number} Distance in specified unit
   */
  calculateDistance(coord1, coord2, unit = 'km') {
    if (!coord1 || !coord2 || 
        typeof coord1.lat !== 'number' || typeof coord1.lng !== 'number' ||
        typeof coord2.lat !== 'number' || typeof coord2.lng !== 'number') {
      return 0;
    }

    const toRadians = (degrees) => degrees * (Math.PI / 180);
    
    const lat1Rad = toRadians(coord1.lat);
    const lat2Rad = toRadians(coord2.lat);
    const deltaLatRad = toRadians(coord2.lat - coord1.lat);
    const deltaLngRad = toRadians(coord2.lng - coord1.lng);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = this.EARTH_RADIUS_KM * c;

    return unit === 'miles' ? distanceKm * this.KM_TO_MILES : distanceKm;
  }

  /**
   * Estimate travel time between coordinates
   * @param {Object} coord1 - Start coordinate {lat, lng}
   * @param {Object} coord2 - End coordinate {lat, lng}
   * @param {string} method - Travel method ('walking', 'driving', 'public')
   * @returns {number} Estimated travel time in minutes
   */
  estimateTravelTime(coord1, coord2, method = 'walking') {
    const distance = this.calculateDistance(coord1, coord2, 'km');
    
    if (distance === 0) return 0;

    // Average speeds by travel method (km/h)
    const speeds = {
      walking: 5,
      driving: 30,    // City driving with traffic
      public: 20,     // Public transport with stops
      bicycle: 15
    };

    const speed = speeds[method] || speeds.walking;
    const timeHours = distance / speed;
    const timeMinutes = Math.ceil(timeHours * 60);

    // Minimum time thresholds
    const minimumTimes = {
      walking: 5,
      driving: 10,
      public: 15,
      bicycle: 8
    };

    return Math.max(timeMinutes, minimumTimes[method] || 5);
  }

  /**
   * Generate random coordinates near a center point
   * @param {Object} center - Center coordinate {lat, lng}
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Object} Random coordinate within radius
   */
  generateNearbyCoordinates(center, radiusKm = 5) {
    if (!center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
      return { lat: 0, lng: 0 };
    }

    // Convert radius to degrees (approximately)
    const radiusLat = radiusKm / 111; // ~111 km per degree latitude
    const radiusLng = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));

    // Generate random angle and distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * Math.min(radiusLat, radiusLng);

    return {
      lat: center.lat + (distance * Math.cos(angle)),
      lng: center.lng + (distance * Math.sin(angle))
    };
  }

  /**
   * Format address string for display
   * @param {Object} location - Location object
   * @returns {string} Formatted address
   */
  formatAddress(location) {
    if (!location) return 'Location not specified';

    const parts = [];
    
    if (location.name) parts.push(location.name);
    if (location.address) parts.push(location.address);
    if (location.city && !parts.join(' ').includes(location.city)) {
      parts.push(location.city);
    }
    if (location.country && !parts.join(' ').includes(location.country)) {
      parts.push(location.country);
    }

    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  }

  /**
   * Validate coordinates
   * @param {Object} coordinates - Coordinates to validate {lat, lng}
   * @returns {Object} Validation result
   */
  validateCoordinates(coordinates) {
    if (!coordinates || typeof coordinates !== 'object') {
      return { 
        valid: false, 
        error: 'Coordinates object is required' 
      };
    }

    const { lat, lng } = coordinates;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return { 
        valid: false, 
        error: 'Latitude and longitude must be numbers' 
      };
    }

    if (lat < -90 || lat > 90) {
      return { 
        valid: false, 
        error: 'Latitude must be between -90 and 90 degrees' 
      };
    }

    if (lng < -180 || lng > 180) {
      return { 
        valid: false, 
        error: 'Longitude must be between -180 and 180 degrees' 
      };
    }

    return { valid: true };
  }

  /**
   * Find closest city to coordinates
   * @param {Object} coordinates - Target coordinates {lat, lng}
   * @returns {Object|null} Closest city information
   */
  findClosestCity(coordinates) {
    if (!this.validateCoordinates(coordinates).valid) {
      return null;
    }

    let closestCity = null;
    let minDistance = Infinity;

    for (const region of Object.values(this.destinationDatabase)) {
      for (const [cityName, cityCoords] of Object.entries(region)) {
        const distance = this.calculateDistance(coordinates, cityCoords);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestCity = {
            name: cityName,
            coordinates: cityCoords,
            distance: distance
          };
        }
      }
    }

    return closestCity;
  }

  /**
   * Get timezone for coordinates
   * @param {Object} coordinates - Coordinates {lat, lng}
   * @returns {string} Timezone string
   */
  getTimezone(coordinates) {
    const closestCity = this.findClosestCity(coordinates);
    
    if (closestCity && closestCity.coordinates.timezone) {
      return closestCity.coordinates.timezone;
    }

    // Fallback timezone estimation based on longitude
    const lng = coordinates.lng;
    
    if (lng >= 100 && lng <= 120) return 'Asia/Ho_Chi_Minh';
    if (lng >= 135 && lng <= 145) return 'Asia/Tokyo';
    if (lng >= -10 && lng <= 30) return 'Europe/Paris';
    if (lng >= -130 && lng <= -60) return 'America/New_York';
    
    return 'UTC';
  }

  /**
   * Check if coordinates are in a specific region
   * @param {Object} coordinates - Coordinates to check
   * @param {string} regionName - Region name
   * @returns {boolean} Whether coordinates are in region
   */
  isInRegion(coordinates, regionName) {
    if (!this.validateCoordinates(coordinates).valid) {
      return false;
    }

    const region = this.destinationDatabase[regionName.toLowerCase()];
    if (!region) return false;

    // Find if any city in the region is within reasonable distance
    for (const cityCoords of Object.values(region)) {
      const distance = this.calculateDistance(coordinates, cityCoords);
      if (distance <= 200) { // Within 200km of any city in the region
        return true;
      }
    }

    return false;
  }

  /**
   * Get all cities in a region
   * @param {string} regionName - Region name
   * @returns {Array} Array of cities with coordinates
   */
  getCitiesInRegion(regionName) {
    const region = this.destinationDatabase[regionName.toLowerCase()];
    if (!region) return [];

    return Object.entries(region).map(([cityName, coords]) => ({
      name: cityName,
      ...coords
    }));
  }

  /**
   * Add new destination to database
   * @param {string} region - Region name
   * @param {string} cityName - City name
   * @param {Object} coordinates - City coordinates and info
   */
  addDestination(region, cityName, coordinates) {
    if (!this.destinationDatabase[region.toLowerCase()]) {
      this.destinationDatabase[region.toLowerCase()] = {};
    }
    
    this.destinationDatabase[region.toLowerCase()][cityName.toLowerCase()] = coordinates;
  }

  /**
   * Get all available destinations
   * @returns {Object} All destinations by region
   */
  getAllDestinations() {
    return { ...this.destinationDatabase };
  }
}

module.exports = LocationUtilityService;
