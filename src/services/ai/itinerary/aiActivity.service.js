const AIBaseService = require('../core/aiBase.service');
const AISchemaService = require('../utils/aiSchema.service');

/**
 * AIActivityService - Handles activity-related AI operations
 * Focuses on activity suggestions and recommendations
 */
class AIActivityService extends AIBaseService {
  constructor() {
    super();
    this.schemaService = new AISchemaService();
  }

  /**
   * Generate activity suggestions with structured output
   * @param {string} userId - User ID
   * @param {Object} suggestionData - Suggestion parameters
   * @returns {Promise<Object>} Structured suggestions
   */
  async generateActivitySuggestions(userId, suggestionData) {
    try {
      let trip = null;

      // Get trip data if tripId is provided
      if (suggestionData.tripId) {
        const { Trip } = require('../../../models/trips');
        trip = await Trip.findById(suggestionData.tripId);

        if (!trip) {
          throw new Error('TRIP_NOT_FOUND');
        }

        if (!trip.isOwnedBy(userId)) {
          throw new Error('TRIP_ACCESS_DENIED');
        }
      }

      console.log('Generating structured activity suggestions...');

      // Create activity suggestion schema
      const suggestionSchema = this.schemaService.createArraySchema(
        this.schemaService.templates.activitySuggestion,
        { minItems: 1, maxItems: 10 }
      );

      // Build prompt for activity suggestions
      const prompt = this._buildActivitySuggestionPrompt(suggestionData, trip);

      // Call Gemini with structured output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'flash',
        prompt,
        suggestionSchema
      );

      // Process structured response
      const structuredData = response.isStructured ? response.content :
        this.responseParser.extractStructuredData(
          response.content,
          'json',
          suggestionSchema.responseSchema
        );

      // Save suggestions to trip if tripId is provided
      if (trip) {
        if (!trip.activitySuggestions) {
          trip.activitySuggestions = [];
        }
        trip.activitySuggestions.push({
          timestamp: new Date(),
          date: suggestionData.date,
          timePeriod: suggestionData.timePeriod,
          suggestions: structuredData
        });
        await trip.save();
      }

      console.log('Structured activity suggestions generated successfully!');

      return {
        suggestions: structuredData,
        tokensUsed: response.tokensUsed,
        processingTime: response.processingTime || 0,
        rateLimitRemaining: response.rateLimitRemaining || 0
      };

    } catch (error) {
      console.error('Generate activity suggestions error:', error);
      throw error;
    }
  }

  /**
   * Classify content using enum structured output
   * @param {string} content - Content to classify
   * @param {Array} categories - Array of possible categories
   * @returns {Promise<string>} Classification result
   */
  async classifyWithEnum(content, categories) {
    try {
      console.log(' Classifying content with enum...');

      // Create enum schema
      const enumSchema = this.schemaService.createEnumSchema(categories);

      // Build classification prompt
      const prompt = `Please classify the following content into one of these categories: ${categories.join(', ')}\n\nContent: ${content}`;

      // Call Gemini with enum output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'flash',
        prompt,
        enumSchema
      );

      // Process enum response
      const classification = response.isStructured ? response.content :
        this.responseParser.extractStructuredData(
          response.content,
          'enum',
          enumSchema.responseSchema
        );

      console.log(`Content classified as: ${classification}`);

      return {
        classification,
        confidence: 0.9,
        tokensUsed: response.tokensUsed
      };

    } catch (error) {
      console.error('Classification error:', error);
      throw error;
    }
  }

  /**
   * Build activity suggestion prompt
   * @private
   * @param {Object} suggestionData - Suggestion parameters
   * @param {Object} trip - Trip object (optional)
   * @returns {string} Generated prompt
   */
  _buildActivitySuggestionPrompt(suggestionData, trip = null) {
    const {
      destination,
      date,
      timePeriod,
      interests = [],
      budget,
      travelers
    } = suggestionData;

    let prompt = `Gợi ý các hoạt động thú vị tại ${destination || (trip ? trip.destination.destination : 'địa điểm này')}`;

    if (date) {
      prompt += ` vào ngày ${date}`;
    }

    if (timePeriod) {
      const timeMap = {
        'morning': 'buổi sáng',
        'afternoon': 'buổi chiều',
        'evening': 'buổi tối',
        'night': 'ban đêm'
      };
      prompt += ` ${timeMap[timePeriod] || timePeriod}`;
    }

    prompt += '.\n\n';

    if (interests && interests.length > 0) {
      prompt += `Sở thích: ${interests.join(', ')}\n`;
    }

    if (budget) {
      prompt += `Ngân sách: ${budget.toLocaleString()} VND\n`;
    }

    if (travelers) {
      prompt += `Số người: ${travelers.adults || 1} người lớn`;
      if (travelers.children > 0) {
        prompt += `, ${travelers.children} trẻ em`;
      }
      prompt += '\n';
    }

    prompt += `
Vui lòng gợi ý 5-8 hoạt động phù hợp bằng tiếng Việt, bao gồm:
- Tên hoạt động rõ ràng
- Mô tả chi tiết và hấp dẫn
- Phân loại hoạt động
- Thời lượng dự kiến (phút)
- Chi phí ước tính (VND)
- Địa điểm cụ thể
- Thời gian trong ngày phù hợp
- Mức độ ưu tiên
- Các tag liên quan

Tập trung vào những trải nghiệm địa phương độc đáo và phù hợp với sở thích đã nêu.`;

    return prompt;
  }
}

module.exports = AIActivityService;
