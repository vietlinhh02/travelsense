/**
 * ChunkedItineraryGenerationService - Handles chunked itinerary generation
 * Focuses on generating itineraries for long trips using chunking strategy
 */
class ChunkedItineraryGenerationService {
  constructor() {
    this.chunkingService = require('./tripChunking.service');
    this.fallbackService = require('./fallbackGeneration.service');
    
    this.chunker = new this.chunkingService();
    this.fallbackGenerator = new this.fallbackService();
  }

  /**
   * Generate itinerary using chunked approach
   * @param {Object} trip - Trip object
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} Complete itinerary
   */
  async generateChunkedItinerary(trip, aiServices) {
    const analysis = this.chunker.analyzeTrip(trip);
    
    if (!analysis.needsChunking) {
      // Use standard generation for short trips
      return await aiServices.generateStandardItinerary(trip);
    }

    console.log(` Generating long trip itinerary in ${analysis.chunks.length} chunks`);
    
    const allDays = [];
    const generationContext = this._initializeGenerationContext(trip);

    // Generate each chunk sequentially for context continuity
    for (const chunk of analysis.chunks) {
      try {
        console.log(`Generating chunk: ${chunk.id} (Days ${chunk.startDay}-${chunk.endDay})`);
        
        const chunkItinerary = await this._generateChunkItinerary(
          trip,
          chunk,
          generationContext,
          aiServices
        );
        
        allDays.push(...chunkItinerary.days);
        
        // Update context for next chunk
        this._updateGenerationContext(generationContext, allDays, chunk);
        
        // Add delay between chunks to respect API rate limits
        await this._delay(1000);
        
      } catch (error) {
        console.warn(`Chunk ${chunk.id} generation failed, using fallback:`, error.message);
        
        // Generate fallback days for this chunk
        const fallbackDays = this.fallbackGenerator.generateFallbackDays(trip, chunk);
        allDays.push(...fallbackDays);
      }
    }

    console.log(` Long trip generation completed with ${allDays.length} days generated`);
    return { days: allDays.slice(0, trip.duration) };
  }

  /**
   * Generate itinerary for a specific chunk
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} Chunk itinerary
   */
  async _generateChunkItinerary(trip, chunk, context, aiServices) {
    // Create a modified trip object for this chunk
    const chunkTrip = this._createChunkTrip(trip, chunk, context);

    // Generate optimized prompt for this chunk
    const prompt = await this._buildChunkedPrompt(chunkTrip, chunk, context, aiServices);

    // Call AI service with chunk-specific parameters
    const response = await this._callAIForChunk(prompt, chunk, aiServices);

    // Parse response with chunk context
    return await this._parseChunkResponse(response, chunkTrip, chunk, aiServices);
  }

  /**
   * Initialize generation context for chunked processing
   * @param {Object} trip - Trip object
   * @returns {Object} Initial generation context
   */
  _initializeGenerationContext(trip) {
    return {
      previousDays: [],
      overallTheme: trip.preferences?.interests?.[0] || 'sightseeing',
      budget: trip.budget,
      constraints: trip.preferences?.constraints || [],
      destination: trip.destination,
      processedChunks: 0,
      totalBudgetUsed: 0,
      activityCategories: new Set()
    };
  }

  /**
   * Update generation context after processing a chunk
   * @param {Object} context - Generation context
   * @param {Array} allDays - All generated days so far
   * @param {Object} chunk - Processed chunk
   */
  _updateGenerationContext(context, allDays, chunk) {
    const overlapDays = this.chunker.getConfig().overlapDays;
    context.previousDays = allDays.slice(-overlapDays);
    context.processedChunks++;
    
    // Update activity categories for variety tracking
    allDays.forEach(day => {
      day.activities?.forEach(activity => {
        if (activity.category) {
          context.activityCategories.add(activity.category);
        }
      });
    });

    // Update budget tracking
    const chunkCost = this._calculateChunkCost(allDays.slice(-((chunk.endDay - chunk.startDay) + 1)));
    context.totalBudgetUsed += chunkCost;
  }

  /**
   * Create a modified trip object for chunk processing
   * @param {Object} trip - Original trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @returns {Object} Modified trip object for chunk
   */
  _createChunkTrip(trip, chunk, context) {
    return {
      ...trip,
      duration: chunk.endDay - chunk.startDay + 1,
      destination: {
        ...trip.destination,
        startDate: this.chunker.calculateChunkStartDate(trip.destination.startDate, chunk.startDay)
      },
      chunkInfo: {
        id: chunk.id,
        focus: chunk.focus,
        detailLevel: chunk.detailLevel,
        dayRange: `${chunk.startDay}-${chunk.endDay}`,
        context: context.previousDays.length > 0 ? 'continuation' : 'beginning',
        processedChunks: context.processedChunks,
        remainingBudget: this._calculateRemainingBudget(trip.budget, context.totalBudgetUsed),
        usedCategories: Array.from(context.activityCategories)
      }
    };
  }

  /**
   * Build optimized prompt for chunk generation
   * @param {Object} chunkTrip - Chunk trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<string>} Generated prompt
   */
  async _buildChunkedPrompt(chunkTrip, chunk, context, aiServices) {
    // Use promptBuilder if available, otherwise create basic prompt
    if (aiServices.promptBuilder && aiServices.promptBuilder.buildChunkedItineraryPrompt) {
      return aiServices.promptBuilder.buildChunkedItineraryPrompt(chunkTrip, chunk, context);
    }

    // Fallback prompt building
    return this._buildBasicChunkedPrompt(chunkTrip, chunk, context);
  }

  /**
   * Build basic chunked prompt as fallback
   * @param {Object} chunkTrip - Chunk trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @returns {string} Generated prompt
   */
  _buildBasicChunkedPrompt(chunkTrip, chunk, context) {
    let prompt = `Generate a detailed ${chunk.detailLevel} itinerary for a ${chunkTrip.duration}-day trip segment.\n\n`;
    
    prompt += `**Trip Details:**\n`;
    prompt += `- Destination: ${chunkTrip.destination.city || chunkTrip.destination.destination}\n`;
    prompt += `- Days: ${chunk.startDay}-${chunk.endDay} of ${chunkTrip.duration + (chunk.startDay - 1)} total days\n`;
    prompt += `- Focus: ${chunk.focus}\n`;
    prompt += `- Detail Level: ${chunk.detailLevel}\n\n`;

    if (context.previousDays.length > 0) {
      prompt += `**Previous Activities Context:**\n`;
      prompt += `The traveler has already completed activities in previous days. `;
      prompt += `Ensure continuity and avoid repetition.\n\n`;
    }

    prompt += `**Requirements:**\n`;
    prompt += `- Focus on ${chunk.focus.replace('_', ' ')}\n`;
    prompt += `- Provide ${chunk.detailLevel} level of detail\n`;
    prompt += `- Include specific venue names, addresses, and timing\n`;
    prompt += `- Consider local culture and customs\n\n`;

    prompt += `Please provide the itinerary in JSON format with days and activities.`;

    return prompt;
  }

  /**
   * Call AI service for chunk generation
   * @param {string} prompt - Generated prompt
   * @param {Object} chunk - Chunk configuration
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} AI response
   */
  async _callAIForChunk(prompt, chunk, aiServices) {
    const maxTokens = this.chunker.calculateMaxTokensForChunk(chunk);
    
    // Use geminiClient if available
    if (aiServices.geminiClient && aiServices.geminiClient.callGeminiAPI) {
      return await aiServices.geminiClient.callGeminiAPI(
        'flash', // Use faster model for chunks
        prompt,
        {
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: chunk.priority === 'high' ? 0.7 : 0.8 // More creativity for middle chunks
          }
        }
      );
    }

    // Fallback to basic AI call
    throw new Error('AI service not available for chunk generation');
  }

  /**
   * Parse chunk response
   * @param {Object} response - AI response
   * @param {Object} chunkTrip - Chunk trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} Parsed chunk itinerary
   */
  async _parseChunkResponse(response, chunkTrip, chunk, aiServices) {
    // Use responseParser if available
    if (aiServices.responseParser && aiServices.responseParser.processChunkedItineraryResponse) {
      return aiServices.responseParser.processChunkedItineraryResponse(
        response.content,
        chunkTrip,
        chunk
      );
    }

    // Fallback parsing
    return this._parseBasicChunkResponse(response, chunkTrip, chunk);
  }

  /**
   * Basic chunk response parsing as fallback
   * @param {Object} response - AI response
   * @param {Object} chunkTrip - Chunk trip object
   * @param {Object} chunk - Chunk configuration
   * @returns {Object} Parsed chunk itinerary
   */
  _parseBasicChunkResponse(response, chunkTrip, chunk) {
    try {
      // Clean and parse JSON response
      const content = response.content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(content);
      
      // Ensure we have days array
      const days = parsed.days || parsed.itinerary?.days || [];
      
      return { days };
    } catch (error) {
      console.warn(`Failed to parse chunk response for ${chunk.id}:`, error.message);
      
      // Return fallback structure
      return {
        days: this.fallbackGenerator.generateFallbackDays(chunkTrip, chunk)
      };
    }
  }

  /**
   * Calculate cost for a set of days
   * @param {Array} days - Array of day objects
   * @returns {number} Total cost
   */
  _calculateChunkCost(days) {
    return days.reduce((total, day) => {
      return total + (day.activities?.reduce((dayTotal, activity) => {
        return dayTotal + (activity.cost || 0);
      }, 0) || 0);
    }, 0);
  }

  /**
   * Calculate remaining budget
   * @param {Object} totalBudget - Total budget object
   * @param {number} usedAmount - Amount already used
   * @returns {number} Remaining budget
   */
  _calculateRemainingBudget(totalBudget, usedAmount) {
    if (!totalBudget || !totalBudget.total) return null;
    return Math.max(0, totalBudget.total - usedAmount);
  }

  /**
   * Add delay between API calls
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate progress callback for chunk processing
   * @param {Function} onProgress - Progress callback function
   * @returns {Function} Wrapped progress callback
   */
  createProgressCallback(onProgress) {
    if (!onProgress) return () => {};
    
    return (current, total, chunkId) => {
      onProgress({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        chunkId,
        stage: 'chunk_generation'
      });
    };
  }
}

module.exports = ChunkedItineraryGenerationService;
