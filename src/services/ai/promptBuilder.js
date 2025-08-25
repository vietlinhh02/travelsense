/**
 * PromptBuilder - Handles generation of structured prompts for different AI use cases
 * Responsible for: Conversation context, itinerary prompts, optimization prompts, validation prompts
 */
class PromptBuilder {
  constructor() {
    // Base templates for different prompt types
    this.templates = {
      extraction: {
        header: "Extract structured trip information from the conversation. Return ONLY JSON in a code block.",
        instructions: `Analyze the user's message and extract trip planning information.

Return JSON ONLY with this exact schema:
\`\`\`json
{
  "language": "vi|en",
  "timezone": "Asia/Bangkok|Asia/Tokyo|etc",
  "currency": "VND|USD|JPY|etc",
  "intent": "create_trip|modify_trip|ask_info|other",
  "extracted": {
    "origin": "string|null",
    "destinations": ["string"],
    "dates": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} | ["YYYY-MM-DD"] | null,
    "duration": number|null,
    "travelers": {"adults": number, "children": number, "infants": number},
    "budget": {"total": number, "currency": "string"}|null,
    "interests": ["string"],
    "pace": "easy|balanced|intense|null",
    "nightlife": "none|some|heavy|null",
    "dayStart": "HH:mm|null",
    "dayEnd": "HH:mm|null",
    "quietMorningAfterLateNight": boolean|null,
    "transportPrefs": ["string"]|null,
    "walkingLimitKm": number|null,
    "dietary": ["string"]|null,
    "mobility": "none|stroller|wheelchair|null",
    "mustSee": ["string"]|null,
    "avoid": ["string"]|null,
    "notes": "string|null"
  },
  "missing": ["field1", "field2"],
  "ambiguities": ["description1", "description2"]
}
\`\`\`

Rules:
- If a field is unknown, set to null and add field name to "missing"
- If something is ambiguous, add description to "ambiguities"
- Normalize dates to YYYY-MM-DD format using timezone
- Default language: vi for Vietnamese, en for English
- Default currency based on destination`
      },
      itinerary: {
        header: "You are a professional travel planner. Create a detailed, day-by-day itinerary for the following trip:",
        format: `Please return the itinerary as a single JSON object. Do not include any text outside of the JSON object.
The JSON object should be an array of day objects, where each day object has a 'date' and a list of 'activities'.
Each activity object must have the following properties: 'time', 'title', 'venue', 'address', 'category', and 'notes'.

Example JSON structure:
\`\`\`json
[{
  "date": "YYYY-MM-DD",
  "activities": [{
    "time": "HH:MM",
    "title": "Activity Title",
    "venue": "Venue Name",
    "address": "Venue Address",
    "category": "Activity Category",
    "notes": "Additional notes"
  }]
}]
\`\`\`

CRITICAL REQUIREMENTS for each activity:
- Use EXACT venue names (e.g., "Ben Thanh Market", "Independence Palace", "War Remnants Museum").
- Include SPECIFIC addresses (e.g., "135 Nam Ky Khoi Nghia, District 1, Ho Chi Minh City").
- Every location MUST be a real, searchable place name.
- The 'category' should be one of: 'cultural', 'food', 'shopping', 'nature', 'technology', 'leisure', 'entertainment', 'nightlife'.
- Provide brief but informative 'notes'.`
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
   * Build trip information extraction prompt
   * @param {string} message - User message
   * @param {Object} context - Context with user defaults
   * @returns {string} Formatted extraction prompt
   */
  buildExtractionPrompt(message, context = {}) {
    let prompt = `${this.templates.extraction.header}\n\n`;
    prompt += `User message: ${message}\n\n`;

    if (context.userDefaults) {
      prompt += `User defaults:\n`;
      prompt += `- Language: ${context.userDefaults.language || 'vi'}\n`;
      prompt += `- Timezone: ${context.userDefaults.timezone || 'Asia/Bangkok'}\n`;
      prompt += `- Currency: ${context.userDefaults.currency || 'VND'}\n\n`;
    }

    prompt += this.templates.extraction.instructions;

    return prompt;
  }

  /**
   * Build itinerary generation prompt with enhanced preferences support
   * @param {Object} trip - Trip object
   * @param {Object} options - Generation options with new preferences
   * @returns {string} Formatted prompt
   */
  buildItineraryPrompt(trip, options = {}) {
    let prompt = `${this.templates.itinerary.header}\n\n`;

    prompt += this._buildTripDetailsV2(trip, options);

    if (options.focus) {
      prompt += `- Special Focus: ${options.focus}\n`;
    }

    // Add nightlife and time preferences rules
    if (options.nightlife || options.pace || options.dayStart || options.dayEnd) {
      prompt += `\n**Time Management & Preferences:**\n`;
      if (options.dayStart) prompt += `- Day starts at: ${options.dayStart}\n`;
      if (options.dayEnd) prompt += `- Day ends at: ${options.dayEnd}\n`;
      if (options.pace) prompt += `- Pace: ${options.pace} (easy=relaxed, balanced=moderate, intense=packed)\n`;
      if (options.nightlife) prompt += `- Nightlife preference: ${options.nightlife} (none/some/heavy)\n`;
      if (options.quietMorningAfterLateNight) prompt += `- Quiet morning after late night: enabled\n`;
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
        prompt += `Day ${index + 1} (${day.date ? new Date(day.date).toDateString() : 'Day ' + (index + 1)}):\n`;
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
   * Build trip details section (legacy method)
   * @param {Object} trip - Trip object
   * @returns {string} Formatted trip details
   */
  _buildTripDetails(trip) {
    return this._buildTripDetailsV2(trip, {});
  }

  /**
   * Build enhanced trip details section with new preferences support
   * @param {Object} trip - Trip object
   * @param {Object} options - Generation options with new preferences
   * @returns {string} Formatted trip details
   */
  _buildTripDetailsV2(trip, options = {}) {
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

    // Enhanced preferences
    if (trip.budget && trip.budget.total) {
      details += `- Budget: $${trip.budget.total} USD total\n`;
    }

    if (trip.preferences && trip.preferences.interests && trip.preferences.interests.length > 0) {
      details += `- Interests: ${trip.preferences.interests.join(', ')}\n`;
    }

    if (trip.preferences && trip.preferences.constraints && trip.preferences.constraints.length > 0) {
      details += `- Constraints: ${trip.preferences.constraints.join(', ')}\n`;
    }

    // New preferences from options
    if (options.pace) {
      details += `- Pace: ${options.pace}\n`;
    }
    if (options.nightlife) {
      details += `- Nightlife: ${options.nightlife}\n`;
    }
    if (options.dayStart || options.dayEnd) {
      details += `- Active hours: ${options.dayStart || '09:00'} - ${options.dayEnd || '22:00'}\n`;
    }
    if (options.quietMorningAfterLateNight) {
      details += `- Quiet morning after late night: enabled\n`;
    }
    if (options.transportPrefs && options.transportPrefs.length > 0) {
      details += `- Transport preferences: ${options.transportPrefs.join(', ')}\n`;
    }
    if (options.walkingLimitKm) {
      details += `- Walking limit: ${options.walkingLimitKm}km\n`;
    }
    if (options.dietary && options.dietary.length > 0) {
      details += `- Dietary requirements: ${options.dietary.join(', ')}\n`;
    }
    if (options.mustSee && options.mustSee.length > 0) {
      details += `- Must see: ${options.mustSee.join(', ')}\n`;
    }
    if (options.avoid && options.avoid.length > 0) {
      details += `- Avoid: ${options.avoid.join(', ')}\n`;
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