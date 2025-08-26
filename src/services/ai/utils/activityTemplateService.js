/**
 * ActivityTemplateService - Manages destination-specific activity templates
 * Responsible for: Template generation, destination detection, budget-aware selection, time management
 */
class ActivityTemplateService {
  constructor() {
    // Currency conversion rates (approximate)
    this.currencyRates = {
      'japan': { fromUSD: 150, symbol: '¥' }, // Yen
      'vietnam': { fromUSD: 24000, symbol: '₫' }, // VND
      'usa': { fromUSD: 1, symbol: '$' },
      'default': { fromUSD: 24000, symbol: '₫' } // VND as default
    };
  }

  /**
   * Generate template-based itinerary (fallback method)
   * @param {Object} trip - Trip object
   * @returns {Object} Generated itinerary
   */
  generateTemplateBasedItinerary(trip) {
    const days = [];
    const duration = trip.duration;
    const startDate = new Date(trip.destination.startDate);
    const destination = trip.destination.destination;
    const interests = trip.preferences?.interests || ['sightseeing'];
    const budget = trip.budget?.total || 1000;
    const dailyBudget = Math.floor(budget / duration / 2);
    
    const activityTemplates = this.getActivityTemplates(destination, interests, dailyBudget);
    
    for (let i = 0; i < duration; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      
      const dayActivities = [];
      const dayTemplates = this._selectDayActivities(activityTemplates, i + 1, duration, trip);
      
      dayTemplates.forEach((template) => {
        dayActivities.push({
          time: template.time,
          title: template.title,
          description: template.description,
          location: {
            name: template.location,
            address: template.address || `${template.location}, ${destination}`,
            coordinates: template.coordinates || this._generateCoordinates(destination)
          },
          duration: template.duration,
          cost: template.cost,
          category: template.category,
          notes: template.notes || 'AI-generated activity based on your preferences'
        });
      });
      
      days.push({
        date: dayDate,
        activities: dayActivities
      });
    }
    
    return { days };
  }

  /**
   * Get activity templates based on destination and interests
   * @param {string} destination - Destination name
   * @param {Array} interests - User interests
   * @param {number} dailyBudget - Daily budget in USD
   * @returns {Array} Activity templates
   */
  getActivityTemplates(destination, interests, dailyBudget) {
    // Normalize destination to detect location
    const destinationLower = destination.toLowerCase();
    
    // Determine which activity set to use based on destination
    let templates;
    
    if (destinationLower.includes('tokyo') || destinationLower.includes('japan')) {
      templates = this._getTokyoActivityTemplates();
    } else if (destinationLower.includes('da lat') || destinationLower.includes('dalat') ||
               destinationLower.includes('da-lat') || destinationLower.includes('dalát')) {
      templates = this._getDaLatActivityTemplates();
    } else if (destinationLower.includes('saigon') || destinationLower.includes('ho chi minh') || destinationLower.includes('vietnam') ||
               destinationLower.includes('hanoi') || destinationLower.includes('hcmc') ||
               destinationLower.includes('ho chi minh city') || destinationLower.includes('sai gon')) {
      templates = this._getVietnamActivityTemplates();
    } else {
      // Default to a generic international template or Tokyo as fallback
      templates = this._getTokyoActivityTemplates();
    }
    
    // Filter templates based on interests and budget
    const tripCurrency = trip.budget?.currency || 'VND'; // Default to VND
    let selectedTemplates = [];
    interests.forEach(interest => {
      // Handle nightlife interests
      if (interest === 'nightlife' && templates.nightlife) {
        selectedTemplates = selectedTemplates.concat(
          templates.nightlife.filter(activity => {
            const costInUSD = this._convertCostToUSD(activity.cost, destination, tripCurrency);
            return costInUSD <= dailyBudget * 2; // Allow higher budget for nightlife
          })
        );
      } else if (templates[interest]) {
        selectedTemplates = selectedTemplates.concat(
          templates[interest].filter(activity => {
            // Convert cost to USD if needed
            const costInUSD = this._convertCostToUSD(activity.cost, destination, tripCurrency);
            return costInUSD <= dailyBudget * 1.5;
          })
        );
      }
    });
    
          // Add some general activities if no specific interests match
      if (selectedTemplates.length < 8) {
        // Add cultural activities (usually free/low cost)
        selectedTemplates = selectedTemplates.concat(
          templates.cultural.slice(0, 3).filter(activity => {
            const costInUSD = this._convertCostToUSD(activity.cost, destination, tripCurrency);
            return costInUSD <= dailyBudget * 1.5;
          })
        );
        // Add some food experiences
        selectedTemplates = selectedTemplates.concat(
          templates.food.slice(0, 2).filter(activity => {
            const costInUSD = this._convertCostToUSD(activity.cost, destination, tripCurrency);
            return costInUSD <= dailyBudget * 1.5;
          })
        );
      }
    
    return selectedTemplates;
  }

  /**
   * Convert activity costs to USD based on destination
   * @param {number} cost - Original cost
   * @param {string} destination - Destination name
   * @returns {number} Cost in USD
   */
  _convertCostToUSD(cost, destination, currency = 'VND') {
    const destinationLower = destination.toLowerCase();

    // If already in VND, convert to USD for comparison
    if (currency === 'VND' || destinationLower.includes('vietnam') ||
        destinationLower.includes('saigon') || destinationLower.includes('hanoi')) {
      // Convert VND to USD (approximate 1 USD = 24,000 VND)
      return cost / 24000;
    } else if (destinationLower.includes('japan') || destinationLower.includes('tokyo')) {
      // Convert yen to USD (approximate 1 USD = 150 yen)
      return cost / 150;
    } else {
      // Assume already in USD or similar scale
      return cost;
    }
  }

  /**
   * Get Tokyo-specific activity templates
   * @returns {Object} Tokyo activity templates by category
   */
  _getTokyoActivityTemplates() {
    return {
      cultural: [
        { title: 'Visit Senso-ji Temple', location: 'Senso-ji Temple', address: '2-3-1 Asakusa, Taito City, Tokyo 111-0032', description: 'Explore Tokyo\'s oldest Buddhist temple (645 AD) with beautiful traditional architecture', category: 'cultural', duration: 90, cost: 0, coordinates: { lat: 35.7148, lng: 139.7967 } },
        { title: 'Tokyo National Museum', location: 'Tokyo National Museum', address: '13-9 Uenokoen, Taito City, Tokyo 110-8712', description: 'Japan\'s largest collection of cultural artifacts including samurai swords and ceramics', category: 'cultural', duration: 120, cost: 1000, coordinates: { lat: 35.7188, lng: 139.7766 } },
        { title: 'Meiji Shrine Visit', location: 'Meiji Shrine', address: '1-1 Kamizono-cho, Shibuya City, Tokyo 151-8557', description: 'Peaceful Shinto shrine dedicated to Emperor Meiji in central Tokyo', category: 'cultural', duration: 75, cost: 0, coordinates: { lat: 35.6763, lng: 139.6993 } },
        { title: 'Imperial Palace East Gardens', location: 'Imperial Palace East Gardens', address: '1-1 Chiyoda, Chiyoda City, Tokyo 100-8111', description: 'Former Edo Castle grounds with beautiful traditional gardens', category: 'cultural', duration: 90, cost: 0, coordinates: { lat: 35.6852, lng: 139.7544 } }
      ],
      food: [
        { title: 'Tsukiji Outer Market Food Tour', location: 'Tsukiji Outer Market', address: '5 Chome Tsukiji, Chuo City, Tokyo 104-0045', description: 'Sample fresh sushi, tamagoyaki, and local delicacies from historic market stalls', category: 'food', duration: 120, cost: 3000, coordinates: { lat: 35.6654, lng: 139.7707 } },
        { title: 'Ramen Tasting in Shibuya', location: 'Shibuya Ramen District', address: 'Shibuya, Tokyo (Various locations)', description: 'Try authentic Tokyo-style shoyu ramen at renowned local shops', category: 'food', duration: 60, cost: 1200, coordinates: { lat: 35.6598, lng: 139.7006 } },
        { title: 'Traditional Tea Ceremony', location: 'Tea House in Ginza', address: 'Ginza District, Chuo City, Tokyo', description: 'Experience authentic Japanese tea ceremony with wagashi sweets', category: 'cultural', duration: 90, cost: 2500, coordinates: { lat: 35.6762, lng: 139.7653 } }
      ],
      cultural: [
        { title: 'Senso-ji Temple Complex', location: 'Senso-ji Temple', address: '2-3-1 Asakusa, Taito City, Tokyo 111-0032', description: 'Tokyo\'s most significant Buddhist temple complex with Thunder Gate', category: 'cultural', duration: 105, cost: 0, coordinates: { lat: 35.7148, lng: 139.7967 } },
        { title: 'Nezu Shrine', location: 'Nezu Shrine', address: '1-28-9 Nezu, Bunkyo City, Tokyo 113-0031', description: 'Beautiful 1900-year-old shrine famous for azalea festival', category: 'cultural', duration: 60, cost: 0, coordinates: { lat: 35.7280, lng: 139.7615 } },
        { title: 'Yasukuni Shrine', location: 'Yasukuni Shrine', address: '3-1-1 Kudankita, Chiyoda City, Tokyo 102-8246', description: 'Historic Shinto shrine with beautiful gardens', category: 'cultural', duration: 75, cost: 0, coordinates: { lat: 35.6947, lng: 139.7431 } },
        { title: 'teamLab Borderless Digital Art', location: 'teamLab Borderless', address: '1-3-15 Toyosu, Koto City, Tokyo 135-0061', description: 'World\'s first digital art museum with immersive installations', category: 'cultural', duration: 180, cost: 3200, coordinates: { lat: 35.6494, lng: 139.7944 } },
        { title: 'Tokyo Skytree Observatory', location: 'Tokyo Skytree', address: '1-1-2 Oshiage, Sumida City, Tokyo 131-0045', description: 'World\'s tallest tower with panoramic city views', category: 'cultural', duration: 90, cost: 2060, coordinates: { lat: 35.7101, lng: 139.8107 } },
        { title: 'Shibuya Crossing Experience', location: 'Shibuya Crossing', address: 'Shibuya, Tokyo', description: 'World\'s busiest pedestrian crossing experience', category: 'cultural', duration: 60, cost: 0, coordinates: { lat: 35.6598, lng: 139.7006 } }
      ],
      nature: [{ title: 'Shinjuku Gyoen National Garden', location: 'Shinjuku Gyoen', address: '11 Naito-machi, Shinjuku City, Tokyo 160-0014', description: 'Beautiful garden perfect for hanami', category: 'nature', duration: 120, cost: 500, coordinates: { lat: 35.6851, lng: 139.7101 } }],
      shopping: [{ title: 'Shibuya Crossing & Center Gai', location: 'Shibuya District', address: 'Shibuya, Tokyo', description: 'Experience the world\'s busiest pedestrian crossing', category: 'shopping', duration: 120, cost: 2000, coordinates: { lat: 35.6598, lng: 139.7006 } }],
      nightlife: [
        { title: 'Rooftop Bar at Park Hyatt Tokyo', location: 'Park Hyatt Tokyo', address: '3-7-1-2 Nishi Shinjuku, Shinjuku City, Tokyo 163-1055', description: 'Luxury rooftop bar with stunning city views and craft cocktails', category: 'nightlife', duration: 120, cost: 8000, coordinates: { lat: 35.6849, lng: 139.6917 } },
        { title: 'Golden Gai Bar Hopping', location: 'Golden Gai', address: 'Kabukicho, Shinjuku City, Tokyo', description: 'Experience Tokyo\'s famous tiny bars and underground music scene', category: 'nightlife', duration: 180, cost: 5000, coordinates: { lat: 35.6940, lng: 139.7014 } },
        { title: 'Jazz at Blue Note Tokyo', location: 'Blue Note Tokyo', address: '6 Chome-3-16 Minamiaoyama, Minato City, Tokyo', description: 'World-class jazz performances in an intimate setting', category: 'cultural', duration: 150, cost: 6000, coordinates: { lat: 35.6623, lng: 139.7126 } },
        { title: 'Shibuya Nightlife District', location: 'Shibuya', address: 'Shibuya, Tokyo', description: 'Vibrant nightlife with arcades, karaoke, and street food', category: 'nightlife', duration: 240, cost: 3000, coordinates: { lat: 35.6598, lng: 139.7006 } }
      ]
    };
  }

  /**
   * Get Vietnam/Saigon-specific activity templates
   * @returns {Object} Vietnam activity templates by category
   */
  _getDaLatActivityTemplates() {
    return {
      cultural: [
        { title: 'Dalat Cathedral (Pink Church)', location: 'Dalat Cathedral', address: '2 Nguyen Chi Thanh, Da Lat', description: 'Beautiful pink neo-Gothic cathedral with stunning architecture', category: 'cultural', duration: 60, cost: 0, coordinates: { lat: 11.9421, lng: 108.4381 } },
        { title: 'Bao Dai Summer Palace', location: 'Bao Dai Summer Palace', address: '1 Truong Cong Dinh, Da Lat', description: 'Historic summer residence of the last emperor of Vietnam', category: 'cultural', duration: 90, cost: 25000, coordinates: { lat: 11.9418, lng: 108.4348 } },
        { title: 'Dalat Railway Station', location: 'Dalat Railway Station', address: '1 Nguyen Trai, Da Lat', description: 'Historic French colonial railway station with unique architecture', category: 'cultural', duration: 60, cost: 0, coordinates: { lat: 11.9456, lng: 108.4422 } },
        { title: 'Crazy House (Hang Nga House)', location: 'Crazy House', address: '3 Huynh Thuc Khang, Da Lat', description: 'Unique architectural masterpiece designed by Vietnamese architect Dang Viet Nga', category: 'cultural', duration: 90, cost: 40000, coordinates: { lat: 11.9387, lng: 108.4369 } }
      ],
      food: [
        { title: 'Dalat Night Market Food Tour', location: 'Dalat Night Market', address: 'Nguyen Thi Minh Khai, Da Lat', description: 'Sample local specialties: avocado smoothies, pho, fresh strawberries, and Dalat wine', category: 'food', duration: 120, cost: 150000, coordinates: { lat: 11.9417, lng: 108.4381 } },
        { title: 'Dalat Strawberry Farm Experience', location: 'Dalat Strawberry Farms', address: 'Various strawberry farms around Da Lat', description: 'Pick fresh strawberries and enjoy strawberry-based dishes', category: 'food', duration: 90, cost: 80000, coordinates: { lat: 11.9450, lng: 108.4400 } },
        { title: 'Dalat Coffee Culture', location: 'Dalat Coffee Shops', address: 'Various locations in central Da Lat', description: 'Experience Dalat\'s famous coffee culture with weasel coffee and local blends', category: 'food', duration: 60, cost: 50000, coordinates: { lat: 11.9400, lng: 108.4350 } }
      ],
      nature: [
        { title: 'Lake of Sighs (Ho Xuan Huong)', location: 'Ho Xuan Huong', address: 'Da Lat, Lam Dong Province', description: 'Beautiful lake with French-style architecture and flower gardens', category: 'nature', duration: 120, cost: 0, coordinates: { lat: 11.9292, lng: 108.4281 } },
        { title: 'Dalat Flower Gardens', location: 'Dalat Flower Gardens', address: 'Various flower farms around Da Lat', description: 'Visit the famous flower growing region of Vietnam', category: 'nature', duration: 90, cost: 50000, coordinates: { lat: 11.9350, lng: 108.4300 } },
        { title: 'Langbian Plateau Hike', location: 'Langbian Plateau', address: 'Langbian Mountain, Da Lat', description: 'Scenic plateau with pine forests and mountain views', category: 'nature', duration: 180, cost: 0, coordinates: { lat: 12.0167, lng: 108.4500 } },
        { title: 'Dalat Cable Car Ride', location: 'Dalat Cable Car', address: 'Robin Hill, Da Lat', description: 'Cable car ride over pine forests to scenic viewpoints', category: 'nature', duration: 60, cost: 150000, coordinates: { lat: 11.9294, lng: 108.4278 } }
      ],
      shopping: [
        { title: 'Dalat Night Market Shopping', location: 'Dalat Night Market', address: 'Nguyen Thi Minh Khai, Da Lat', description: 'Local handicrafts, textiles, and souvenirs from the Central Highlands', category: 'shopping', duration: 90, cost: 200000, coordinates: { lat: 11.9417, lng: 108.4381 } },
        { title: 'Dalat Art and Craft Shops', location: 'Dalat Art District', address: 'Various art galleries in central Da Lat', description: 'Paintings, sculptures, and traditional crafts by local artists', category: 'shopping', duration: 120, cost: 150000, coordinates: { lat: 11.9400, lng: 108.4350 } }
      ],
      relaxation: [
        { title: 'Dalat Spa Experience', location: 'Dalat Spa Resorts', address: 'Various luxury spas in Da Lat', description: 'Traditional Vietnamese spa treatments with natural ingredients', category: 'relaxation', duration: 120, cost: 300000, coordinates: { lat: 11.9400, lng: 108.4350 } },
        { title: 'Dalat Hot Springs', location: 'Dalat Hot Springs', address: 'Thien Vien Truc Lam, Da Lat', description: 'Natural hot springs with therapeutic mineral water', category: 'relaxation', duration: 90, cost: 100000, coordinates: { lat: 11.9350, lng: 108.4300 } },
        { title: 'Pine Forest Walk', location: 'Dalat Pine Forests', address: 'Various walking paths around Da Lat', description: 'Peaceful walks through pine forests with fresh mountain air', category: 'relaxation', duration: 60, cost: 0, coordinates: { lat: 11.9450, lng: 108.4400 } }
      ],
      nightlife: [
        { title: 'Dalat Nightlife District', location: 'Dalat Nightlife Area', address: 'Nguyen Thi Minh Khai and surrounding streets', description: 'Cozy bars, live music venues, and romantic atmosphere', category: 'nightlife', duration: 180, cost: 150000, coordinates: { lat: 11.9417, lng: 108.4381 } },
        { title: 'Dalat Pub Crawl', location: 'Dalat Pubs', address: 'Various pubs in central Da Lat', description: 'Experience the local nightlife scene with craft beers and live music', category: 'nightlife', duration: 240, cost: 200000, coordinates: { lat: 11.9400, lng: 108.4350 } }
      ]
    };
  }

  _getVietnamActivityTemplates() {
    return {
      cultural: [
        { title: 'Independence Palace (Reunification Palace)', location: 'Independence Palace', address: '135 Nam Ky Khoi Nghia, Ben Thanh, District 1, Ho Chi Minh City', description: 'Historic presidential palace where South Vietnam surrendered in 1975', category: 'cultural', duration: 90, cost: 120000, coordinates: { lat: 10.7769, lng: 106.6955 } },
        { title: 'War Remnants Museum', location: 'War Remnants Museum', address: '28 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City', description: 'Comprehensive museum documenting the Vietnam War with authentic artifacts', category: 'cultural', duration: 120, cost: 150000, coordinates: { lat: 10.7789, lng: 106.6917 } },
        { title: 'Jade Emperor Pagoda', location: 'Jade Emperor Pagoda', address: '73 Mai Thi Luu, Da Kao Ward, District 1, Ho Chi Minh City', description: 'Atmospheric Taoist temple built in 1909, dedicated to the Jade Emperor', category: 'cultural', duration: 75, cost: 0, coordinates: { lat: 10.7896, lng: 106.6952 } },
        { title: 'Saigon Notre Dame Cathedral', location: 'Notre Dame Cathedral Basilica of Saigon', address: '01 Cong xa Paris, Ben Nghe Ward, District 1, Ho Chi Minh City', description: 'Neo-Romanesque Catholic cathedral built by French colonists in 1880', category: 'cultural', duration: 60, cost: 0, coordinates: { lat: 10.7798, lng: 106.6990 } },
        { title: 'Cao Dai Temple Visit', location: 'Cao Dai Temple', address: 'District 1, Ho Chi Minh City', description: 'Unique Vietnamese religion temple combining Buddhism, Christianity, and Confucianism', category: 'cultural', duration: 75, cost: 0, coordinates: { lat: 10.7721, lng: 106.6946 } },
        { title: 'Mariamman Hindu Temple', location: 'Mariamman Hindu Temple', address: '45 Truong Dinh, District 1, Ho Chi Minh City', description: 'Colorful Hindu temple showcasing Indian cultural heritage in Vietnam', category: 'cultural', duration: 60, cost: 0, coordinates: { lat: 10.7696, lng: 106.6928 } }
      ],
      food: [
        { title: 'Street Food Tour in District 1', location: 'District 1 Food Streets', address: 'Nguyen Hue, Dong Khoi, and surrounding streets, District 1', description: 'Explore authentic Vietnamese street food: pho, banh mi, fresh spring rolls', category: 'food', duration: 150, cost: 480000, coordinates: { lat: 10.7769, lng: 106.7009 } },
        { title: 'Ben Thanh Market Food Experience', location: 'Ben Thanh Market', address: 'Le Loi, Ben Thanh Ward, District 1, Ho Chi Minh City', description: 'Traditional market with food stalls serving local specialties like bun bo hue', category: 'food', duration: 90, cost: 360000, coordinates: { lat: 10.7720, lng: 106.6988 } },
        { title: 'Vietnamese Coffee Culture Tour', location: 'District 1 Coffee Shops', address: 'Various locations in District 1 and District 3', description: 'Experience authentic Vietnamese coffee culture with ca phe sua da and egg coffee', category: 'food', duration: 120, cost: 240000, coordinates: { lat: 10.7756, lng: 106.6946 } }
      ],
      nature: [
        { title: 'Saigon River Sunset Cruise', location: 'Saigon River', address: 'Bach Dang Wharf, District 1, Ho Chi Minh City', description: 'Scenic evening cruise along Saigon River with city skyline views', category: 'nature', duration: 120, cost: 720000, coordinates: { lat: 10.7707, lng: 106.7056 } },
        { title: 'Tao Dan Park Morning Walk', location: 'Tao Dan Park', address: 'Truong Dinh, District 1, Ho Chi Minh City', description: 'Peaceful urban park perfect for morning exercise and bird watching', category: 'nature', duration: 60, cost: 0, coordinates: { lat: 10.7729, lng: 106.6935 } },
        { title: 'Mekong Delta Day Trip', location: 'Mekong Delta', address: 'My Tho, Tien Giang Province', description: 'Traditional floating markets and river life experience', category: 'nature', duration: 480, cost: 1200000, coordinates: { lat: 10.3600, lng: 106.3600 } }
      ],
      shopping: [
        { title: 'Ben Thanh Market Shopping', location: 'Ben Thanh Market', address: 'Le Loi, Ben Thanh Ward, District 1, Ho Chi Minh City', description: 'Iconic indoor market with local handicrafts, textiles, and souvenirs', category: 'shopping', duration: 120, cost: 480000, coordinates: { lat: 10.7720, lng: 106.6988 } },
        { title: 'Dong Khoi Shopping District', location: 'Dong Khoi Street', address: 'Dong Khoi Street, District 1, Ho Chi Minh City', description: 'Upscale shopping street with boutiques and art galleries', category: 'shopping', duration: 90, cost: 600000, coordinates: { lat: 10.7745, lng: 106.7013 } }
      ],
      nightlife: [
        { title: 'Bui Vien Walking Street Nightlife', location: 'Bui Vien Walking Street', address: 'Pham Ngu Lao, District 1, Ho Chi Minh City', description: 'Vibrant backpacker street with bars, street food, and live music', category: 'nightlife', duration: 180, cost: 240000, coordinates: { lat: 10.7669, lng: 106.6931 } },
        { title: 'Rooftop Bar at The Reverie Saigon', location: 'The Reverie Saigon', address: '22-36 Nguyen Hue, Ben Nghe Ward, District 1', description: 'Luxury rooftop bar with Saigon River views and craft cocktails', category: 'nightlife', duration: 120, cost: 360000, coordinates: { lat: 10.7745, lng: 106.7013 } },
        { title: 'Live Music at Acoustic Bar', location: 'Acoustic Saigon', address: '6E1 Ngo Thoi Nhiem, District 3, Ho Chi Minh City', description: 'Intimate venue featuring local and international musicians', category: 'cultural', duration: 150, cost: 180000, coordinates: { lat: 10.7829, lng: 106.6852 } },
        { title: 'District 1 Club Scene', location: 'District 1 Nightclubs', address: 'Various locations in District 1', description: 'Experience Saigon\'s growing club scene with DJs and dancing', category: 'nightlife', duration: 240, cost: 300000, coordinates: { lat: 10.7769, lng: 106.7009 } }
      ]
    };
  }

  /**
   * Select and time activities for a specific day
   * @param {Array} templates - Available activity templates
   * @param {number} dayNumber - Current day number
   * @param {number} totalDays - Total trip duration
   * @param {Object} trip - Trip object
   * @returns {Array} Selected activities for the day
   */
  _selectDayActivities(templates, dayNumber, totalDays, trip) {
    const activities = [];
    const usedTemplates = new Set();
    
    // Define time slots for different parts of the day
    const timeSlots = [
      { time: '09:00', period: 'morning' },
      { time: '11:30', period: 'late-morning' },
      { time: '14:00', period: 'afternoon' },
      { time: '16:30', period: 'late-afternoon' },
      { time: '18:30', period: 'evening' },
      { time: '20:30', period: 'nightlife' } // Add nightlife slot
    ];
    
    // First day: lighter schedule, focus on arrival and orientation
    // Last day: consider departure, lighter activities
    const activitiesPerDay = dayNumber === 1 || dayNumber === totalDays ? 3 : 4;
    
    // Separate nightlife and regular activities (map entertainment to nightlife)
    const nightlifeTemplates = templates.filter(t => t.category === 'nightlife' || t.category === 'cultural'); // entertainment mapped to cultural
    const regularTemplates = templates.filter(t => t.category !== 'nightlife' && t.category !== 'cultural');

    // Shuffle templates ensuring variety
    const shuffledRegular = [...regularTemplates].sort(() => Math.random() - 0.5);
    const shuffledNightlife = [...nightlifeTemplates].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(activitiesPerDay, timeSlots.length) && activities.length < activitiesPerDay; i++) {
      let selectedTemplate = null;

      // For the last slot, prefer nightlife if available
      if (i === activitiesPerDay - 1 && shuffledNightlife.length > 0) {
        selectedTemplate = shuffledNightlife.find(template => {
          const templateKey = `${template.title}-${template.location}`;
          return !usedTemplates.has(templateKey);
        });
      }

      // If no nightlife for last slot or not last slot, use regular templates
      if (!selectedTemplate) {
        for (const template of shuffledRegular) {
          const templateKey = `${template.title}-${template.location}`;
          if (!usedTemplates.has(templateKey)) {
            selectedTemplate = template;
            usedTemplates.add(templateKey);
            break;
          }
        }
      }
      
      if (selectedTemplate) {
        activities.push({
          time: timeSlots[i].time,
          title: selectedTemplate.title,
          description: selectedTemplate.description,
          location: selectedTemplate.location,
          address: selectedTemplate.address,
          coordinates: selectedTemplate.coordinates,
          duration: selectedTemplate.duration,
          cost: Math.round(this._convertCostToUSD(selectedTemplate.cost, trip.destination.destination) * 100) / 100, // Convert to USD with proper rounding
          category: selectedTemplate.category,
          notes: selectedTemplate.notes || 'AI-generated activity based on your preferences and budget'
        });
      }
    }
    
    // If we don't have enough activities, fill with generic ones
    while (activities.length < activitiesPerDay && activities.length < timeSlots.length) {
      const timeSlot = timeSlots[activities.length];
      activities.push({
        time: timeSlot.time,
        title: `Free Time - ${timeSlot.period.charAt(0).toUpperCase() + timeSlot.period.slice(1)} Exploration`,
        description: `Explore the local area at your own pace during ${timeSlot.period}`,
        location: `Area around ${trip.destination.destination}`,
        address: '',
        coordinates: this._generateCoordinates(trip.destination.destination),
        duration: 90,
        cost: 0,
        category: 'relaxation',
        notes: 'Flexible time for personal exploration'
      });
    }
    
    return activities;
  }

  /**
   * Generate coordinates based on destination
   * @param {string} destination - Destination name
   * @returns {Object} Coordinates object
   */
  _generateCoordinates(destination) {
    const coords = {
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'saigon': { lat: 10.7769, lng: 106.7009 },
      'ho chi minh': { lat: 10.7769, lng: 106.7009 },
      'vietnam': { lat: 10.7769, lng: 106.7009 }
    };
    
    const destLower = destination.toLowerCase();
    for (const [key, value] of Object.entries(coords)) {
      if (destLower.includes(key)) {
        return { 
          lat: value.lat + (Math.random() - 0.5) * 0.01, 
          lng: value.lng + (Math.random() - 0.5) * 0.01 
        };
      }
    }
    
    return { lat: 0, lng: 0 };
  }


}

module.exports = ActivityTemplateService;