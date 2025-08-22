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

For each activity, include:
- Specific venue names and locations
- Brief description of what to expect
- Consider travel time between locations
- Mix of cultural sites, food experiences, and interests mentioned
- Realistic timing and practical logistics

Focus on authentic local experiences and practical recommendations.`
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
    
    return details;
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
}

module.exports = PromptBuilder;