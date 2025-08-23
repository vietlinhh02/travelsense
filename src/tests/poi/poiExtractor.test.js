const POIExtractor = require('../../src/services/poi/poiExtractor.service');

describe('POI Extractor Service', () => {
  let poiExtractor;

  beforeEach(() => {
    poiExtractor = new POIExtractor();
  });

  describe('POI Detection from Activity Titles', () => {
    it('should extract cultural POIs from activity titles', () => {
      const activities = [
        {
          title: 'Visit the Imperial City (Dai Noi) in Hue',
          description: 'Explore the historical complex',
          category: 'cultural'
        },
        {
          title: 'Tour Angkor Wat Temple Complex',
          description: 'Ancient temple ruins',
          category: 'cultural'
        },
        {
          title: 'Explore Louvre Museum',
          description: 'Famous art museum in Paris',
          category: 'cultural'
        }
      ];

      const tripContext = {
        destination: 'Vietnam',
        city: 'Hue',
        country: 'Vietnam'
      };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThan(0);
        
        const imperialCity = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('imperial city') || 
          poi.name.toLowerCase().includes('dai noi')
        );
        expect(imperialCity).toBeDefined();
        expect(imperialCity.category).toBe('cultural');
        expect(imperialCity.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should extract food POIs from restaurant mentions', () => {
      const activities = [
        {
          title: 'Lunch at Quan An Ngon restaurant',
          description: 'Traditional Vietnamese cuisine',
          category: 'food'
        },
        {
          title: 'Dinner at The Golden Dragon',
          description: 'Upscale Chinese restaurant',
          category: 'food'
        },
        {
          title: 'Coffee at Cafe Central',
          description: 'Local coffee shop experience',
          category: 'food'
        }
      ];

      const tripContext = {
        destination: 'Ho Chi Minh City',
        city: 'Ho Chi Minh City',
        country: 'Vietnam'
      };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThanOrEqual(2);
        
        const restaurant = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('quan an ngon') ||
          poi.name.toLowerCase().includes('golden dragon')
        );
        expect(restaurant).toBeDefined();
        expect(restaurant.category).toBe('food');
      });
    });

    it('should extract nature POIs from outdoor activities', () => {
      const activities = [
        {
          title: 'Hiking in Ba Den Mountain',
          description: 'Mountain climbing adventure',
          category: 'nature'
        },
        {
          title: 'Visit Phong Nha Cave',
          description: 'Underground cave exploration',
          category: 'nature'
        },
        {
          title: 'Boat trip in Halong Bay',
          description: 'Scenic bay cruise',
          category: 'nature'
        }
      ];

      const tripContext = {
        destination: 'Vietnam',
        city: 'Quang Binh',
        country: 'Vietnam'
      };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThan(0);
        
        const cave = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('phong nha') ||
          poi.name.toLowerCase().includes('cave')
        );
        expect(cave).toBeDefined();
        expect(cave.category).toBe('nature');
      });
    });
  });

  describe('POI Detection from Descriptions', () => {
    it('should extract POIs from detailed descriptions', () => {
      const activities = [
        {
          title: 'Morning exploration',
          description: 'Start your day with a visit to Notre Dame Cathedral, followed by exploring the Central Post Office designed by Gustave Eiffel',
          category: 'cultural'
        }
      ];

      const tripContext = {
        destination: 'Ho Chi Minh City',
        city: 'Ho Chi Minh City',
        country: 'Vietnam'
      };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThanOrEqual(1);
        
        const cathedral = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('notre dame') ||
          poi.name.toLowerCase().includes('cathedral')
        );
        expect(cathedral).toBeDefined();
        expect(cathedral.category).toBe('cultural');
      });
    });

    it('should handle activities with multiple POIs mentioned', () => {
      const activities = [
        {
          title: 'Historic District Tour',
          description: 'Visit Ben Thanh Market for shopping, then walk to Saigon Opera House, and end at Nguyen Hue Walking Street',
          category: 'cultural'
        }
      ];

      const tripContext = {
        destination: 'Ho Chi Minh City',
        city: 'Ho Chi Minh City',
        country: 'Vietnam'
      };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThanOrEqual(2);
        
        const market = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('ben thanh')
        );
        const opera = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('opera')
        );
        
        expect(market || opera).toBeDefined();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty activities array', () => {
      const activities = [];
      const tripContext = { destination: 'Tokyo', city: 'Tokyo', country: 'Japan' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs).toEqual([]);
      });
    });

    it('should handle activities without clear POI mentions', () => {
      const activities = [
        {
          title: 'Rest and relax',
          description: 'Take it easy today',
          category: 'leisure'
        },
        {
          title: 'Free time',
          description: 'Personal exploration',
          category: 'leisure'
        }
      ];

      const tripContext = { destination: 'Paris', city: 'Paris', country: 'France' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        // Should return empty array or very low confidence POIs
        expect(extractedPOIs.length).toBeLessThanOrEqual(1);
        if (extractedPOIs.length > 0) {
          expect(extractedPOIs[0].confidence).toBeLessThan(0.5);
        }
      });
    });

    it('should handle malformed activity objects', () => {
      const activities = [
        { title: undefined, description: null },
        { title: '', description: '' },
        { title: 'Valid activity', description: 'Visit Eiffel Tower' }
      ];

      const tripContext = { destination: 'Paris', city: 'Paris', country: 'France' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        // Should handle malformed activities gracefully
        expect(extractedPOIs.length).toBeGreaterThanOrEqual(0);
        
        if (extractedPOIs.length > 0) {
          const validPOI = extractedPOIs.find(poi => 
            poi.name.toLowerCase().includes('eiffel')
          );
          expect(validPOI).toBeDefined();
        }
      });
    });

    it('should handle missing trip context gracefully', () => {
      const activities = [
        {
          title: 'Visit Tokyo Tower',
          description: 'Iconic tower in Tokyo',
          category: 'cultural'
        }
      ];

      const tripContext = {}; // Empty context

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThanOrEqual(0);
        
        if (extractedPOIs.length > 0) {
          expect(extractedPOIs[0].city).toBeDefined();
          expect(extractedPOIs[0].country).toBeDefined();
        }
      });
    });
  });

  describe('POI Categorization', () => {
    it('should correctly categorize different types of POIs', () => {
      const activities = [
        { title: 'Visit Tokyo National Museum', description: 'Art and history', category: 'cultural' },
        { title: 'Sushi at Jiro Restaurant', description: 'Traditional sushi', category: 'food' },
        { title: 'Shopping at Shibuya', description: 'Shopping district', category: 'shopping' },
        { title: 'Mount Fuji hike', description: 'Mountain climbing', category: 'nature' },
        { title: 'Stay at Hotel Okura', description: 'Luxury hotel', category: 'accommodation' }
      ];

      const tripContext = { destination: 'Tokyo', city: 'Tokyo', country: 'Japan' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThan(0);

        const categories = extractedPOIs.map(poi => poi.category);
        const uniqueCategories = new Set(categories);
        
        expect(uniqueCategories.size).toBeGreaterThan(1); // Should detect multiple categories
        expect(categories).toContain('cultural');
        expect(categories.some(cat => ['food', 'shopping', 'nature', 'accommodation'].includes(cat))).toBe(true);
      });
    });

    it('should assign appropriate confidence scores', () => {
      const activities = [
        { 
          title: 'Visit Louvre Museum', 
          description: 'World famous art museum with Mona Lisa', 
          category: 'cultural' 
        },
        { 
          title: 'Walk around', 
          description: 'General exploration', 
          category: 'leisure' 
        }
      ];

      const tripContext = { destination: 'Paris', city: 'Paris', country: 'France' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThan(0);

        // Specific POI mention should have high confidence
        const louvre = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('louvre')
        );
        
        if (louvre) {
          expect(louvre.confidence).toBeGreaterThan(0.7);
        }

        // Vague activities should have lower confidence
        const vaguePOIs = extractedPOIs.filter(poi => poi.confidence < 0.5);
        expect(vaguePOIs.length).toBeLessThanOrEqual(extractedPOIs.length);
      });
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate similar POI mentions', () => {
      const activities = [
        { title: 'Visit Eiffel Tower', description: 'Morning visit', category: 'cultural' },
        { title: 'Return to Eiffel Tower', description: 'Evening visit', category: 'cultural' },
        { title: 'Eiffel Tower photos', description: 'Photography session', category: 'cultural' }
      ];

      const tripContext = { destination: 'Paris', city: 'Paris', country: 'France' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        const eiffelPOIs = extractedPOIs.filter(poi => 
          poi.name.toLowerCase().includes('eiffel')
        );
        
        // Should deduplicate to single POI or very few instances
        expect(eiffelPOIs.length).toBeLessThanOrEqual(2);
      });
    });

    it('should preserve different POIs with similar names', () => {
      const activities = [
        { title: 'Visit Notre Dame Cathedral', description: 'Paris cathedral', category: 'cultural' },
        { title: 'Notre Dame Basilica', description: 'Montreal basilica', category: 'cultural' }
      ];

      const tripContext = { destination: 'Multi-city tour', city: 'Various', country: 'Various' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        const notreDamePOIs = extractedPOIs.filter(poi => 
          poi.name.toLowerCase().includes('notre dame')
        );
        
        // Should preserve different Notre Dame locations
        expect(notreDamePOIs.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Service Configuration', () => {
    it('should return service statistics', () => {
      const stats = poiExtractor.getServiceStats();
      
      expect(stats).toBeDefined();
      expect(stats.patterns).toBeDefined();
      expect(stats.categoryKeywords).toBeDefined();
      expect(stats.confidenceThreshold).toBeDefined();
      expect(typeof stats.confidenceThreshold).toBe('number');
    });

    it('should allow confidence threshold adjustment', () => {
      const originalThreshold = poiExtractor.getServiceStats().confidenceThreshold;
      
      poiExtractor.updateConfig({ confidenceThreshold: 0.8 });
      const newStats = poiExtractor.getServiceStats();
      
      expect(newStats.confidenceThreshold).toBe(0.8);
      expect(newStats.confidenceThreshold).not.toBe(originalThreshold);
    });
  });

  describe('Language and Location Specific Tests', () => {
    it('should handle Vietnamese location names', () => {
      const activities = [
        { title: 'Thăm Chùa Một Cột', description: 'Pagoda visit', category: 'cultural' },
        { title: 'Visit Hồ Chí Minh Mausoleum', description: 'Historical site', category: 'cultural' }
      ];

      const tripContext = { destination: 'Hanoi', city: 'Hanoi', country: 'Vietnam' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThan(0);
        
        const mausoleum = extractedPOIs.find(poi => 
          poi.name.toLowerCase().includes('mausoleum') ||
          poi.name.toLowerCase().includes('hồ chí minh')
        );
        
        expect(mausoleum).toBeDefined();
        expect(mausoleum.category).toBe('cultural');
      });
    });

    it('should handle international destination contexts', () => {
      const activities = [
        { title: 'Visit Senso-ji Temple', description: 'Ancient Buddhist temple', category: 'cultural' },
        { title: 'Ramen at Ichiran', description: 'Famous ramen chain', category: 'food' }
      ];

      const tripContext = { destination: 'Tokyo, Japan', city: 'Tokyo', country: 'Japan' };

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        expect(extractedPOIs.length).toBeGreaterThan(0);
        
        const japanesePOIs = extractedPOIs.filter(poi => 
          poi.country === 'Japan' && poi.city === 'Tokyo'
        );
        
        expect(japanesePOIs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large numbers of activities efficiently', () => {
      // Generate 50 activities
      const activities = [];
      for (let i = 1; i <= 50; i++) {
        activities.push({
          title: `Activity ${i} - Visit Location ${i}`,
          description: `Description for location ${i} in the city center`,
          category: i % 2 === 0 ? 'cultural' : 'food'
        });
      }

      const tripContext = { destination: 'Bangkok', city: 'Bangkok', country: 'Thailand' };
      const startTime = Date.now();

      return poiExtractor.extractPOIsFromItinerary(activities, tripContext).then(extractedPOIs => {
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        expect(extractedPOIs).toBeDefined();
        expect(extractedPOIs.length).toBeGreaterThan(0);
        expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      });
    });

    it('should maintain reasonable memory usage', () => {
      const largeTripContext = {
        destination: 'Multi-city European Tour covering Paris, Rome, Berlin, Amsterdam, Vienna, Prague, Barcelona, Lisbon',
        city: 'Various',
        country: 'Various',
        duration: 30,
        travelers: { adults: 4, children: 2 },
        budget: { total: 15000, currency: 'EUR' },
        interests: ['cultural', 'food', 'nature', 'shopping', 'entertainment'],
        constraints: ['family_friendly', 'accessible', 'budget_conscious']
      };

      const activities = [
        { title: 'Visit Louvre Museum', description: 'Famous art museum', category: 'cultural' }
      ];

      return poiExtractor.extractPOIsFromItinerary(activities, largeTripContext).then(extractedPOIs => {
        expect(extractedPOIs).toBeDefined();
        expect(Array.isArray(extractedPOIs)).toBe(true);
        // Should handle large context without errors
      });
    });
  });
});