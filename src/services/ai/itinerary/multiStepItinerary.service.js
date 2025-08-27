const { getAIProvider } = require('../core/aiProvider.service');

/**
 * Multi-step itinerary generation service
 * Breaks down complex itinerary requests into manageable chunks
 * Now supports multiple AI providers through AIProviderService
 */
class MultiStepItineraryService {
  constructor(apiClient = null, schemaService) {
    // Use AIProviderService for modern provider-agnostic approach
    this.aiProvider = getAIProvider();
    this.schemaService = schemaService;
    
    // Keep backward compatibility with old geminiClient parameter
    if (apiClient) {
      console.log('Using legacy client parameter for backward compatibility');
      this.legacyClient = apiClient;
    }
    
    console.log(`MultiStepItineraryService initialized with ${this.aiProvider.getProviderName().toUpperCase()} provider`);
  }

  /**
   * Generate itinerary using multi-step approach
   * Step 1: Generate skeleton (overview + basic activities)
   * Step 2: Enhance each day with detailed descriptions
   */
  async generateDetailedItinerary(tripData, options = {}) {
    try {
      const { destination, duration, dates, budget, travelers } = tripData;
      
      // Step 1: Generate skeleton itinerary (lightweight)
      const skeleton = await this.generateSkeleton(tripData);
      
      // Step 2: Enhance each day with details (parallel processing)
      const detailedDays = await this.enhanceWithDetails(skeleton, tripData);
      
      // Step 3: Generate travel tips
      const tips = await this.generateTips(tripData);
      
      const totalTokens = skeleton.tokensUsed + 
        detailedDays.reduce((sum, day) => sum + day.tokensUsed, 0) + 
        tips.tokensUsed;
      
      return {
        days: detailedDays.map(day => day.content),
        itinerary: detailedDays.map(day => day.content), // For backward compatibility
        tips: tips.content, // This should be the array from generateTips
        tokensUsed: totalTokens,
        processingSteps: 3,
        approach: 'multi-step'
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Step 1: Generate basic skeleton with time slots and activity names
   */
  async generateSkeleton(tripData) {
    const { destination, duration, dates, budget } = tripData;
    
    const skeletonSchema = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            date: { type: 'STRING' },
            activities: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  time: { type: 'STRING' },
                  title: { type: 'STRING' },
                  location: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING' },
                      address: { type: 'STRING' }
                    },
                    required: ['name']
                  },
                  duration: { type: 'INTEGER' },
                  cost: { type: 'NUMBER' },
                  category: { type: 'STRING' }
                },
                required: ['time', 'title', 'location', 'category']
              },
              minItems: 4,
              maxItems: 8
            }
          },
          required: ['date', 'activities']
        }
      }
    };

    const skeletonPrompt = `Tạo khung lịch trình ${duration} ngày cho chuyến du lịch ${destination.destination}.

Thông tin chuyến đi:
- Ngày: ${dates.join(', ')}
- Budget: ${budget?.total ? budget.total.toLocaleString() + ' ' + budget.currency : 'Linh hoạt'}

Yêu cầu:
- Mỗi ngày 4-8 hoạt động
- Thông tin cơ bản: time, title, location (name + address), duration, cost, category
- Thời gian: 7:00-22:00
- Categories: cultural, food, shopping, nature, adventure, relaxation, nightlife, transportation
- Location format: {"name": "Tên địa điểm", "address": "Địa chỉ đầy đủ"}
- Tất cả nội dung bằng tiếng Việt

Trả về JSON array.`;

    console.log(` Skeleton prompt length: ${skeletonPrompt.length}`);
    console.log(` Using ${this.aiProvider.getProviderName().toUpperCase()} provider for skeleton generation`);
    
    // Use AIProviderService for provider-agnostic API calls
    if (this.legacyClient) {
      // Backward compatibility mode
      return await this.legacyClient.callGeminiWithStructuredOutput(
        'flash',
        skeletonPrompt,
        skeletonSchema
      );
    } else {
      // Modern provider-agnostic mode
      return await this.aiProvider.callStructuredAPI(
        'flash',
        skeletonPrompt,
        skeletonSchema
      );
    }
  }

  /**
   * Step 2: Enhance each day with detailed descriptions
   */
  async enhanceWithDetails(skeleton, tripData) {
    const { destination, travelers } = tripData;
    
    // Validate skeleton response
    if (!skeleton || !skeleton.content) {
      throw new Error('Invalid skeleton response - no content found');
    }
    
    // Ensure content is an array
    const skeletonData = Array.isArray(skeleton.content) ? skeleton.content : [skeleton.content];
    
    if (skeletonData.length === 0) {
      throw new Error('Skeleton response contains no days');
    }
    
    // Process each day in parallel (but limit concurrency to avoid rate limits)
    const enhancedDays = [];
    
    for (let i = 0; i < skeletonData.length; i++) {
      const day = skeletonData[i];
      console.log(`Enhancing day ${i + 1}: ${day?.date || 'unknown date'}`);
      
      const enhancedDay = await this.enhanceSingleDay(day, destination, travelers);
      enhancedDays.push(enhancedDay);
      
      // Add small delay to avoid rate limiting
      if (i < skeletonData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return enhancedDays;
  }

  /**
   * Enhance a single day with detailed descriptions
   */
  async enhanceSingleDay(dayData, destination, travelers) {
    // Validate input data
    if (!dayData || !dayData.date || !dayData.activities) {
      console.warn(' Invalid day data:', dayData);
      throw new Error(`Invalid day data: missing date or activities`);
    }
    
    if (!Array.isArray(dayData.activities) || dayData.activities.length === 0) {
      console.warn('No activities found for day:', dayData.date);
      throw new Error(`No activities found for day ${dayData.date}`);
    }
    
    const detailSchema = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING' },
          activities: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                time: { type: 'STRING' },
                title: { type: 'STRING' },
                description: { type: 'STRING' },
                location: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    address: { type: 'STRING' }
                  },
                  required: ['name']
                },
                duration: { type: 'INTEGER' },
                cost: { type: 'NUMBER' },
                category: { type: 'STRING' },
                notes: { type: 'STRING' }
              },
              required: ['time', 'title', 'description', 'location', 'duration', 'cost', 'category', 'notes']
            }
          }
        },
        required: ['date', 'activities']
      }
    };

    const activities = dayData.activities.map(act => 
      `${act.time} - ${act.title} tại ${act.location?.name || act.location} (${act.category})`
    ).join('\n');

    const detailPrompt = `Bổ sung mô tả chi tiết cho ngày ${dayData.date} tại ${destination.destination}:

${activities}

Yêu cầu cho mỗi hoạt động:
- Description: 50-80 từ tiếng Việt (điểm nổi bật, trải nghiệm)
- Notes: 20-40 từ tiếng Việt (tips thực tế, giờ mở cửa)
- Giữ nguyên: time, title, location object, duration, cost, category
- Location format: {"name": "Tên địa điểm", "address": "Địa chỉ đầy đủ"}
- Phù hợp cho ${travelers.adults} người lớn, ${travelers.children || 0} trẻ em
- Tất cả nội dung bằng tiếng Việt

Trả về JSON đầy đủ.`;

    console.log(`Using ${this.aiProvider.getProviderName().toUpperCase()} provider for day enhancement`);
    
    // Use AIProviderService for provider-agnostic API calls
    if (this.legacyClient) {
      // Backward compatibility mode
      return await this.legacyClient.callGeminiWithStructuredOutput(
        'flash',
        detailPrompt,
        detailSchema
      );
    } else {
      // Modern provider-agnostic mode
      return await this.aiProvider.callStructuredAPI(
        'flash',
        detailPrompt,
        detailSchema
      );
    }
  }

  /**
   * Step 3: Generate travel tips
   */
  async generateTips(tripData) {
    const { destination, duration, budget, travelers } = tripData;
    
    const tipsSchema = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            category: { 
              type: 'STRING',
              enum: ['general', 'transportation', 'accommodation', 'food', 'culture', 'safety', 'budget', 'weather']
            },
            title: { type: 'STRING' },
            content: { type: 'STRING' }
          },
          required: ['category', 'title', 'content']
        },
        minItems: 6,
        maxItems: 10
      }
    };

    const tipsPrompt = `Tạo danh sách tips du lịch thực tế cho chuyến đi ${duration} ngày tại ${destination.destination}.
    
Thông tin chuyến đi:
- Budget: ${budget?.total ? budget.total.toLocaleString() + ' ' + budget.currency : 'Linh hoạt'}
- Số người: ${travelers.adults} người lớn, ${travelers.children || 0} trẻ em

Tạo 6-10 tips thực tế cho các categories:
- transportation: Giao thông, di chuyển
- food: Ẩm thực, nhà hàng
- accommodation: Nơi ở, khách sạn  
- culture: Văn hóa, phong tục
- safety: An toàn, sức khỏe
- budget: Tiết kiệm chi phí
- weather: Thời tiết, trang phục
- general: Tips chung

Format: {"category": "...", "title": "...", "content": "..."}
Title: 5-10 từ
Content: 1-2 câu thực tế, hữu ích
Tất cả bằng tiếng Việt.`;

    console.log(`Using ${this.aiProvider.getProviderName().toUpperCase()} provider for tips generation`);
    
    // Use AIProviderService for provider-agnostic API calls
    if (this.legacyClient) {
      // Backward compatibility mode
      return await this.legacyClient.callGeminiWithStructuredOutput(
        'flash',
        tipsPrompt,
        tipsSchema
      );
    } else {
      // Modern provider-agnostic mode
      return await this.aiProvider.callStructuredAPI(
        'flash',
        tipsPrompt,
        tipsSchema
      );
    }
  }
}

module.exports = MultiStepItineraryService;
