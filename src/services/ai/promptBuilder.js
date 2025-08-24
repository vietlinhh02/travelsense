/**
 * PromptBuilder - Handles generation of structured prompts for different AI use cases
 * Responsible for: Conversation context, itinerary prompts, optimization prompts, validation prompts
 */
class PromptBuilder {
  constructor() {
    // Base templates for different prompt types
    this.templates = {
      itinerary: {
        header: "You are a professional travel planner. Create a detailed, day-by-day itinerary for the following trip:",
        format: `Please create a detailed itinerary with the following format:

Day 1: [Date]
09:00 - [Activity Name] at [Specific Location]
11:30 - [Activity Name] at [Specific Location] 
14:00 - [Activity Name] at [Specific Location]
16:30 - [Activity Name] at [Specific Location]

Day 2: [Date]
[Continue same format...]

CRITICAL REQUIREMENTS for each activity:
- Use EXACT venue names (e.g., "Ben Thanh Market", "Independence Palace", "War Remnants Museum")
- Include SPECIFIC addresses (e.g., "135 Nam Ky Khoi Nghia, District 1, Ho Chi Minh City")
- NO generic terms like "this iconic landmark", "famous temple", or "Unknown"
- Every location MUST be a real, searchable place name
- Provide precise venue information that can be found on Google Maps or travel APIs
- Brief description of what to expect
- Consider travel time between locations
- Mix of cultural sites, food experiences, and interests mentioned
- Realistic timing and practical logistics

Focus on authentic local experiences with REAL, SPECIFIC venue names and addresses.`
      },
      optimization: {
        header: "Optimize the following trip schedule for better flow and efficiency:",
        instructions: "Please optimize this schedule considering travel time, logical flow, and user preferences."
      },
      validation: {
        header: "Validate the following trip against user constraints:",
        instructions: "Please identify any constraint violations or potential conflicts."
      },
      chat: {
        header: "You are a helpful AI travel assistant. Provide personalized travel advice based on the user's question:",
        instructions: "Provide helpful, practical travel recommendations."
      },
      suggestions: {
        header: "Suggest travel activities based on the following criteria:",
        instructions: "Please suggest relevant activities with descriptions and practical information."
      }
    };
  }

  /**
   * Build conversation context prompt
   * @param {string} message - User message
   * @param {Object} context - Conversation context
   * @returns {string} Formatted prompt
   */
  buildConversationPrompt(message, context = {}) {
    let prompt = `${this.templates.chat.header}\n\n`;
    prompt += `User message: ${message}\n\n`;
    
    if (context.tripId) {
      prompt += `Context: This is related to trip planning.\n`;
    }
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      prompt += `Previous conversation:\n`;
      context.conversationHistory.slice(-3).forEach(exchange => {
        prompt += `${exchange.role}: ${exchange.content}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += this.templates.chat.instructions;
    
    return prompt;
  }

  /**
   * Build itinerary generation prompt
   * @param {Object} trip - Trip object
   * @param {string} focus - Special focus for the itinerary
   * @returns {string} Formatted prompt
   */
  buildItineraryPrompt(trip, focus) {
    let prompt = `${this.templates.itinerary.header}\n\n`;
    
    prompt += this._buildTripDetails(trip);
    
    if (focus) {
      prompt += `- Special Focus: ${focus}\n`;
    }
    
    prompt += `\n**Instructions:**\n`;
    prompt += this.templates.itinerary.format;
    
    return prompt;
  }

  /**
   * Build chunked itinerary generation prompt for long trips
   * @param {Object} trip - Trip object (modified for chunk)
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @returns {string} Formatted prompt for chunk
   */
  buildChunkedItineraryPrompt(trip, chunk, context) {
    let prompt = `You are a professional travel planner creating a detailed itinerary segment for a longer trip.\n\n`;
    
    prompt += this._buildChunkedTripDetails(trip, chunk, context);
    
    prompt += `\n**Chunk-Specific Instructions:**\n`;
    prompt += this._getChunkInstructions(chunk, context);
    
    prompt += `\n**Format Requirements:**\n`;
    prompt += this._getChunkedFormat(chunk);
    
    return prompt;
  }

  /**
   * Build optimization prompt
   * @param {Object} trip - Trip object
   * @param {string} focus - Optimization focus
   * @returns {string} Formatted prompt
   */
  buildOptimizationPrompt(trip, focus) {
    let prompt = `${this.templates.optimization.header}\n\n`;
    prompt += `Current itinerary for ${trip.name}:\n`;
    
    if (trip.itinerary && trip.itinerary.days) {
      trip.itinerary.days.forEach((day, index) => {
        prompt += `Day ${index + 1} (${day.date ? day.date.toDateString() : 'Day ' + (index + 1)}):\n`;
        if (day.activities) {
          day.activities.forEach(activity => {
            prompt += `- ${activity.time}: ${activity.title} at ${activity.location.name || activity.location}\n`;
          });
        }
        prompt += `\n`;
      });
    }
    
    if (focus) {
      prompt += `Optimization focus: ${focus}\n`;
    }
    
    prompt += `\n${this.templates.optimization.instructions}`;
    
    return prompt;
  }

  /**
   * Build validation prompt
   * @param {Object} trip - Trip object
   * @param {string} checkType - Type of validation
   * @returns {string} Formatted prompt
   */
  buildValidationPrompt(trip, checkType) {
    let prompt = `${this.templates.validation.header}\n\n`;
    prompt += `Trip: ${trip.name}\n`;
    prompt += `Destination: ${trip.destination.destination}\n`;
    
    if (trip.preferences && trip.preferences.constraints && trip.preferences.constraints.length > 0) {
      prompt += `User constraints: ${trip.preferences.constraints.join(', ')}\n`;
    }
    
    if (trip.budget && trip.budget.total) {
      prompt += `Budget: ${trip.budget.total} ${trip.budget.currency || 'USD'}\n`;
    }
    
    prompt += `Validation type: ${checkType}\n`;
    prompt += `\n${this.templates.validation.instructions}`;
    
    return prompt;
  }

  /**
   * Build activity suggestion prompt
   * @param {Object} trip - Trip object (optional)
   * @param {Object} options - Suggestion options
   * @returns {string} Formatted prompt
   */
  buildSuggestionPrompt(trip, options = {}) {
    let prompt = `${this.templates.suggestions.header}\n\n`;
    prompt += `Suggest activities `;
    
    if (trip) {
      prompt += `for a trip to ${trip.destination.destination} `;
    }
    
    if (options.date) {
      prompt += `on ${options.date} `;
    }
    
    if (options.timePeriod) {
      prompt += `during ${options.timePeriod} `;
    }
    
    prompt += `\n\n`;
    
    const interests = options.interests || (trip && trip.preferences && trip.preferences.interests) || [];
    if (interests.length > 0) {
      prompt += `Interests: ${interests.join(', ')}\n`;
    }
    
    const constraints = options.constraints || (trip && trip.preferences && trip.preferences.constraints) || [];
    if (constraints.length > 0) {
      prompt += `Constraints: ${constraints.join(', ')}\n`;
    }
    
    prompt += `\n${this.templates.suggestions.instructions}`;
    
    return prompt;
  }

  /**
   * Build trip details section (helper method)
   * @param {Object} trip - Trip object
   * @returns {string} Formatted trip details
   */
  _buildTripDetails(trip) {
    let details = `**Trip Details:**\n`;
    details += `- Destination: From ${trip.destination.origin} to ${trip.destination.destination}\n`;
    details += `- Duration: ${trip.duration} days\n`;
    details += `- Travelers: ${trip.travelers.adults} adults`;
    
    if (trip.travelers.children > 0) {
      details += `, ${trip.travelers.children} children`;
    }
    if (trip.travelers.infants > 0) {
      details += `, ${trip.travelers.infants} infants`;
    }
    
    details += `\n`;
    
    if (trip.budget && trip.budget.total) {
      details += `- Budget: $${trip.budget.total} USD total\n`;
    }
    
    if (trip.preferences && trip.preferences.interests && trip.preferences.interests.length > 0) {
      details += `- Interests: ${trip.preferences.interests.join(', ')}\n`;
    }
    
    if (trip.preferences && trip.preferences.constraints && trip.preferences.constraints.length > 0) {
      details += `- Constraints: ${trip.preferences.constraints.join(', ')}\n`;
    }
    
    // Add destination-specific examples to guide AI
    details += this._getDestinationSpecificExamples(trip.destination.destination);
    
    return details;
  }

  /**
   * Build chunked trip details
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @returns {string} Formatted trip details for chunk
   */
  _buildChunkedTripDetails(trip, chunk, context) {
    let details = `**Trip Segment Details:**\n`;
    details += `- Overall Destination: ${trip.destination.destination}\n`;
    details += `- Segment: Days ${chunk.startDay}-${chunk.endDay} (${trip.duration} days total)\n`;
    details += `- Focus: ${chunk.focus.replace('_', ' ')}\n`;
    details += `- Detail Level: ${chunk.detailLevel}\n`;
    details += `- Travelers: ${trip.travelers.adults} adults`;
    
    if (trip.travelers.children > 0) {
      details += `, ${trip.travelers.children} children`;
    }
    if (trip.travelers.infants > 0) {
      details += `, ${trip.travelers.infants} infants`;
    }
    details += `\n`;
    
    if (trip.budget && trip.budget.total) {
      const chunkBudget = Math.floor(trip.budget.total / trip.duration * (chunk.endDay - chunk.startDay + 1));
      details += `- Budget for this segment: ~$${chunkBudget} USD\n`;
    }
    
    if (trip.preferences && trip.preferences.interests && trip.preferences.interests.length > 0) {
      details += `- Interests: ${trip.preferences.interests.join(', ')}\n`;
    }
    
    if (context.previousDays && context.previousDays.length > 0) {
      details += `\n**Context from Previous Days:**\n`;
      context.previousDays.forEach((day, index) => {
        const dayNum = chunk.startDay - context.previousDays.length + index;
        details += `Day ${dayNum}: ${day.activities.map(a => a.title).join(', ')}\n`;
      });
    }
    
    return details;
  }

  /**
   * Get chunk-specific instructions
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @returns {string} Chunk instructions
   */
  _getChunkInstructions(chunk, context) {
    let instructions = '';
    
    switch (chunk.detailLevel) {
      case 'comprehensive':
        instructions += '- Provide detailed descriptions and specific recommendations\n';
        instructions += '- Include practical tips and insider information\n';
        instructions += '- Focus on must-see attractions and experiences\n';
        break;
      case 'balanced':
        instructions += '- Provide good detail while maintaining variety\n';
        instructions += '- Balance popular attractions with local experiences\n';
        instructions += '- Consider travel logistics between activities\n';
        break;
      case 'simplified':
        instructions += '- Focus on essential activities and departure logistics\n';
        instructions += '- Keep descriptions concise but practical\n';
        instructions += '- Prioritize convenience and efficiency\n';
        break;
    }
    
    if (chunk.focus) {
      const focusMap = {
        'arrival_orientation': 'Focus on arrival logistics, orientation, and settling in',
        'cultural_immersion': 'Emphasize cultural sites, museums, and heritage experiences',
        'local_experiences': 'Highlight authentic local activities and hidden gems',
        'nature_exploration': 'Prioritize outdoor activities, parks, and natural attractions',
        'food_discovery': 'Focus on culinary experiences and local cuisine',
        'historical_sites': 'Emphasize historical landmarks and educational experiences',
        'entertainment_leisure': 'Include entertainment, nightlife, and leisure activities',
        'departure_logistics': 'Focus on departure preparation and last-minute activities'
      };
      
      instructions += `- ${focusMap[chunk.focus] || chunk.focus}\n`;
    }
    
    if (context.previousDays && context.previousDays.length > 0) {
      instructions += '- Ensure continuity with previous days mentioned in context\n';
      instructions += '- Avoid repeating similar activities from previous days\n';
    }
    
    return instructions;
  }

  /**
   * Get format requirements for chunked generation
   * @param {Object} chunk - Chunk configuration
   * @returns {string} Format requirements
   */
  _getChunkedFormat(chunk) {
    return `Create a detailed itinerary with the following format:

Day ${chunk.startDay}: [Date]
09:00 - [Activity Name] at [Specific Location]
11:30 - [Activity Name] at [Specific Location] 
14:00 - [Activity Name] at [Specific Location]
16:30 - [Activity Name] at [Specific Location]

${chunk.endDay > chunk.startDay ? `Day ${chunk.endDay}: [Date]
[Continue same format...]` : ''}

CRITICAL REQUIREMENTS for each activity:
- Use EXACT venue names (e.g., "Ben Thanh Market", "Independence Palace")
- Include SPECIFIC addresses when possible
- NO generic terms like "this landmark", "famous temple", or "Unknown"
- Every location MUST be a real, searchable place name
- Brief but informative descriptions
- Consider travel time and practical logistics
- Mix activities according to the specified focus
- Ensure timing is realistic and achievable`;
  }

  /**
   * Validate prompt length and content
   * @param {string} prompt - Generated prompt
   * @returns {Object} Validation result
   */
  validatePrompt(prompt) {
    const maxLength = 8000; // Safe limit for most models
    const minLength = 50;
    
    return {
      valid: prompt.length >= minLength && prompt.length <= maxLength,
      length: prompt.length,
      maxLength,
      minLength,
      warnings: prompt.length > maxLength * 0.8 ? ['Prompt is getting close to maximum length'] : []
    };
  }

  /**
   * Get template for specific prompt type
   * @param {string} type - Template type
   * @returns {Object} Template object
   */
  getTemplate(type) {
    return this.templates[type] || null;
  }

  /**
   * Update template for specific prompt type
   * @param {string} type - Template type
   * @param {Object} template - New template
   */
  updateTemplate(type, template) {
    this.templates[type] = { ...this.templates[type], ...template };
  }

  /**
   * Get destination-specific examples for venue names
   * @param {string} destination - Destination name
   * @returns {string} Examples specific to destination
   */
  _getDestinationSpecificExamples(destination) {
    const destLower = destination.toLowerCase();
    
    if (destLower.includes('ho chi minh') || destLower.includes('saigon') || destLower.includes('vietnam')) {
      return `\n**Example venue names for ${destination}:**\n` +
        `- "Ben Thanh Market" (at "Le Loi, Ben Thanh Ward, District 1, Ho Chi Minh City")\n` +
        `- "Independence Palace" (at "135 Nam Ky Khoi Nghia, District 1, Ho Chi Minh City")\n` +
        `- "War Remnants Museum" (at "28 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City")\n` +
        `- "Jade Emperor Pagoda" (at "73 Mai Thi Luu, Da Kao Ward, District 1")\n` +
        `- "Notre Dame Cathedral" (at "01 Cong xa Paris, Ben Nghe Ward, District 1")\n` +
        `- "Cu Chi Tunnels" (at "Cu Chi District, Ho Chi Minh City")\n`;
    } else if (destLower.includes('tokyo') || destLower.includes('japan')) {
      return `\n**Example venue names for ${destination}:**\n` +
        `- "Senso-ji Temple" (at "2-3-1 Asakusa, Taito City, Tokyo")\n` +
        `- "Meiji Shrine" (at "1-1 Kamizono-cho, Shibuya City, Tokyo")\n` +
        `- "Tsukiji Outer Market" (at "5 Chome Tsukiji, Chuo City, Tokyo")\n` +
        `- "Tokyo Skytree" (at "1-1-2 Oshiage, Sumida City, Tokyo")\n` +
        `- "Imperial Palace East Gardens" (at "1-1 Chiyoda, Chiyoda City, Tokyo")\n` +
        `- "Shibuya Crossing" (at "Shibuya, Tokyo")\n`;
    } else if (destLower.includes('hanoi') || destLower.includes('ha noi')) {
      return `\n**Example venue names for ${destination}:**\n` +
        `- "Hoan Kiem Lake" (at "Hoan Kiem District, Hanoi")\n` +
        `- "Temple of Literature" (at "58 Quoc Tu Giam, Dong Da, Hanoi")\n` +
        `- "Old Quarter" (at "Hoan Kiem District, Hanoi")\n` +
        `- "Ho Chi Minh Mausoleum" (at "2 Hung Vuong, Dien Bien, Ba Dinh, Hanoi")\n` +
        `- "One Pillar Pagoda" (at "Chua Mot Cot, Doi Can, Ba Dinh, Hanoi")\n`;
    } else {
      return `\n**Important:** Use real, specific venue names that can be found on Google Maps or travel websites.\n`;
    }
  }
}

module.exports = PromptBuilder;