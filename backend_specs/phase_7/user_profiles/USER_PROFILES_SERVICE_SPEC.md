# User Profiles & Followers Service Specification

## Overview
The User Profiles & Followers Service manages extended user profile information, social connections, and follower relationships. This service extends the core user service with social networking capabilities including profile customization, follower/following relationships, privacy controls, and social discovery features. The service integrates with the Authentication Service and User Service to provide a comprehensive social profile management system.

## API Endpoints

### 1. Update User Profile
- **Endpoint**: `PUT /api/user-profiles/profile`
- **Description**: Updates the authenticated user's profile information
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "displayName": "string",
  "bio": "string",
  "location": "string",
  "website": "string",
  "avatarUrl": "string",
  "coverPhotoUrl": "string",
  "interests": ["string"],
  "socialLinks": [{
    "platform": "string",
    "url": "string"
  }],
  "privacySettings": {
    "profileVisibility": "string", // public, followers, private
    "tripVisibility": "string", // public, followers, private
    "activityVisibility": "string" // public, followers, private
  }
}
```

#### Field Validations
- `displayName`:
  - Optional field
  - Maximum length: 50 characters
- `bio`:
  - Optional field
  - Maximum length: 500 characters
- `location`:
  - Optional field
  - Maximum length: 100 characters
- `website`:
  - Optional field
  - Must be a valid URL if provided
  - Maximum length: 200 characters
- `avatarUrl`:
  - Optional field
  - Must be a valid URL if provided
- `coverPhotoUrl`:
  - Optional field
  - Must be a valid URL if provided
- `interests`:
  - Optional array
  - Each item must be a string with maximum 30 characters
  - Maximum of 20 interests
- `socialLinks`:
  - Optional array
  - Maximum of 10 social links
  - `platform`: Must be one of: "facebook", "twitter", "instagram", "linkedin", "youtube", "tiktok", "pinterest"
  - `url`: Must be a valid URL
- `privacySettings.profileVisibility`:
  - Optional field
  - Must be one of: "public", "followers", "private"
- `privacySettings.tripVisibility`:
  - Optional field
  - Must be one of: "public", "followers", "private"
- `privacySettings.activityVisibility`:
  - Optional field
  - Must be one of: "public", "followers", "private"

#### Response Codes
- `200 OK`: Profile successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Retrieve existing user profile from database
5. Update profile fields with provided values
6. If privacy settings changed, update privacy settings record
7. Update updatedAt timestamp
8. Save updated profile record to database
9. Return updated profile data

### 2. Get User Profile
- **Endpoint**: `GET /api/user-profiles/profile/:userId`
- **Description**: Retrieves a user's profile information
- **Authentication**: Optional (for public profiles) / Required (for private profiles)

#### Request Parameters
- `userId`: User ID (URL parameter)

#### Response Codes
- `200 OK`: Profile successfully retrieved
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Required for private profiles
- `403 Forbidden`: User does not have permission to view this profile
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate user ID format
2. If authentication provided, validate JWT token
3. Retrieve user profile from database
4. If user not found, return 404 Not Found
5. Check profile privacy settings
6. If profile is private, verify authenticated user has permission to view
7. If profile is followers-only, verify authenticated user is following
8. Remove sensitive information from response
9. Return profile data

### 3. Follow User
- **Endpoint**: `POST /api/user-profiles/follow/:userId`
- **Description**: Follows a user
- **Authentication**: Required (JWT)

#### Request Parameters
- `userId`: User ID to follow (URL parameter)

#### Response Codes
- `200 OK`: Successfully followed user
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: User not found
- `409 Conflict`: User is already being followed
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload (follower)
3. Validate target user ID format
4. Verify target user exists
5. If user not found, return 404 Not Found
6. Check if follower is already following target user
7. If already following, return 409 Conflict
8. Create follow relationship record in database
9. Increment follower count for target user
10. Increment following count for follower user
11. Update user statistics in database
12. Send notification to target user (if enabled)
13. Return success response

### 4. Unfollow User
- **Endpoint**: `DELETE /api/user-profiles/follow/:userId`
- **Description**: Unfollows a user
- **Authentication**: Required (JWT)

#### Request Parameters
- `userId`: User ID to unfollow (URL parameter)

#### Response Codes
- `204 No Content`: Successfully unfollowed user
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: User not found or follow relationship not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload (follower)
3. Validate target user ID format
4. Verify target user exists
5. If user not found, return 404 Not Found
6. Check if follower is following target user
7. If not following, return 404 Not Found
8. Delete follow relationship record from database
9. Decrement follower count for target user
10. Decrement following count for follower user
11. Update user statistics in database
12. Return 204 No Content response

### 5. Get Followers
- **Endpoint**: `GET /api/user-profiles/followers/:userId`
- **Description**: Retrieves a user's followers
- **Authentication**: Optional (for public profiles) / Required (for private profiles)

#### Request Parameters
- `userId`: User ID (URL parameter)
- `limit` (optional): Number of followers to return (default: 20, max: 100)
- `offset` (optional): Number of followers to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: Followers successfully retrieved
- `400 Bad Request`: Invalid user ID format or query parameters
- `401 Unauthorized`: Required for private profiles
- `403 Forbidden`: User does not have permission to view followers
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate user ID format
2. If authentication provided, validate JWT token
3. Parse and validate query parameters
4. Retrieve user profile from database
5. If user not found, return 404 Not Found
6. Check profile privacy settings for followers list
7. If list is private, verify authenticated user has permission to view
8. Query database for user's followers with pagination
9. Return followers list with pagination metadata

### 6. Get Following
- **Endpoint**: `GET /api/user-profiles/following/:userId`
- **Description**: Retrieves users that a user is following
- **Authentication**: Optional (for public profiles) / Required (for private profiles)

#### Request Parameters
- `userId`: User ID (URL parameter)
- `limit` (optional): Number of following to return (default: 20, max: 100)
- `offset` (optional): Number of following to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: Following successfully retrieved
- `400 Bad Request`: Invalid user ID format or query parameters
- `401 Unauthorized`: Required for private profiles
- `403 Forbidden`: User does not have permission to view following
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate user ID format
2. If authentication provided, validate JWT token
3. Parse and validate query parameters
4. Retrieve user profile from database
5. If user not found, return 404 Not Found
6. Check profile privacy settings for following list
7. If list is private, verify authenticated user has permission to view
8. Query database for users that this user is following with pagination
9. Return following list with pagination metadata

### 7. Search Users
- **Endpoint**: `GET /api/user-profiles/search`
- **Description**: Searches for users by name, username, or interests
- **Authentication**: Required (JWT)

#### Request Parameters
- `query`: Search query string
- `limit` (optional): Number of users to return (default: 20, max: 50)
- `offset` (optional): Number of users to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: Users successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Parse and validate query parameters
3. Perform text search on user profiles using database text search
4. Apply privacy filters to exclude private profiles
5. Apply pagination to results
6. Return users list with pagination metadata

### 8. Get User Statistics
- **Endpoint**: `GET /api/user-profiles/stats/:userId`
- **Description**: Retrieves statistics for a user's profile and activity
- **Authentication**: Optional (for public stats) / Required (for private stats)

#### Request Parameters
- `userId`: User ID (URL parameter)

#### Response Codes
- `200 OK`: Statistics successfully retrieved
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Required for private statistics
- `403 Forbidden`: User does not have permission to view statistics
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate user ID format
2. If authentication provided, validate JWT token
3. Retrieve user profile from database
4. If user not found, return 404 Not Found
5. Check profile privacy settings for statistics
6. If statistics are private, verify authenticated user has permission to view
7. Retrieve user statistics from database including:
   - Trip count
   - Follower count
   - Following count
   - Total likes received
   - Total comments received
   - Achievement count
   - Join date
8. Return statistics data

## Data Models

### User Profile
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Reference to User Service user
  displayName: String,
  bio: String,
  location: String,
  website: String,
  avatarUrl: String,
  coverPhotoUrl: String,
  interests: [String],
  socialLinks: [{
    platform: String, // facebook, twitter, instagram, linkedin, youtube, tiktok, pinterest
    url: String
  }],
  stats: {
    tripsCount: Number,
    followersCount: Number,
    followingCount: Number,
    totalLikesReceived: Number,
    totalCommentsReceived: Number,
    achievementsCount: Number
  },
  privacySettings: {
    profileVisibility: String, // public, followers, private
    tripsVisibility: String, // public, followers, private
    activityVisibility: String, // public, followers, private
    allowMessaging: Boolean,
    showInSearch: Boolean
  },
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Follow Relationship
```javascript
{
  _id: ObjectId,
  followerId: ObjectId, // User who is following
  followingId: ObjectId, // User being followed
  createdAt: Date
}
```

### User Statistics
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  tripsCount: Number,
  publicTripsCount: Number,
  followersCount: Number,
  followingCount: Number,
  totalLikesReceived: Number,
  totalCommentsReceived: Number,
  achievementsCount: Number,
  engagementRate: Number, // Calculated metric
  joinDate: Date,
 lastActiveAt: Date,
  updatedAt: Date
}
```

### Profile View Log
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // User whose profile was viewed
  viewerId: ObjectId, // User who viewed the profile (null for anonymous)
  viewedAt: Date,
  ipAddress: String,
  userAgent: String
}
```

## Security Considerations
1. All endpoints require authentication via JWT tokens except for public profile viewing
2. Privacy settings must be respected for all profile information
3. Input validation must be performed on all fields
4. Rate limiting must be implemented to prevent abuse
5. Sensitive information must not be logged
6. HTTPS must be enforced in production environments
7. Profile view logging should respect user privacy
8. User statistics should not reveal sensitive information
9. Search functionality should not expose private profiles

## Performance Requirements
1. Profile retrieval should respond within 200ms for 95% of requests
2. Follow/unfollow operations should respond within 100ms
3. The service should support 10,000 concurrent users
4. User search should respond within 500ms
5. Database queries should be optimized with appropriate indexing
6. Caching should be implemented for frequently accessed profile data
7. Profile statistics should be updated asynchronously to avoid blocking operations
8. Pagination should support efficient infinite scrolling

## Integration Points
1. **Authentication Service**: For user authentication and authorization
2. **User Service**: For core user information and validation
3. **Trip Service**: For trip count and public trip information
4. **Notification Service**: For sending follow notifications
5. **Social Feed Service**: For integrating profile information in feeds
6. **Gamification Service**: For achievement count and statistics
7. **Analytics Service**: For tracking profile views and engagement metrics