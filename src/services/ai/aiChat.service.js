const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const { Trip } = require('../../models/trips');
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
   * Initialize service with dependencies
   * @param {Object} dependencies - Service dependencies
   */
  initialize(dependencies = {}) {
    super.initialize(dependencies);
  }



  /**
   * Chat with AI for trip planning and information gathering
   * @param {string} userId - User ID
   * @param {Object} chatData - Chat request data
   * @returns {Promise<Object>} AI response with information gathering
   */
  async chatWithAI(userId, chatData) {
    const { message, context = {}, model = 'flash' } = chatData;
    const startTime = Date.now();

    try {
      // Check rate limits
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, model);
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      let responseContent = '';
      let tokensUsed = 0;
      let trip = null;

      // If tripId is provided, get trip data and analyze what's missing
      if (context.tripId) {
        trip = await Trip.findById(context.tripId);
        if (!trip || !trip.isOwnedBy(userId)) {
          throw new Error('TRIP_ACCESS_DENIED');
        }

        // Check what information is missing
        const missingInfo = this._analyzeMissingTripInfo(trip);

        if (missingInfo.length > 0) {
          // Ask for missing information
          responseContent = await this._askForMissingInfo(message, trip, missingInfo);
        } else {
          // All information is complete, provide helpful response
          responseContent = await this._provideCompleteTripResponse(message, trip);
        }

        // Try to extract information from user message and update trip
        const extractedInfo = await this._extractTripInfoFromMessage(message, trip);
        if (extractedInfo && Object.keys(extractedInfo).length > 0) {
          await this._updateTripWithExtractedInfo(trip._id, extractedInfo);
          responseContent += '\n\n✅ Đã cập nhật thông tin chuyến đi!';
        }

      } else {
        // General chat without trip context
        responseContent = await this._handleGeneralChat(message);
      }

      const processingTime = Date.now() - startTime;

      // Log interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt: message,
        responseContent,
        tokensUsed,
        processingTime,
        success: true,
        metadata: {
          hasTripId: !!context.tripId,
          hasTrip: !!trip
        }
      });

      return {
        message: responseContent,
        model,
        tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1,
        workflow: {
          hasTrip: !!trip,
          infoComplete: trip ? this._analyzeMissingTripInfo(trip).length === 0 : false
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Log failed interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt: message,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Analyze what information is missing from the trip
   * @param {Object} trip - Trip data
   * @returns {Array} Array of missing information fields
   */
  _analyzeMissingTripInfo(trip) {
    const missing = [];

    if (!trip.destination?.destination) missing.push('destination');
    if (!trip.destination?.startDate) missing.push('startDate');
    if (!trip.destination?.endDate) missing.push('endDate');
    if (!trip.travelers?.adults || trip.travelers.adults === 0) missing.push('travelers');
    if (!trip.budget?.total || trip.budget.total === 0) missing.push('budget');

    return missing;
  }

  /**
   * Ask user for missing information
   * @param {string} message - User message
   * @param {Object} trip - Trip data
   * @param {Array} missingInfo - Missing information fields
   * @returns {Promise<string>} Response asking for missing info
   */
  async _askForMissingInfo(message, trip, missingInfo) {
    const fieldNames = {
      destination: 'điểm đến',
      startDate: 'ngày khởi hành',
      endDate: 'ngày kết thúc',
      travelers: 'số lượng người',
      budget: 'ngân sách'
    };

    let response = `Đã nhận thông tin chuyến đi "${trip.name}". `;

    if (missingInfo.length > 0) {
      response += `Để tạo lịch trình hoàn chỉnh, tôi cần thêm thông tin:\n`;
      missingInfo.forEach(field => {
        response += `• ${fieldNames[field] || field}\n`;
      });
      response += `\nBạn có thể cho tôi biết thêm không?`;
    }

    return response;
  }

  /**
   * Provide response when trip information is complete
   * @param {string} message - User message
   * @param {Object} trip - Trip data
   * @returns {Promise<string>} Helpful response
   */
  async _provideCompleteTripResponse(message, trip) {
    return `Chuyến đi "${trip.name}" của bạn đã có đủ thông tin! 🎉\n\n📅 Thời gian: ${new Date(trip.destination.startDate).toLocaleDateString('vi-VN')} - ${new Date(trip.destination.endDate).toLocaleDateString('vi-VN')}\n📍 Điểm đến: ${trip.destination.destination}\n👥 Số người: ${trip.travelers.adults} người lớn${trip.travelers.children ? `, ${trip.travelers.children} trẻ em` : ''}\n💰 Ngân sách: ${trip.budget.total.toLocaleString()} ${trip.budget.currency}\n\nBạn có muốn tôi tạo lịch trình chi tiết không?`;
  }

  /**
   * Handle general chat without trip context
   * @param {string} message - User message
   * @returns {Promise<string>} General response
   */
  async _handleGeneralChat(message) {
    return `Xin chào! Tôi có thể giúp bạn lập kế hoạch du lịch. Bạn muốn đi đâu và khi nào?`;
  }

  /**
   * Extract trip information from user message
   * @param {string} message - User message
   * @param {Object} trip - Current trip data
   * @returns {Promise<Object>} Extracted information
   */
  async _extractTripInfoFromMessage(message, trip) {
    // Simple extraction logic - can be enhanced with AI
    const extractedInfo = {};
    const lowerMessage = message.toLowerCase();

    // Extract budget (simple pattern matching)
    const budgetMatch = message.match(/(\d+(?:\.\d+)?)\s*(triệu|tr|k|vnd|usd|đ)/i);
    if (budgetMatch && !trip.budget?.total) {
      const amount = parseFloat(budgetMatch[1]);
      const currency = budgetMatch[2].toLowerCase();
      extractedInfo.budget = {
        total: currency.includes('triệu') || currency.includes('tr') ? amount * 1000000 : amount,
        currency: currency.includes('usd') ? 'USD' : 'VND'
      };
    }

    // Extract number of travelers
    const travelerMatch = message.match(/(\d+)\s*người/i);
    if (travelerMatch && (!trip.travelers?.adults || trip.travelers.adults === 0)) {
      extractedInfo.travelers = {
        adults: parseInt(travelerMatch[1]),
        children: 0,
        infants: 0
      };
    }

    return extractedInfo;
  }

  /**
   * Update trip with extracted information
   * @param {string} tripId - Trip ID
   * @param {Object} extractedInfo - Information to update
   * @returns {Promise<void>}
   */
  async _updateTripWithExtractedInfo(tripId, extractedInfo) {
    const updateData = {};

    if (extractedInfo.budget) {
      updateData.budget = extractedInfo.budget;
    }

    if (extractedInfo.travelers) {
      updateData.travelers = extractedInfo.travelers;
    }

    if (Object.keys(updateData).length > 0) {
      await Trip.findByIdAndUpdate(tripId, updateData);
    }
  }

}

module.exports = AIChatService;
