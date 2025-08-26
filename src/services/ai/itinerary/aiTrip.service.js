const AIBaseService = require('../core/aiBase.service');
const AISchemaService = require('../utils/aiSchema.service');

/**
 * AITripService - Handles trip-specific AI operations
 * Focuses on trip generation using multi-step approach
 */
class AITripService extends AIBaseService {
  constructor() {
    super();
    this.schemaService = new AISchemaService();
  }

  /**
   * Generate trip itinerary using multi-step approach
   */
  async generateItinerary(userId, tripId, options = {}) {
    try {
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
        return {
          itinerary: trip.itinerary.days,
          tokensUsed: 0,
          processingTime: 0,
          rateLimitRemaining: 0,
          status: 'exists',
          message: 'Itinerary already exists for this trip'
        };
      }

      // Use multi-step generation
      const result = await this.generateStructuredItinerary(userId, tripId, options);

      // Save itinerary to database
      if (result.itinerary && result.itinerary.length > 0) {
        const tipsToSave = result.tips && Array.isArray(result.tips) ? result.tips : [
          { category: 'general', title: 'Đặt phòng trước', content: 'Đặt phòng khách sạn và hoạt động trước để có giá tốt nhất và đảm bảo chỗ.' },
          { category: 'weather', title: 'Chuẩn bị trang phục', content: 'Mang theo kem chống nắng, mũ nón và nước uống để bảo vệ sức khỏe.' },
          { category: 'culture', title: 'Học tiếng Việt cơ bản', content: 'Học một vài từ tiếng Việt cơ bản để giao tiếp với người dân địa phương.' },
          { category: 'food', title: 'Thử món ăn đường phố', content: 'Thử các món ăn đường phố đặc trưng của vùng miền để trải nghiệm văn hóa ẩm thực.' },
          { category: 'transportation', title: 'Sử dụng Grab', content: 'Sử dụng ứng dụng Grab hoặc taxi để di chuyển an toàn và tiện lợi.' }
        ];

        trip.itinerary = {
          destination: trip.destination.destination,
          overview: `Lịch trình ${trip.duration} ngày tại ${trip.destination.destination} được tạo bởi AI`,
          days: result.itinerary,
          totalCost: trip.budget?.total || 0,
          tips: tipsToSave
        };
        trip.status = 'completed';
        await trip.save();
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
      throw error;
    }
  }

  /**
   * Generate structured itinerary using multi-step approach
   */
  async generateStructuredItinerary(userId, tripId, options = {}) {
    try {
      const { Trip } = require('../../../models/trips');
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }

      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Calculate actual dates for the trip
      const startDate = new Date(trip.destination.startDate);
      const actualDates = [];
      for (let i = 0; i < trip.duration; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        actualDates.push(date.toISOString().split('T')[0]);
      }

      // Use multi-step service
      const MultiStepItineraryService = require('./multiStepItinerary.service');
      const multiStepService = new MultiStepItineraryService(this.apiClient, this.schemaService);

      const tripData = {
        destination: trip.destination,
        duration: trip.duration,
        dates: actualDates,
        budget: trip.budget,
        travelers: trip.travelers
      };

      // Generate using multi-step approach
      const result = await multiStepService.generateDetailedItinerary(tripData, options);

      return {
        itinerary: result.days || [],
        tokensUsed: result.tokensUsed,
        processingTime: 0,
        rateLimitRemaining: 0,
        tips: result.tips || [],
        approach: result.approach
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = AITripService;
