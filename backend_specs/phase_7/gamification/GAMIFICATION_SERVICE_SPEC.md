# Gamification & Achievements Service Specification

## Overview
The Gamification & Achievements Service implements the platform's gamification features including achievements, badges, leaderboards, and reward systems to encourage user engagement and participation. This service tracks user activities, evaluates progress toward achievements, awards badges, maintains leaderboards, and manages reward distribution. The service integrates with other platform services to monitor user actions and trigger gamification events.

## API Endpoints

### 1. Get User Achievements
- **Endpoint**: `GET /api/gamification/users/:userId/achievements`
- **Description**: Retrieves a user's earned achievements and progress
- **Authentication**: Optional (for public profiles) / Required (for private profiles)

#### Request Parameters
- `userId`: User ID (URL parameter)
- `includeProgress` (optional): Include progress toward unearned achievements (default: false)

#### Response Codes
- `200 OK`: Achievements successfully retrieved
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Required for private achievement lists
- `403 Forbidden`: User does not have permission to view achievements
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate user ID format
2. If authentication provided, validate JWT token
3. Parse and validate query parameters
4. Retrieve user profile from database
5. If user not found, return 404 Not Found
6. Check profile privacy settings for achievements
7. If achievements are private, verify authenticated user has permission to view
8. Query database for user's earned achievements
9. If includeProgress is true, calculate progress toward unearned achievements
10. Return achievements data

### 2. Get Achievement Details
- **Endpoint**: `GET /api/gamification/achievements/:achievementId`
- **Description**: Retrieves details for a specific achievement
- **Authentication**: Not required

#### Request Parameters
- `achievementId`: Achievement ID (URL parameter)

#### Response Codes
- `200 OK`: Achievement details successfully retrieved
- `400 Bad Request`: Invalid achievement ID format
- `404 Not Found`: Achievement not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate achievement ID format
2. Retrieve achievement record from database
3. If achievement not found, return 404 Not Found
4. Return achievement details including:
   - Name and description
   - Badge information
   - Criteria for earning
   - Reward information
   - Statistics (earned count, etc.)

### 3. Get Leaderboard
- **Endpoint**: `GET /api/gamification/leaderboards/:leaderboardId`
- **Description**: Retrieves leaderboard rankings
- **Authentication**: Not required

#### Request Parameters
- `leaderboardId`: Leaderboard ID (URL parameter)
- `timeRange` (optional): Time range filter (all_time, yearly, monthly, weekly, daily)
- `limit` (optional): Number of users to return (default: 20, max: 100)
- `offset` (optional): Number of users to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: Leaderboard successfully retrieved
- `400 Bad Request`: Invalid leaderboard ID format or query parameters
- `404 Not Found`: Leaderboard not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate leaderboard ID format
2. Parse and validate query parameters
3. Retrieve leaderboard record from database
4. If leaderboard not found, return 404 Not Found
5. Query database for leaderboard rankings based on criteria
6. Apply time range filter if specified
7. Apply pagination to results
8. Return leaderboard data with rankings

### 4. Get User Rank
- **Endpoint**: `GET /api/gamification/leaderboards/:leaderboardId/rank/:userId`
- **Description**: Retrieves a user's rank in a specific leaderboard
- **Authentication**: Not required

#### Request Parameters
- `leaderboardId`: Leaderboard ID (URL parameter)
- `userId`: User ID (URL parameter)
- `timeRange` (optional): Time range filter (all_time, yearly, monthly, weekly, daily)

#### Response Codes
- `200 OK`: User rank successfully retrieved
- `400 Bad Request`: Invalid leaderboard ID or user ID format
- `404 Not Found`: Leaderboard or user not found, or user not ranked
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate leaderboard ID and user ID formats
2. Parse and validate query parameters
3. Retrieve leaderboard record from database
4. If leaderboard not found, return 404 Not Found
5. Calculate user's rank in leaderboard based on criteria
6. Apply time range filter if specified
7. If user is not ranked, return 404 Not Found
8. Return user's rank information

### 5. Get Available Badges
- **Endpoint**: `GET /api/gamification/badges`
- **Description**: Retrieves all available badges in the system
- **Authentication**: Not required

#### Request Parameters
- `category` (optional): Filter badges by category
- `limit` (optional): Number of badges to return (default: 50, max: 100)
- `offset` (optional): Number of badges to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: Badges successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Parse and validate query parameters
2. Query database for available badges
3. Apply category filter if specified
4. Apply pagination to results
5. Return badges list with pagination metadata

### 6. Claim Reward
- **Endpoint**: `POST /api/gamification/rewards/:rewardId/claim`
- **Description**: Claims a reward that has been earned by the user
- **Authentication**: Required (JWT)

#### Request Parameters
- `rewardId`: Reward ID (URL parameter)

#### Response Codes
- `200 OK`: Reward successfully claimed
- `400 Bad Request`: Invalid reward ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Reward not found or not available to user
- `409 Conflict`: Reward has already been claimed
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate reward ID format
4. Retrieve reward record from database
5. If reward not found, return 404 Not Found
6. Verify user is eligible to claim this reward
7. Check if reward has already been claimed by user
8. If already claimed, return 409 Conflict
9. Process reward claim based on reward type:
   - For virtual currency: Update user's balance
   - For physical items: Create fulfillment request
   - For discounts: Generate discount code
10. Create reward claim record in database
11. Send notification to user about successful claim
12. Return claim confirmation and reward details

### 7. Get User Rewards
- **Endpoint**: `GET /api/gamification/users/:userId/rewards`
- **Description**: Retrieves a user's earned and claimed rewards
- **Authentication**: Required (JWT)

#### Request Parameters
- `userId`: User ID (URL parameter)
- `status` (optional): Filter by status (earned, claimed, expired)

#### Response Codes
- `200 OK`: Rewards successfully retrieved
- `400 Bad Request`: Invalid user ID format or query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to view rewards
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate user ID format
4. Verify requesting user has permission to view target user's rewards
5. Parse and validate query parameters
6. Retrieve user record from database
7. If user not found, return 404 Not Found
8. Query database for user's rewards based on status filter
9. Return rewards list

## Data Models

### Achievement
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String, // travel, social, community, etc.
  badgeId: ObjectId, // Reference to associated badge
 criteria: {
    type: String, // trips_created, trips_completed, followers, posts, etc.
    threshold: Number, // Number of actions required
    conditions: Object // Additional conditions
  },
  rewardId: ObjectId, // Reference to associated reward
  points: Number, // Points awarded for achievement
  rarity: String, // common, uncommon, rare, epic, legendary
  isSecret: Boolean, // Hidden until earned
  createdAt: Date,
  updatedAt: Date
}
```

### Badge
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  iconUrl: String,
  rarity: String, // common, uncommon, rare, epic, legendary
  category: String,
 isAnimated: Boolean,
  createdAt: Date
}
```

### User Achievement
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  achievementId: ObjectId,
  progress: Number, // Current progress toward achievement
  isEarned: Boolean,
  earnedAt: Date, // When achievement was earned
  claimedRewards: Boolean, // Whether associated rewards have been claimed
  createdAt: Date,
  updatedAt: Date
}
```

### Leaderboard
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  criteria: {
    metric: String, // trips_count, points, followers, etc.
    aggregation: String // sum, max, count
  },
  timeRange: String, // all_time, yearly, monthly, weekly, daily
  resetFrequency: String, // never, yearly, monthly, weekly, daily
  lastResetAt: Date,
  isActive: Boolean,
  createdAt: Date
}
```

### Leaderboard Ranking
```javascript
{
  _id: ObjectId,
  leaderboardId: ObjectId,
  userId: ObjectId,
  rank: Number,
  value: Number, // Metric value for ranking
  period: {
    start: Date,
    end: Date
  },
  lastUpdated: Date
}
```

### Reward
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
 type: String, // virtual_currency, discount, physical_item, exclusive_content
  value: Object, // Details specific to reward type
  availability: {
    startDate: Date,
    endDate: Date,
    maxClaims: Number,
    claimsPerUser: Number
  },
  associatedAchievementId: ObjectId, // Optional link to achievement
  createdAt: Date,
  updatedAt: Date
}
```

### User Reward
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  rewardId: ObjectId,
  status: String, // earned, claimed, expired
  earnedAt: Date,
  claimedAt: Date,
  expiresAt: Date,
  claimDetails: Object, // Details about how reward was claimed
  createdAt: Date
}
```

### Gamification Event
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  eventType: String, // trip_created, trip_completed, post_shared, etc.
  eventData: Object, // Event-specific data
  pointsAwarded: Number,
  timestamp: Date,
  ipAddress: String,
  userAgent: String
}
```

## Security Considerations
1. Reward claiming requires authentication to prevent abuse
2. Leaderboard data should not reveal personally identifiable information
3. Secret achievements should remain hidden until earned
4. Input validation must be performed on all fields
5. Rate limiting should be implemented for reward claiming
6. HTTPS must be enforced in production environments
7. Reward fulfillment information should be securely handled
8. Achievement progress should be accurately tracked and validated

## Performance Requirements
1. Achievement retrieval should respond within 200ms for 95% of requests
2. Leaderboard queries should respond within 300ms
3. The service should support 10,000 concurrent users
4. Achievement evaluation should happen asynchronously to avoid blocking operations
5. Database queries should be optimized with appropriate indexing
6. Caching should be implemented for frequently accessed leaderboard data
7. Real-time leaderboard updates should be efficient
8. Event processing should be scalable to handle high volumes

## Integration Points
1. **Authentication Service**: For user authentication and authorization
2. **User Service**: For user profile information
3. **Trip Service**: For tracking trip-related achievements
4. **Social Feed Service**: For tracking social interactions
5. **Notification Service**: For sending achievement notifications
6. **Analytics Service**: For tracking gamification metrics
7. **Payment Service**: For handling reward fulfillment (if applicable)