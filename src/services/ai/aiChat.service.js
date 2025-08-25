const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const { Trip, TripDraft } = require('../../models/trips');
const { tripDraftService } = require('../trips');
const AIBaseService = require('./aiBase.service');

/**
 * AIChatService - Handles chat conversations and trip information extraction
 * Extends AIBaseService with chat-specific functionality
 */
class AIChatService extends AIBaseService {
  constructor() {
    super();
  }

  /**
   * Extract trip information from chat message using AI and update TripDraft
   * @param {string} userId - User ID
   * @param {Object} chatData - Chat data with message and context
   * @returns {Promise<Object>} Extracted trip information with draft status
   */
  async extractTripInfoFromChat(userId, chatData) {
    const { message, context = {} } = chatData;
    const startTime = Date.now();

    try {
      // Check rate limits for flash model
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, 'flash');
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Get or create active draft for user
      const sessionId = context.sessionId;
      const draft = await tripDraftService.getOrCreateActiveDraft(userId, sessionId);

      // Build extraction prompt
      const prompt = this.promptBuilder.buildExtractionPrompt(message, {
        userDefaults: context.userDefaults || {},
        existingData: draft.extracted
      });

      // Call Gemini API with structured output
      const response = await this._callGeminiAPI('flash', prompt, {
        responseSchema: {
          type: "object",
          properties: {
            language: { type: "string" },
            timezone: { type: "string" },
            currency: { type: "string" },
            intent: { type: "string", enum: ["create_trip", "modify_trip", "ask_info", "other"] },
            extracted: {
              type: "object",
              properties: {
                origin: { type: "string" },
                destinations: { type: "array", items: { type: "string" } },
                dates: { type: "object", properties: { start: { type: "string" }, end: { type: "string" } } },
                duration: { type: "number" },
                travelers: { type: "object", properties: { adults: { type: "number" }, children: { type: "number" }, infants: { type: "number" } } },
                budget: { type: "object", properties: { total: { type: "number" }, currency: { type: "string" } } },
                interests: { type: "array", items: { type: "string" } },
                pace: { type: "string", enum: ["easy", "balanced", "intense"] },
                nightlife: { type: "string", enum: ["none", "some", "heavy"] },
                dayStart: { type: "string" },
                dayEnd: { type: "string" },
                quietMorningAfterLateNight: { type: "boolean" },
                transportPrefs: { type: "array", items: { type: "string" } },
                walkingLimitKm: { type: "number" },
                dietary: { type: "array", items: { type: "string" } },
                mobility: { type: "string", enum: ["none", "stroller", "wheelchair"] },
                mustSee: { type: "array", items: { type: "string" } },
                avoid: { type: "array", items: { type: "string" } },
                notes: { type: "string" }
              }
            },
            missing: { type: "array", items: { type: "string" } },
            ambiguities: { type: "array", items: { type: "string" } }
          },
          required: ["language", "timezone", "currency", "intent", "extracted", "missing", "ambiguities"]
        }
      });

      const processingTime = Date.now() - startTime;

      // Try to parse JSON response
      const extractedData = this.responseParser._tryParseJSON(response.content) || {
        intent: "other",
        extracted: {},
        missing: ["parse_error"],
        ambiguities: []
      };

      // Add user message to draft
      await tripDraftService.addMessage(draft._id, 'user', message, extractedData);

      // Update draft with extracted information
      const updatedDraft = await tripDraftService.updateDraft(
        draft._id,
        extractedData.extracted,
        extractedData.missing,
        extractedData.ambiguities.map(ambiguity => ({
          field: ambiguity,
          issue: ambiguity,
          suggestion: `Please clarify ${ambiguity}`
        }))
      );

      // Log interaction
      await this._logInteraction({
        userId,
        endpoint: 'extract-trip-info',
        model: 'flash',
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true,
        metadata: {
          intent: extractedData.intent,
          missingFields: extractedData.missing?.length || 0,
          draftId: draft._id,
          readinessScore: updatedDraft.readinessScore
        }
      });

      return {
        ...extractedData,
        draft: tripDraftService.getDraftSummary(updatedDraft),
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logInteraction({
        userId,
        endpoint: 'extract-trip-info',
        model: 'flash',
        prompt: message,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Chat with AI for trip planning ideation and suggestions
   * @param {string} userId - User ID
   * @param {Object} chatData - Chat request data
   * @returns {Promise<Object>} AI response
   */
  async chatWithAI(userId, chatData) {
    const { message, context = {}, model = 'flash' } = chatData;
    const startTime = Date.now();
    let prompt = 'Error occurred before prompt generation';

    try {
      // Check rate limits
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, model);
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Validate trip access if tripId provided
      if (context.tripId) {
        const trip = await Trip.findById(context.tripId);
        if (!trip || !trip.isOwnedBy(userId)) {
          throw new Error('TRIP_ACCESS_DENIED');
        }
      }

      // Check if this is a trip creation intent
      if (context.intent === 'create_plan' || context.intent === 'create_trip') {
        // Extract trip information first
        const extracted = await this.extractTripInfoFromChat(userId, { message, context });

        // Check if draft is ready for trip creation
        if (extracted.draft?.isReady) {
          // Auto-generate itinerary if ready
          try {
            const itineraryResult = await this._generateItineraryFromExtracted(userId, extracted, context);

            // Materialize draft into actual trip
            const tripData = {
              name: `Trip to ${extracted.extracted.destinations?.[0] || 'Destination'}`,
              itinerary: itineraryResult.itinerary
            };

            const createdTrip = await tripDraftService.materializeDraft(extracted.draft.id, tripData);

            return {
              content: `Tuyệt vời! Tôi đã tạo chuyến đi hoàn chỉnh cho bạn. Chuyến đi "${createdTrip.name}" đã sẵn sàng với lịch trình chi tiết.`,
              trip: {
                id: createdTrip._id,
                name: createdTrip.name,
                destination: createdTrip.destination,
                duration: createdTrip.duration
              },
              itinerary: itineraryResult.itinerary,
              extracted,
              autoCreated: true,
              model: 'pro',
              tokensUsed: (extracted.tokensUsed || 0) + (itineraryResult.tokensUsed || 0),
              processingTime: Date.now() - startTime,
              rateLimitRemaining: rateLimitCheck.remaining - 1
            };
          } catch (error) {
            console.error('Auto trip creation failed:', error);
            // Fall through to regular chat if auto-creation fails
          }
        }

        // Return extracted info with next question
        const nextQuestion = extracted.draft?.nextQuestion;
        let responseContent = `Tôi đã hiểu yêu cầu của bạn. Bạn muốn đi ${extracted.extracted.destinations?.join(', ') || 'địa điểm nào đó'}.`;

        if (extracted.missing?.length > 0) {
          responseContent += `\n\nĐể tạo lịch trình hoàn chỉnh, tôi cần thêm thông tin:\n`;
          extracted.missing.forEach(field => {
            const fieldNames = {
              destinations: 'điểm đến',
              origin: 'điểm xuất phát',
              dates: 'thời gian đi',
              duration: 'số ngày đi',
              travelers: 'số lượng người',
              budget: 'ngân sách'
            };
            responseContent += `- ${fieldNames[field] || field}\n`;
          });
        }

        if (nextQuestion) {
          responseContent += `\n\n${nextQuestion}`;
        }

        return {
          content: responseContent,
          extracted,
          needsMoreInfo: extracted.missing?.length > 0,
          missingFields: extracted.missing || [],
          ambiguities: extracted.ambiguities || [],
          nextQuestion,
          readinessScore: extracted.draft?.readinessScore || 0,
          model: 'flash',
          tokensUsed: extracted.tokensUsed || 0,
          processingTime: Date.now() - startTime,
          rateLimitRemaining: rateLimitCheck.remaining - 1
        };
      }

      // Prepare conversation context using PromptBuilder
      prompt = this.promptBuilder.buildConversationPrompt(message, context);

      // Call Gemini API
      const response = await this._callGeminiAPI(model, prompt);

      const processingTime = Date.now() - startTime;

      // Log interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true
      });

      return {
        content: response.content,
        model: model,
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Log failed interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Generate itinerary from extracted information
   * @param {string} userId - User ID
   * @param {Object} extracted - Extracted trip information
   * @param {Object} context - Context data
   * @returns {Promise<Object>} Generated itinerary
   */
  async _generateItineraryFromExtracted(userId, extracted, context = {}) {
    // Create trip object from extracted data
    const tripData = {
      name: `Trip to ${extracted.extracted.destinations?.[0] || 'Destination'}`,
      destination: {
        origin: extracted.extracted.origin || 'Current Location',
        destination: extracted.extracted.destinations?.[0] || 'Unknown',
        startDate: extracted.extracted.dates?.start ? new Date(extracted.extracted.dates.start) : new Date(),
        endDate: extracted.extracted.dates?.end ? new Date(extracted.extracted.dates.end) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      },
      duration: extracted.extracted.duration || 3,
      travelers: extracted.extracted.travelers || { adults: 2, children: 0, infants: 0 },
      budget: extracted.extracted.budget || null,
      preferences: {
        interests: extracted.extracted.interests || [],
        constraints: extracted.extracted.avoid || []
      }
    };

    // Set duration based on dates if available
    if (extracted.extracted.dates?.start && extracted.extracted.dates?.end) {
      const start = new Date(extracted.extracted.dates.start);
      const end = new Date(extracted.extracted.dates.end);
      tripData.duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    // Create temporary trip-like object
    const tempTrip = {
      ...tripData,
      isOwnedBy: () => true,
      itinerary: { days: [] }
    };

    // Generate itinerary with enhanced preferences
    const options = {
      focus: context.focus,
      pace: extracted.extracted.pace,
      nightlife: extracted.extracted.nightlife,
      dayStart: extracted.extracted.dayStart,
      dayEnd: extracted.extracted.dayEnd,
      quietMorningAfterLateNight: extracted.extracted.quietMorningAfterLateNight,
      transportPrefs: extracted.extracted.transportPrefs,
      walkingLimitKm: extracted.extracted.walkingLimitKm,
      dietary: extracted.extracted.dietary,
      mustSee: extracted.extracted.mustSee,
      avoid: extracted.extracted.avoid
    };

    return await this.generateItinerary(userId, 'temp-trip-id', options);
  }
}

module.exports = AIChatService;
