const AIBaseService = require('../core/aiBase.service');
const AISchemaService = require('../utils/aiSchema.service');

/**
 * AITripService - Handles trip-specific AI operations
 * Focuses on trip generation, optimization, and management
 */
class AITripService extends AIBaseService {
  constructor() {
    super();
    this.schemaService = new AISchemaService();
  }

  /**
   * Generate trip itinerary using structured output
   */
  async generateItinerary(userId, tripId, options = {}) {
    try {
      // Get trip data from database
      const { Trip } = require('../../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Check if trip already has a complete itinerary
      if (trip.itinerary && trip.itinerary.days && trip.itinerary.days.length > 0) {
        console.log('ℹ Trip already has itinerary, returning existing data...');
        return {
          itinerary: trip.itinerary.days,
          tokensUsed: 0,
          processingTime: 0,
          rateLimitRemaining: 0,
          status: 'exists',
          message: 'Itinerary already exists for this trip'
        };
      }

      console.log('🎯 Generating itinerary with AI...');

      // Use structured output approach
      const result = await this.generateStructuredItinerary(userId, tripId, options);

      // Save itinerary to database
      if (result.itinerary && result.itinerary.length > 0) {
        trip.itinerary = {
          destination: trip.destination.destination,
          overview: `Lịch trình ${trip.duration} ngày tại ${trip.destination.destination} được tạo bởi AI`,
          days: result.itinerary,
          totalCost: trip.budget?.total || 0,
          tips: result.tips || [
            'Đặt phòng khách sạn và hoạt động trước để có giá tốt nhất',
            'Mang theo kem chống nắng, mũ nón và nước uống',
            'Học một vài từ tiếng Việt cơ bản để giao tiếp với người dân địa phương',
            'Thử các món ăn đường phố đặc trưng của vùng miền',
            'Sử dụng ứng dụng Grab hoặc taxi để di chuyển an toàn'
          ]
        };
        trip.status = 'completed';
        await trip.save();

        console.log('✅ Itinerary saved to database successfully!');
      }

      return {
        itinerary: result.itinerary,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime,
        rateLimitRemaining: result.rateLimitRemaining,
        status: 'success',
        saved: true
      };

    } catch (error) {
      console.error('Generate itinerary error:', error);
      throw error;
    }
  }

  /**
   * Generate structured itinerary using predefined schema
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Structured itinerary response
   */
  async generateStructuredItinerary(userId, tripId, options = {}) {
    try {
      // Get trip data
      const { Trip } = require('../../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      console.log('🔧 Generating structured itinerary...');

      // Calculate actual dates for the trip
      const startDate = new Date(trip.destination.startDate);
      const actualDates = [];
      for (let i = 0; i < trip.duration; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        actualDates.push(date.toISOString().split('T')[0]);
      }

      console.log('📅 Trip dates calculated:', actualDates);

      // Create itinerary schema
      const itinerarySchema = this.schemaService.createItinerarySchema(trip.duration || 3, actualDates);

      // Build prompt with VND currency support
      const currency = trip.budget?.currency || 'VND';
      const budgetText = trip.budget?.total ?
        `Budget: ${trip.budget.total.toLocaleString()} ${currency}` : '';

      const prompt = `Tạo lịch trình ${trip.duration} ngày cho ${trip.destination.destination} từ ${actualDates[0]} đến ${actualDates[actualDates.length - 1]}.
      ${budgetText}

      QUAN TRỌNG: Sử dụng ĐÚNG các ngày này cho mỗi ngày: ${actualDates.join(', ')}

      Yêu cầu trả về bằng tiếng Việt, bao gồm:
      - Các hoạt động hàng ngày với thời gian, tiêu đề, mô tả chi tiết, địa chỉ cụ thể, thời lượng, chi phí, và ghi chú hữu ích
      - Địa chỉ chi tiết và tên địa điểm cụ thể
      - Ghi chú thực tế như: cách di chuyển, thời gian tốt nhất, lưu ý đặc biệt, kinh nghiệm du lịch
      - Giá cả thực tế cho địa điểm Việt Nam (VD: ăn uống 50,000-200,000 VND, hoạt động 100,000-500,000 VND)

      Cuối cùng, thêm phần tips du lịch hữu ích.

      Trả về dưới dạng JSON với cấu trúc ĐÚNG như sau:
      {
        "days": [
          {
            "date": "${actualDates[0]}",
            "activities": [
              {
                "time": "09:00",
                "title": "Tên hoạt động",
                "description": "Mô tả chi tiết bằng tiếng Việt",
                "location": "Tên địa điểm cụ thể, Địa chỉ đầy đủ",
                "duration": 120,
                "cost": 0,
                "category": "cultural",
                "notes": "Ghi chú hữu ích bằng tiếng Việt"
              }
            ]
          }
        ],
        "tips": [
          "Mẹo du lịch 1",
          "Mẹo du lịch 2",
          "Mẹo du lịch 3"
        ]
      }`;

      console.log('📝 Prompt length:', prompt.length, 'characters');
      console.log('📋 Schema configuration:', {
        type: itinerarySchema.responseSchema?.type,
        mimeType: itinerarySchema.responseMimeType,
        maxItems: itinerarySchema.responseSchema?.maxItems
      });

      // Call Gemini with structured output
      const response = await this.apiClient.callGeminiWithStructuredOutput(
        'pro',
        prompt,
        itinerarySchema,
        options
      );

      // Check if API response is valid
      if (!response || !response.content) {
        console.error('❌ Gemini API returned empty response');
        throw new Error('GEMINI_API_NO_RESPONSE');
      }

      // Check for error messages in response
      if (typeof response.content === 'string' && 
          (response.content.includes('No content generated') || 
           response.content.includes('error') || 
           response.content.trim() === '')) {
        console.error('❌ Gemini API returned error or empty content:', response.content);
        throw new Error(`GEMINI_API_ERROR: ${response.content}`);
      }

      // Transform response to match Mongoose schema
      let structuredData;
      
      try {
        structuredData = response.isStructured ? response.content :
          JSON.parse(response.content);
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response as JSON:', response.content);
        console.error('Parse error:', parseError.message);
        
        // Try to use responseParser as fallback
        try {
          console.log('🔄 Attempting fallback parsing...');
          structuredData = this.responseParser.processItineraryResponse(response.content, trip);
        } catch (fallbackError) {
          console.error('❌ Fallback parsing also failed:', fallbackError.message);
          
          // Final fallback: Use template service to generate a basic itinerary
          console.log('🔄 Using template service as final fallback...');
          try {
            structuredData = this.templateService.generateTemplateBasedItinerary(trip);
            console.log('✅ Template-based itinerary generated successfully');
          } catch (templateError) {
            console.error('❌ Template service also failed:', templateError.message);
            throw new Error(`ALL_FALLBACKS_FAILED: JSON parsing failed, responseParser failed, template service failed. Original error: ${parseError.message}`);
          }
        }
      }

      console.log('🔄 Transforming Gemini response to Mongoose format...');
      structuredData = this._transformGeminiToMongoose(structuredData);

      // Extract tips from response
      const tips = structuredData.tips || [
        'Đặt phòng khách sạn và hoạt động trước để có giá tốt nhất',
        'Mang theo kem chống nắng, mũ nón và nước uống',
        'Học một vài từ tiếng Việt cơ bản để giao tiếp với người dân địa phương',
        'Thử các món ăn đường phố đặc trưng của vùng miền',
        'Sử dụng ứng dụng Grab hoặc taxi để di chuyển an toàn'
      ];

      // Validate structure if responseParser is available
      if (this.responseParser && this.responseParser.validateItinerary) {
        try {
          const validation = this.responseParser.validateItinerary(structuredData, trip);
          if (!validation.ok) {
            console.warn('⚠️ Itinerary validation warnings:', validation.issues);
          }
        } catch (validationError) {
          console.warn('⚠️ Validation failed, but continuing:', validationError.message);
        }
      } else {
        console.warn('⚠️ ResponseParser not available for validation');
      }

      console.log('✅ Structured itinerary generated successfully!');

      return {
        itinerary: structuredData,
        tokensUsed: response.tokensUsed,
        processingTime: response.processingTime || 0,
        rateLimitRemaining: response.rateLimitRemaining || 0,
        tips: tips
      };

    } catch (error) {
      console.error('Generate structured itinerary error:', error);
      throw error;
    }
  }

  /**
   * Transform Gemini response to Mongoose format
   * @param {Object} geminiData - Raw response from Gemini
   * @returns {Array} Transformed data matching Mongoose schema
   */
  _transformGeminiToMongoose(geminiData) {
    console.log('🔄 Transforming Gemini format to Mongoose format...');

    // Handle both old format (direct array) and new format (with days property)
    const days = geminiData.days || geminiData;

    const result = Array.isArray(days) ? days.map(day => ({
      date: day.date,
      activities: day.activities.map(activity => ({
        time: activity.time,
        title: activity.title,
        description: activity.description || '',
        location: {
          name: typeof activity.location === 'string' ? activity.location : activity.location?.name || activity.title,
          address: typeof activity.location === 'object' ? activity.location?.address || activity.location : `${activity.title} location`
        },
        duration: activity.duration || 120,
        cost: activity.cost || 0,
        category: this._mapCategoryToEnum(activity.category),
        notes: activity.notes || ''
      }))
    })) : [];

    // Attach tips to result for later use
    result.tips = geminiData.tips || [];

    return result;
  }

  /**
   * Map AI-generated category to valid enum values
   * @param {string} aiCategory - Category from AI
   * @returns {string} Valid enum category
   */
  _mapCategoryToEnum(aiCategory) {
    if (!aiCategory) return 'cultural';

    const normalized = aiCategory.toLowerCase().trim();

    const categoryMap = {
      // English categories
      'cultural': 'cultural', 'culture': 'cultural', 'historical': 'cultural',
      'museum': 'cultural', 'temple': 'cultural', 'pagoda': 'cultural',
      'church': 'cultural', 'cathedral': 'cultural',

      'food': 'food', 'restaurant': 'food', 'cafe': 'food', 'coffee': 'food',
      'meal': 'food', 'dining': 'food', 'cuisine': 'food', 'snack': 'food',

      'nature': 'nature', 'beach': 'nature', 'park': 'nature', 'mountain': 'nature',
      'scenery': 'nature', 'landscape': 'nature', 'outdoor': 'nature', 'natural': 'nature',

      'shopping': 'shopping', 'market': 'shopping', 'mall': 'shopping',
      'boutique': 'shopping', 'store': 'shopping',

      'adventure': 'adventure', 'sport': 'adventure', 'sports': 'adventure',
      'hiking': 'adventure', 'trekking': 'adventure',

      'nightlife': 'nightlife', 'night': 'nightlife', 'bar': 'nightlife',
      'club': 'nightlife', 'entertainment': 'nightlife',

      'relaxation': 'relaxation', 'relax': 'relaxation', 'spa': 'relaxation',
      'massage': 'relaxation', 'wellness': 'relaxation', 'leisure': 'relaxation',

      'transportation': 'transportation', 'transport': 'transportation',
      'travel': 'transportation', 'bus': 'transportation', 'taxi': 'transportation',

      'accommodation': 'accommodation', 'hotel': 'accommodation',
      'resort': 'accommodation', 'stay': 'accommodation', 'lodging': 'accommodation',

      // Tiếng Việt categories
      'văn hóa': 'cultural', 'lịch sử': 'cultural', 'di tích': 'cultural',
      'đền': 'cultural', 'chùa': 'cultural', 'nhà thờ': 'cultural', 'bảo tàng': 'cultural',
      
      'ẩm thực': 'food', 'đồ ăn': 'food', 'quán ăn': 'food', 'cà phê': 'food',
      'bữa ăn': 'food', 'món ăn': 'food', 'ăn vặt': 'food',
      
      'thiên nhiên': 'nature', 'bãi biển': 'nature', 'công viên': 'nature',
      'núi': 'nature', 'phong cảnh': 'nature', 'ngoài trời': 'nature',
      
      'mua sắm': 'shopping', 'chợ': 'shopping', 'trung tâm thương mại': 'shopping',
      'cửa hàng': 'shopping',
      
      'phiêu lưu': 'adventure', 'thể thao': 'adventure', 'leo núi': 'adventure', 'đi bộ': 'adventure',
      
      'giải trí đêm': 'nightlife', 'quán bar': 'nightlife', 'câu lạc bộ': 'nightlife', 'vui chơi': 'nightlife',
      
      'nghỉ ngơi': 'relaxation', 'thư giãn': 'relaxation', 'sức khỏe': 'relaxation',
      
      'giao thông': 'transportation', 'di chuyển': 'transportation', 'du lịch': 'transportation',
      'xe buýt': 'transportation',
      
      'khách sạn': 'accommodation', 'lưu trú': 'accommodation',

      // Default fallbacks
      'sightseeing': 'cultural', 'landmark': 'cultural', 'attraction': 'cultural',
      'tour': 'cultural', 'visit': 'cultural', 'exploration': 'cultural',
      'experience': 'cultural', 'thăm quan': 'cultural', 'khám phá': 'cultural',
      'trải nghiệm': 'cultural'
    };

    return categoryMap[normalized] || 'cultural';
  }
}

module.exports = AITripService;
