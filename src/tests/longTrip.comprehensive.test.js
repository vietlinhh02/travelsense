const LongTripHandler = require('../../src/services/ai/longTripHandler');
const GeminiService = require('../../src/services/ai/gemini.service');

describe('Long Trip Handling', () => {
  let longTripHandler;
  let mockTrip;

  beforeEach(() => {
    longTripHandler = new LongTripHandler();
    
    // Mock a very long trip (21 days)
    mockTrip = {
      _id: 'trip_long_21_days',
      name: 'Extended Europe Tour',
      duration: 21,
      destination: {
        origin: 'New York',
        destination: 'Europe Multi-City',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-21')
      },
      travelers: {
        adults: 2,
        children: 0,
        infants: 0
      },
      budget: {
        total: 8000,
        currency: 'USD'
      },
      preferences: {
        interests: ['cultural', 'food', 'nature'],
        constraints: ['no_late_nights']
      }
    };
  });

  describe('Trip Analysis', () => {
    it('should detect long trips requiring chunking', () => {
      const analysis = longTripHandler.analyzeTrip(mockTrip);
      
      expect(analysis.needsChunking).toBe(true);
      expect(analysis.strategy).toBe('progressive_chunking');
      expect(analysis.chunks.length).toBeGreaterThanOrEqual(4); // arrival + middle chunks + departure
      expect(analysis.estimatedTokens).toBeGreaterThan(5000);
    });

    it('should not chunk short trips', () => {
      const shortTrip = { ...mockTrip, duration: 4 }; // Below any reasonable threshold
      const analysis = longTripHandler.analyzeTrip(shortTrip);
      
      expect(analysis.needsChunking).toBe(false);
      expect(analysis.strategy).toBe('single_generation');
      expect(analysis.chunks).toHaveLength(1);
    });

    it('should create appropriate chunks for different trip lengths', () => {
      // Test 15-day trip
      const mediumTrip = { ...mockTrip, duration: 15 };
      const analysis = longTripHandler.analyzeTrip(mediumTrip);
      
      expect(analysis.needsChunking).toBe(true);
      expect(analysis.chunks.length).toBeGreaterThanOrEqual(3); // arrival + middle chunks + departure
      
      // Check chunk structure
      const arrivalChunk = analysis.chunks.find(c => c.id === 'arrival');
      expect(arrivalChunk.priority).toBe('high');
      expect(arrivalChunk.detailLevel).toBe('comprehensive');
      
      const departureChunk = analysis.chunks.find(c => c.id === 'departure');
      expect(departureChunk.priority).toBe('low');
      expect(departureChunk.detailLevel).toBe('simplified');
    });
  });

  describe('Chunk Generation', () => {
    it('should generate chunks with proper configuration', () => {
      const analysis = longTripHandler.analyzeTrip(mockTrip);
      const chunks = analysis.chunks;
      
      // Test arrival chunk
      const arrivalChunk = chunks[0];
      expect(arrivalChunk.id).toBe('arrival');
      expect(arrivalChunk.startDay).toBe(1);
      expect(arrivalChunk.endDay).toBe(2);
      expect(arrivalChunk.focus).toBe('arrival_orientation');
      expect(arrivalChunk.detailLevel).toBe('comprehensive');
      
      // Test middle chunks have variety
      const middleChunks = chunks.filter(c => c.id.startsWith('middle_'));
      const focuses = middleChunks.map(c => c.focus);
      const uniqueFocuses = new Set(focuses);
      expect(uniqueFocuses.size).toBeGreaterThan(1); // Should have variety
      
      // Test departure chunk
      const departureChunk = chunks[chunks.length - 1];
      expect(departureChunk.id).toBe('departure');
      expect(departureChunk.startDay).toBe(21);
      expect(departureChunk.endDay).toBe(21);
      expect(departureChunk.focus).toBe('departure_logistics');
    });

    it('should calculate correct date ranges for chunks', () => {
      const startDate = new Date('2024-06-01');
      const chunkStartDate = longTripHandler._calculateChunkStartDate(startDate, 5);
      
      expect(chunkStartDate.getDate()).toBe(5); // June 5th
      expect(chunkStartDate.getMonth()).toBe(5); // June (0-indexed)
    });
  });

  describe('Token Optimization', () => {
    it('should calculate appropriate token limits for different detail levels', () => {
      const comprehensiveChunk = { detailLevel: 'comprehensive' };
      const balancedChunk = { detailLevel: 'balanced' };
      const simplifiedChunk = { detailLevel: 'simplified' };
      
      const comprehensiveTokens = longTripHandler._calculateMaxTokensForChunk(comprehensiveChunk);
      const balancedTokens = longTripHandler._calculateMaxTokensForChunk(balancedChunk);
      const simplifiedTokens = longTripHandler._calculateMaxTokensForChunk(simplifiedChunk);
      
      expect(comprehensiveTokens).toBeGreaterThan(balancedTokens);
      expect(balancedTokens).toBeGreaterThan(simplifiedTokens);
      expect(simplifiedTokens).toBeGreaterThan(1000); // Minimum reasonable limit
    });

    it('should estimate total token usage for long trips', () => {
      // Test basic estimation without chunks
      const basicTokens = longTripHandler._estimateTokenUsage(21);
      expect(basicTokens).toBeGreaterThan(5000); // Should be more than simple 21 * 300
      expect(basicTokens).toBeLessThan(12000); // But reasonable upper bound
      
      // Test with actual trip context
      const complexTrip = {
        duration: 21,
        destination: { destination: 'Japan Multi-City Tour' } // High complexity
      };
      const complexTokens = longTripHandler._estimateTokenUsage(21, null, complexTrip);
      expect(complexTokens).toBeGreaterThan(basicTokens); // Should be higher for complex destination
    });
  });

  describe('Fallback Handling', () => {
    it('should generate fallback days when AI generation fails', () => {
      const chunk = {
        id: 'middle_1',
        startDay: 5,
        endDay: 9,
        focus: 'cultural_immersion',
        detailLevel: 'balanced'
      };
      
      const fallbackDays = longTripHandler._generateFallbackDays(mockTrip, chunk);
      
      expect(fallbackDays).toHaveLength(5); // 5 days in chunk
      expect(fallbackDays[0].activities).toHaveLength(1);
      expect(fallbackDays[0].activities[0].notes).toContain('Fallback activity');
    });

    it('should generate focus-specific fallback activities', () => {
      const responseParser = require('../../src/services/ai/responseParser');
      const parser = new responseParser();
      
      const culturalActivities = parser._getChunkFocusActivities('cultural_immersion', 'Paris');
      const foodActivities = parser._getChunkFocusActivities('food_discovery', 'Tokyo');
      
      expect(culturalActivities).toHaveLength(4);
      expect(foodActivities).toHaveLength(4);
      
      // Check activities are themed correctly
      const culturalTitles = culturalActivities.map(a => a.title.toLowerCase());
      expect(culturalTitles.some(title => title.includes('temple') || title.includes('museum'))).toBe(true);
      
      const foodTitles = foodActivities.map(a => a.title.toLowerCase());
      expect(foodTitles.some(title => title.includes('food') || title.includes('cooking'))).toBe(true);
    });
  });

  describe('Sophisticated Token Estimation', () => {
    it('should calculate different token estimates based on chunk detail levels', () => {
      const comprehensiveChunk = {
        id: 'arrival',
        startDay: 1,
        endDay: 2,
        detailLevel: 'comprehensive',
        focus: 'arrival_orientation'
      };
      
      const balancedChunk = {
        id: 'middle_1',
        startDay: 3,
        endDay: 7,
        detailLevel: 'balanced',
        focus: 'cultural_immersion'
      };
      
      const simplifiedChunk = {
        id: 'departure',
        startDay: 15,
        endDay: 15,
        detailLevel: 'simplified',
        focus: 'departure_logistics'
      };
      
      const trip = {
        destination: { destination: 'Tokyo, Japan' }
      };
      
      const comprehensiveTokens = longTripHandler._estimateChunkTokenUsage(comprehensiveChunk, trip);
      const balancedTokens = longTripHandler._estimateChunkTokenUsage(balancedChunk, trip);
      const simplifiedTokens = longTripHandler._estimateChunkTokenUsage(simplifiedChunk, trip);
      
      // Comprehensive should have highest tokens per day
      expect(comprehensiveTokens / 2).toBeGreaterThan(balancedTokens / 5); // Per day comparison
      expect(balancedTokens / 5).toBeGreaterThan(simplifiedTokens / 1);
      
      // All should be reasonable ranges
      expect(comprehensiveTokens).toBeGreaterThan(800);
      expect(comprehensiveTokens).toBeLessThan(3000);
    });
    
    it('should apply complexity multipliers for different destinations', () => {
      const chunk = {
        id: 'middle_1',
        startDay: 1,
        endDay: 3,
        detailLevel: 'balanced',
        focus: 'cultural_immersion'
      };
      
      const simpleTrip = { destination: { destination: 'Paris, France' } };
      const complexTrip = { destination: { destination: 'Tokyo, Japan' } };
      const multiCityTrip = { destination: { destination: 'Europe Multi-City Tour' } };
      
      const simpleTokens = longTripHandler._estimateChunkTokenUsage(chunk, simpleTrip);
      const complexTokens = longTripHandler._estimateChunkTokenUsage(chunk, complexTrip);
      const multiCityTokens = longTripHandler._estimateChunkTokenUsage(chunk, multiCityTrip);
      
      expect(complexTokens).toBeGreaterThan(simpleTokens);
      // Note: multiCityTokens might not always be higher due to destination detection logic
      expect(multiCityTokens).toBeGreaterThan(simpleTokens);
    });
    
    it('should provide more accurate estimates for complete trips', () => {
      const trip = {
        duration: 15,
        destination: { destination: 'Vietnam Cultural Tour' }
      };
      
      const analysis = longTripHandler.analyzeTrip(trip);
      const estimatedTokens = analysis.estimatedTokens;
      
      // Should be more sophisticated than simple multiplication
      const simpleEstimate = trip.duration * 300;
      expect(estimatedTokens).not.toBe(simpleEstimate);
      
      // Should be in reasonable range for 15-day trip
      expect(estimatedTokens).toBeGreaterThan(4000);
      expect(estimatedTokens).toBeLessThan(15000); // Increased upper bound for sophisticated estimation
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const originalConfig = longTripHandler.getConfig();
      expect(originalConfig.maxDaysPerChunk).toBe(7);
      
      longTripHandler.updateConfig({ maxDaysPerChunk: 5 });
      const updatedConfig = longTripHandler.getConfig();
      expect(updatedConfig.maxDaysPerChunk).toBe(5);
    });

    it('should maintain other config values when updating', () => {
      const originalConfig = longTripHandler.getConfig();
      const originalMinDays = originalConfig.minDaysForChunking;
      
      longTripHandler.updateConfig({ maxDaysPerChunk: 5 });
      const updatedConfig = longTripHandler.getConfig();
      
      expect(updatedConfig.minDaysForChunking).toBe(originalMinDays);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle very long trips (30+ days)', () => {
      const veryLongTrip = { ...mockTrip, duration: 35 };
      const analysis = longTripHandler.analyzeTrip(veryLongTrip);
      
      expect(analysis.needsChunking).toBe(true);
      expect(analysis.chunks.length).toBeGreaterThan(4);
      
      // Should have multiple middle chunks
      const middleChunks = analysis.chunks.filter(c => c.id.startsWith('middle_'));
      expect(middleChunks.length).toBeGreaterThan(2);
    });

    it('should handle edge case: exactly at chunking threshold', () => {
      const thresholdTrip = { ...mockTrip, duration: 10 }; // Exactly at minDaysForChunking
      const analysis = longTripHandler.analyzeTrip(thresholdTrip);
      
      expect(analysis.needsChunking).toBe(true);
      expect(analysis.chunks.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// Mock test to demonstrate the full integration
describe('Long Trip Integration Test', () => {
  let geminiService;
  let mockAiServices;

  beforeEach(() => {
    // Mock the AI service dependencies
    mockAiServices = {
      geminiClient: {
        callGeminiAPI: jest.fn().mockResolvedValue({
          content: 'Day 1: 09:00 - Museum Visit at Local History Museum\n11:30 - Lunch at Traditional Restaurant',
          tokensUsed: 150,
          model: 'flash',
          finishReason: 'STOP'
        })
      },
      promptBuilder: {
        buildChunkedItineraryPrompt: jest.fn().mockReturnValue('Mocked chunk prompt')
      },
      responseParser: {
        processChunkedItineraryResponse: jest.fn().mockImplementation((content, trip, chunk) => {
          // Generate the correct number of days for each chunk
          const chunkDuration = chunk.endDay - chunk.startDay + 1;
          const days = [];
          
          for (let i = 0; i < chunkDuration; i++) {
            const chunkStartDate = new Date(trip.destination.startDate);
            const dayDate = new Date(chunkStartDate);
            dayDate.setDate(dayDate.getDate() + i);
            
            days.push({
              date: dayDate,
              activities: [{
                time: '09:00',
                title: `Museum Visit (${chunk.id} - Day ${i + 1})`,
                description: 'Explore local history',
                location: { name: 'History Museum' },
                duration: 120,
                cost: 15,
                category: 'cultural'
              }]
            });
          }
          
          return { days };
        })
      },
      generateStandardItinerary: jest.fn().mockResolvedValue({
        days: [{
          date: new Date('2024-06-01'),
          activities: []
        }]
      })
    };
  });

  it('should successfully generate a long trip itinerary using chunking', async () => {
    const longTripHandler = new LongTripHandler();
    
    const longTrip = {
      duration: 15,
      destination: {
        destination: 'Europe',
        startDate: new Date('2024-06-01')
      },
      travelers: { adults: 2, children: 0, infants: 0 },
      preferences: { interests: ['cultural', 'food'] },
      budget: { total: 5000 }
    };

    const result = await longTripHandler.generateChunkedItinerary(longTrip, mockAiServices);
    
    expect(result.days).toBeDefined();
    expect(result.days.length).toBeGreaterThan(0);
    expect(mockAiServices.promptBuilder.buildChunkedItineraryPrompt).toHaveBeenCalled();
    expect(mockAiServices.responseParser.processChunkedItineraryResponse).toHaveBeenCalled();
  });

  it('should demonstrate the complete workflow from analysis to generation', async () => {
    const longTripHandler = new LongTripHandler();
    
    const longTrip = {
      duration: 21,
      destination: {
        destination: 'Asia Multi-Country',
        startDate: new Date('2024-07-01')
      },
      travelers: { adults: 4, children: 2, infants: 0 },
      preferences: { 
        interests: ['cultural', 'food', 'nature'],
        constraints: ['family_friendly']
      },
      budget: { total: 12000 }
    };

    // Step 1: Analyze trip
    const analysis = longTripHandler.analyzeTrip(longTrip);
    console.log('📊 Trip Analysis:', {
      duration: longTrip.duration,
      needsChunking: analysis.needsChunking,
      strategy: analysis.strategy,
      chunksCount: analysis.chunks.length,
      estimatedTokens: analysis.estimatedTokens
    });

    expect(analysis.needsChunking).toBe(true);
    expect(analysis.chunks.length).toBeGreaterThan(3);

    // Step 2: Generate chunked itinerary
    const result = await longTripHandler.generateChunkedItinerary(longTrip, mockAiServices);
    
    console.log('🗓️ Generated Itinerary:', {
      totalDays: result.days.length,
      firstDay: result.days[0],
      lastDay: result.days[result.days.length - 1]
    });

    expect(result.days).toHaveLength(longTrip.duration);
  });
});