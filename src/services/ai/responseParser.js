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
   * Main method to process itinerary response
   * @param {string} content - AI response content
   * @param {Object} trip - Trip object
   * @returns {Object} Processed itinerary
   */
  processItineraryResponse(content, trip) {
    // Try to parse real Gemini API response first
    if (content && !content.includes('[This is a mock response') && !content.includes('Mock Gemini')) {
      try {
        const parsedItinerary = this._parseGeminiItineraryResponse(content, trip);
        if (parsedItinerary && parsedItinerary.days && parsedItinerary.days.length > 0) {
          console.log('✅ Successfully parsed real Gemini API itinerary response');
          return parsedItinerary;
        }
      } catch (error) {
        console.warn('⚠️  Failed to parse Gemini response, falling back to mock generation:', error.message);
      }
    }

    // Fall back to mock/template-based generation
    console.log('🔄 Using template-based itinerary generation as fallback');
    throw new Error('FALLBACK_TO_TEMPLATE_REQUIRED');
  }

  /**
   * Parse real Gemini API itinerary response
   * @param {string} content - Raw Gemini API response
   * @param {Object} trip - Trip object
   * @returns {Object} Parsed itinerary
   */
  _parseGeminiItineraryResponse(content, trip) {
    const days = [];
    const duration = trip.duration;
    const startDate = new Date(trip.destination.startDate);
    
    // Try to extract structured data from Gemini response
    const lines = content.split('\n').filter(line => line.trim());
    let currentDay = null;
    let dayIndex = -1;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Detect day headers (e.g., "Day 1", "Day 2:", "**Day 1**")
      const dayMatch = trimmedLine.match(/\*?\*?\s*Day\s+(\d+)/i);
      if (dayMatch) {
        // Save previous day if exists
        if (currentDay && currentDay.activities.length > 0) {
          days.push(currentDay);
        }
        
        dayIndex = parseInt(dayMatch[1]) - 1;
        if (dayIndex < duration) {
          const dayDate = new Date(startDate);
          dayDate.setDate(dayDate.getDate() + dayIndex);
          
          currentDay = {
            date: dayDate,
            activities: []
          };
        }
        continue;
      }
      
      // Extract activities (look for time patterns)
      if (currentDay) {
        const timeMatch = trimmedLine.match(/(\d{1,2}:\d{2})\s*[-:]?\s*(.+)/i);
        if (timeMatch) {
          const [, time, description] = timeMatch;
          const activity = this.parseActivityFromDescription(time, description.trim(), trip);
          currentDay.activities.push(activity);
        } else if (trimmedLine.match(/^[-\*\u2022]\s+/)) {
          // Handle bullet point activities without explicit times
          const description = trimmedLine.replace(/^[-\*\u2022]\s+/, '').trim();
          if (description) {
            const time = this._generateTimeForActivity(currentDay.activities.length);
            const activity = this.parseActivityFromDescription(time, description, trip);
            currentDay.activities.push(activity);
          }
        }
      }
    }
    
    // Add the last day
    if (currentDay && currentDay.activities.length > 0) {
      days.push(currentDay);
    }
    
    // Ensure we have the right number of days
    while (days.length < duration) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + days.length);
      
      days.push({
        date: dayDate,
        activities: this._generateFallbackActivities(trip)
      });
    }
    
    return { days: days.slice(0, duration) };
  }

  /**
   * Parse individual activity from Gemini description
   * @param {string} time - Activity time
   * @param {string} description - Activity description
   * @param {Object} trip - Trip object
   * @returns {Object} Parsed activity
   */
  parseActivityFromDescription(time, description, trip) {
    // Extract location information if mentioned
    const locationMatch = description.match(/at\s+([^,\.!?]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : trip.destination.destination;
    
    // Estimate duration based on activity type
    const duration = this._estimateActivityDuration(description);
    
    // Estimate cost based on activity type
    const cost = this._estimateActivityCost(description, trip);
    
    // Determine category
    const category = this._categorizeActivity(description);
    
    return {
      time: time,
      title: this._extractActivityTitle(description),
      description: description,
      location: {
        name: location,
        address: `${location}, ${trip.destination.destination}`,
        coordinates: this._generateCoordinates(trip.destination.destination)
      },
      duration: duration,
      cost: cost,
      category: category,
      notes: 'Generated by Gemini AI'
    };
  }

  /**
   * Process optimization response
   * @param {string} content - AI response content
   * @param {Object} trip - Trip object
   * @returns {Object} Optimized schedule
   */
  processOptimizationResponse(content, trip) {
    // For now, return the existing itinerary
    // In a real implementation, this would parse optimization suggestions
    return trip.itinerary;
  }

  /**
   * Process validation response
   * @param {string} content - AI response content
   * @returns {Object} Validation results
   */
  processValidationResponse(content) {
    // Parse validation results from AI response
    // For now, return mock validation results
    return {
      valid: true,
      violations: [],
      warnings: [],
      suggestions: ['Consider adding buffer time between activities']
    };
  }

  /**
   * Process suggestion response
   * @param {string} content - AI response content
   * @returns {Array} Activity suggestions
   */
  processSuggestionResponse(content) {
    // Parse activity suggestions from AI response
    // For now, return mock suggestions
    return [
      {
        title: 'AI-suggested Cultural Activity',
        description: 'Based on your interests and location',
        category: 'cultural',
        duration: 120,
        estimatedCost: 25,
        location: 'City Center',
        tags: ['popular', 'family-friendly']
      }
    ];
  }

  /**
   * Generate mock response when API is unavailable
   * @param {string} model - Model type
   * @param {string} prompt - Original prompt
   * @returns {Promise<Object>} Mock response
   */
  generateMockResponse(model, prompt) {
    let content = '';
    let tokensUsed = 0;

    if (prompt.toLowerCase().includes('itinerary') || prompt.toLowerCase().includes('trip')) {
      content = this._generateItineraryMockResponse(prompt);
      tokensUsed = Math.floor(Math.random() * 1000) + 500;
    } else if (prompt.toLowerCase().includes('chat') || prompt.toLowerCase().includes('suggest')) {
      content = this._generateChatMockResponse(prompt);
      tokensUsed = Math.floor(Math.random() * 500) + 100;
    } else {
      content = `AI Assistant: I understand you're asking about travel planning. Here's my recommendation based on your request: ${prompt.substring(0, 200)}... [This is a mock response - please configure your Gemini API key for real AI responses]`;
      tokensUsed = Math.floor(Math.random() * 300) + 50;
    }

    // Add small delay to simulate network call
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          content: content,
          tokensUsed: tokensUsed,
          model: `mock-${model}`,
          finishReason: 'STOP'
        });
      }, Math.random() * 1000 + 500); // 500-1500ms delay
    });
  }

  /**
   * Helper methods for parsing
   */
  _generateTimeForActivity(activityIndex) {
    const times = ['09:00', '11:30', '14:00', '16:30', '18:30'];
    return times[activityIndex] || '09:00';
  }

  _extractActivityTitle(description) {
    // Extract the main activity from description
    const sentences = description.split(/[.!?]/)[0];
    return sentences.length > 80 ? sentences.substring(0, 80) + '...' : sentences;
  }

  _estimateActivityDuration(description) {
    const desc = description.toLowerCase();
    if (desc.includes('museum') || desc.includes('tour')) return 120;
    if (desc.includes('meal') || desc.includes('lunch') || desc.includes('dinner')) return 90;
    if (desc.includes('temple') || desc.includes('shrine')) return 75;
    if (desc.includes('shopping') || desc.includes('market')) return 90;
    return 60;
  }

  _estimateActivityCost(description, trip) {
    const desc = description.toLowerCase();
    const destination = trip.destination.destination.toLowerCase();
    
    let baseCost = 0;
    if (desc.includes('museum') || desc.includes('admission')) baseCost = 15;
    else if (desc.includes('meal') || desc.includes('restaurant')) baseCost = 25;
    else if (desc.includes('tour') || desc.includes('guided')) baseCost = 40;
    else if (desc.includes('temple') || desc.includes('park')) baseCost = 0;
    
    // Adjust for destination
    if (destination.includes('japan') || destination.includes('tokyo')) {
      return baseCost * 1.5; // Higher costs in Japan
    } else if (destination.includes('vietnam') || destination.includes('saigon')) {
      return baseCost * 0.6; // Lower costs in Vietnam
    }
    
    return baseCost;
  }

  _categorizeActivity(description) {
    const desc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.activityCategories)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }
    
    return 'cultural'; // Default category
  }

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

  _generateFallbackActivities(trip) {
    return [
      {
        time: '09:00',
        title: 'Free Time for Personal Exploration',
        description: 'Explore the local area at your own pace',
        location: {
          name: 'Local Area',
          address: trip.destination.destination,
          coordinates: this._generateCoordinates(trip.destination.destination)
        },
        duration: 120,
        cost: 0,
        category: 'leisure',
        notes: 'Flexible time for personal exploration'
      }
    ];
  }

  _generateItineraryMockResponse(prompt) {
    return `Based on your trip requirements, I recommend a structured itinerary focusing on cultural experiences and authentic local cuisine. Here's a detailed day-by-day plan:

Day 1: Arrival and Orientation
- Morning: Check-in and local area exploration
- Afternoon: Visit iconic landmarks
- Evening: Traditional dining experience

Day 2: Cultural Immersion
- Morning: Historical sites and museums
- Afternoon: Local markets and shopping
- Evening: Cultural performances

[This is an enhanced mock response. For detailed, location-specific recommendations, please configure your Gemini API key.]`;
  }

  _generateChatMockResponse(prompt) {
    return `I'd be happy to help with your travel planning! Based on your question, here are some tailored suggestions:

• Consider the local climate and seasonal factors
• Research authentic cultural experiences
• Plan for a mix of popular attractions and hidden gems
• Budget for both planned activities and spontaneous discoveries

Would you like me to elaborate on any of these aspects? [Configure Gemini API key for personalized AI responses]`;
  }
}

module.exports = ResponseParser;