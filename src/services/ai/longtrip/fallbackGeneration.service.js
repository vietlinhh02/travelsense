/**
 * FallbackGenerationService - Handles fallback itinerary generation
 * Focuses on generating backup itineraries when AI generation fails
 */
class FallbackGenerationService {
  constructor() {
    // Fallback activity templates
    this.activityTemplates = {
      arrival_orientation: [
        { 
          type: 'orientation', 
          title: 'City Orientation Walk', 
          description: 'Get familiar with the city center and main landmarks',
          duration: 180,
          category: 'sightseeing'
        },
        { 
          type: 'logistics', 
          title: 'Hotel Check-in & Local Information', 
          description: 'Check into accommodation and gather local information',
          duration: 120,
          category: 'logistics'
        }
      ],
      cultural_immersion: [
        { 
          type: 'cultural', 
          title: 'Local Museum Visit', 
          description: 'Explore the main cultural museum of the area',
          duration: 240,
          category: 'cultural'
        },
        { 
          type: 'cultural', 
          title: 'Traditional Market Exploration', 
          description: 'Visit local market and experience daily life',
          duration: 180,
          category: 'cultural'
        }
      ],
      food_discovery: [
        { 
          type: 'food', 
          title: 'Local Restaurant Experience', 
          description: 'Try authentic local cuisine at a recommended restaurant',
          duration: 120,
          category: 'food'
        },
        { 
          type: 'food', 
          title: 'Street Food Tour', 
          description: 'Sample various local street foods and snacks',
          duration: 180,
          category: 'food'
        }
      ],
      nature_exploration: [
        { 
          type: 'nature', 
          title: 'City Park Visit', 
          description: 'Relax and explore the main city park or green space',
          duration: 180,
          category: 'nature'
        },
        { 
          type: 'nature', 
          title: 'Outdoor Walking Tour', 
          description: 'Explore natural areas around the city',
          duration: 240,
          category: 'nature'
        }
      ],
      historical_sites: [
        { 
          type: 'historical', 
          title: 'Historical Landmark Visit', 
          description: 'Visit the most significant historical site in the area',
          duration: 240,
          category: 'historical'
        },
        { 
          type: 'historical', 
          title: 'Heritage Walk', 
          description: 'Walking tour of historical buildings and sites',
          duration: 180,
          category: 'historical'
        }
      ],
      entertainment_leisure: [
        { 
          type: 'leisure', 
          title: 'Local Entertainment Venue', 
          description: 'Visit a popular local entertainment or leisure spot',
          duration: 180,
          category: 'entertainment'
        },
        { 
          type: 'leisure', 
          title: 'Shopping District Exploration', 
          description: 'Browse local shops and shopping areas',
          duration: 240,
          category: 'leisure'
        }
      ],
      nightlife_entertainment: [
        { 
          type: 'nightlife', 
          title: 'Local Bar/Lounge Visit', 
          description: 'Experience local nightlife at a recommended venue',
          duration: 180,
          category: 'nightlife'
        },
        { 
          type: 'nightlife', 
          title: 'Evening Entertainment', 
          description: 'Enjoy evening entertainment options in the city',
          duration: 240,
          category: 'nightlife'
        }
      ],
      departure_logistics: [
        { 
          type: 'logistics', 
          title: 'Departure Preparation', 
          description: 'Pack belongings and prepare for departure',
          duration: 120,
          category: 'logistics'
        },
        { 
          type: 'logistics', 
          title: 'Final Local Experience', 
          description: 'Last-minute local activity before departure',
          duration: 180,
          category: 'leisure'
        }
      ]
    };

    // Default coordinates for common destinations
    this.defaultCoordinates = {
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'saigon': { lat: 10.7769, lng: 106.7009 },
      'ho chi minh': { lat: 10.7769, lng: 106.7009 },
      'vietnam': { lat: 10.7769, lng: 106.7009 },
      'paris': { lat: 48.8566, lng: 2.3522 },
      'london': { lat: 51.5074, lng: -0.1278 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'bangkok': { lat: 13.7563, lng: 100.5018 },
      'singapore': { lat: 1.3521, lng: 103.8198 }
    };
  }

  /**
   * Generate fallback days when AI generation fails
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @returns {Array} Fallback days
   */
  generateFallbackDays(trip, chunk) {
    const days = [];
    const chunkingService = require('./tripChunking.service');
    const chunker = new chunkingService();
    const startDate = chunker.calculateChunkStartDate(trip.destination.startDate, chunk.startDay);
    
    for (let i = 0; i < (chunk.endDay - chunk.startDay + 1); i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      
      const dayActivities = this._generateDayActivities(trip, chunk, i);
      
      days.push({
        date: dayDate,
        activities: dayActivities,
        fallbackGenerated: true,
        chunkId: chunk.id,
        notes: `Fallback activities generated for ${chunk.focus}`
      });
    }
    
    return days;
  }

  /**
   * Generate activities for a specific day
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @param {number} dayIndex - Day index within chunk
   * @returns {Array} Array of activities
   */
  _generateDayActivities(trip, chunk, dayIndex) {
    const activities = [];
    const templates = this.activityTemplates[chunk.focus] || this.activityTemplates.cultural_immersion;
    
    // Determine number of activities based on detail level
    const activityCounts = {
      comprehensive: 4,
      balanced: 3,
      simplified: 2
    };
    
    const targetActivities = activityCounts[chunk.detailLevel] || 3;
    
    // Generate activities for the day
    for (let i = 0; i < targetActivities; i++) {
      const template = templates[i % templates.length];
      const activity = this._createActivityFromTemplate(template, trip, chunk, dayIndex, i);
      activities.push(activity);
    }

    return activities;
  }

  /**
   * Create activity from template
   * @param {Object} template - Activity template
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @param {number} dayIndex - Day index
   * @param {number} activityIndex - Activity index
   * @returns {Object} Generated activity
   */
  _createActivityFromTemplate(template, trip, chunk, dayIndex, activityIndex) {
    const baseTime = 9; // Start at 9 AM
    const timeSlot = baseTime + (activityIndex * 3); // 3 hours between activities
    
    return {
      time: `${timeSlot.toString().padStart(2, '0')}:00`,
      title: `${template.title} - Day ${chunk.startDay + dayIndex}`,
      description: `${template.description} in ${trip.destination.city || trip.destination.destination}`,
      location: {
        name: this._generateLocationName(template.type, trip.destination),
        address: `${trip.destination.city || trip.destination.destination}`,
        coordinates: this._generateCoordinates(trip.destination.destination || trip.destination.city)
      },
      duration: template.duration || 180, // Default 3 hours
      cost: this._estimateActivityCost(template.type, trip.destination),
      category: template.category || 'leisure',
      notes: `Fallback activity for ${chunk.focus} - ${template.type}`,
      fallbackGenerated: true,
      difficulty: 'easy',
      accessibility: 'good'
    };
  }

  /**
   * Generate location name based on activity type
   * @param {string} activityType - Type of activity
   * @param {Object} destination - Destination object
   * @returns {string} Generated location name
   */
  _generateLocationName(activityType, destination) {
    const city = destination.city || destination.destination;
    
    const locationPatterns = {
      orientation: `${city} City Center`,
      logistics: `${city} Information Center`,
      cultural: `${city} Cultural Center`,
      food: `Local Restaurant in ${city}`,
      nature: `${city} Public Park`,
      historical: `${city} Historical District`,
      leisure: `${city} Entertainment Area`,
      nightlife: `${city} Night District`
    };

    return locationPatterns[activityType] || `Local Area in ${city}`;
  }

  /**
   * Generate coordinates for location
   * @param {string} destination - Destination name
   * @returns {Object} Coordinates with slight randomization
   */
  _generateCoordinates(destination) {
    if (!destination) return { lat: 0, lng: 0 };
    
    const destLower = destination.toLowerCase();
    
    // Find matching coordinates
    for (const [key, coords] of Object.entries(this.defaultCoordinates)) {
      if (destLower.includes(key)) {
        return { 
          lat: coords.lat + (Math.random() - 0.5) * 0.01, // Small randomization
          lng: coords.lng + (Math.random() - 0.5) * 0.01 
        };
      }
    }
    
    // Default fallback coordinates (somewhere safe)
    return { lat: 0, lng: 0 };
  }

  /**
   * Estimate activity cost based on type and destination
   * @param {string} activityType - Type of activity
   * @param {Object} destination - Destination object
   * @returns {number} Estimated cost in local currency
   */
  _estimateActivityCost(activityType, destination) {
    const destLower = (destination.city || destination.destination || '').toLowerCase();
    
    // Base cost multipliers by destination type
    let baseMultiplier = 1.0;
    if (destLower.includes('tokyo') || destLower.includes('singapore')) {
      baseMultiplier = 2.0; // Expensive cities
    } else if (destLower.includes('vietnam') || destLower.includes('thailand')) {
      baseMultiplier = 0.3; // Cheaper destinations
    }
    
    // Cost by activity type (base cost in USD, will be converted)
    const baseCosts = {
      orientation: 0,      // Free walking
      logistics: 5,       // Information, tips
      cultural: 15,       // Museum entry
      food: 25,           // Meal cost
      nature: 5,          // Park entry
      historical: 12,     // Site entry
      leisure: 20,        // Entertainment
      nightlife: 30       // Drinks, venues
    };
    
    const baseCost = baseCosts[activityType] || 15;
    const adjustedCost = baseCost * baseMultiplier;
    
    // Convert to VND if Vietnamese destination
    if (destLower.includes('vietnam') || destLower.includes('saigon') || destLower.includes('ho chi minh')) {
      return Math.round(adjustedCost * 23000); // USD to VND conversion
    }
    
    return Math.round(adjustedCost);
  }

  /**
   * Generate emergency fallback itinerary for entire trip
   * @param {Object} trip - Trip object
   * @returns {Object} Complete fallback itinerary
   */
  generateEmergencyFallback(trip) {
    const days = [];
    
    for (let i = 0; i < trip.duration; i++) {
      const dayDate = new Date(trip.destination.startDate);
      dayDate.setDate(dayDate.getDate() + i);
      
      // Create a simple chunk for this day
      const simpleChunk = {
        id: `emergency_day_${i + 1}`,
        startDay: i + 1,
        endDay: i + 1,
        focus: this._determineEmergencyFocus(i, trip.duration),
        detailLevel: 'simplified'
      };
      
      const dayActivities = this._generateDayActivities(trip, simpleChunk, 0);
      
      days.push({
        date: dayDate,
        activities: dayActivities,
        emergencyFallback: true,
        notes: `Emergency fallback day ${i + 1}`
      });
    }
    
    return { days };
  }

  /**
   * Determine focus for emergency fallback days
   * @param {number} dayIndex - Day index (0-based)
   * @param {number} totalDays - Total trip duration
   * @returns {string} Focus for the day
   */
  _determineEmergencyFocus(dayIndex, totalDays) {
    // Simple rotation of focuses
    const focuses = [
      'arrival_orientation',
      'cultural_immersion', 
      'food_discovery',
      'historical_sites',
      'nature_exploration',
      'entertainment_leisure'
    ];
    
    // First day is always arrival
    if (dayIndex === 0) return 'arrival_orientation';
    
    // Last day is departure if more than 1 day
    if (dayIndex === totalDays - 1 && totalDays > 1) return 'departure_logistics';
    
    // Use rotation for middle days
    return focuses[(dayIndex - 1) % focuses.length];
  }

  /**
   * Add new activity template
   * @param {string} focus - Focus category
   * @param {Object} template - Activity template
   */
  addActivityTemplate(focus, template) {
    if (!this.activityTemplates[focus]) {
      this.activityTemplates[focus] = [];
    }
    this.activityTemplates[focus].push(template);
  }

  /**
   * Add new destination coordinates
   * @param {string} destination - Destination name (lowercase)
   * @param {Object} coordinates - Lat/lng coordinates
   */
  addDestinationCoordinates(destination, coordinates) {
    this.defaultCoordinates[destination.toLowerCase()] = coordinates;
  }

  /**
   * Get available activity templates
   * @returns {Object} All activity templates
   */
  getActivityTemplates() {
    return { ...this.activityTemplates };
  }

  /**
   * Get available destination coordinates
   * @returns {Object} All destination coordinates
   */
  getDestinationCoordinates() {
    return { ...this.defaultCoordinates };
  }
}

module.exports = FallbackGenerationService;
