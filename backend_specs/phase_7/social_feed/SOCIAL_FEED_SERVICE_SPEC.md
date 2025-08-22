# Social Feed Service Specification

## Overview
The Social Feed Service provides a centralized feed of user activities, trip updates, and community content. This service aggregates content from various sources to create a personalized feed for each user, supporting real-time updates and engagement features such as likes, comments, and shares. The service implements algorithms for content ranking and personalization to ensure users see the most relevant content.

## API Endpoints

### 1. Get User Feed
- **Endpoint**: `GET /api/feed`
- **Description**: Retrieves the personalized social feed for the authenticated user
- **Authentication**: Required (JWT)

#### Request Parameters
- `limit` (optional): Number of feed items to return (default: 20, max: 100)
- `offset` (optional): Number of feed items to skip for pagination (default: 0)
- `sortBy` (optional): Field to sort by (createdAt, relevance)
- `filter` (optional): Filter feed by content type (trips, posts, achievements)

#### Response Codes
- `200 OK`: Feed successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Parse and validate query parameters
4. Retrieve user's social connections (followers, friends)
5. Query database for feed items from user's connections
6. Apply content filtering based on user preferences
7. Rank and sort feed items based on relevance algorithm
8. Apply pagination to results
9. Return feed items with pagination metadata

### 2. Get User Activity Feed
- **Endpoint**: `GET /api/feed/user/:userId`
- **Description**: Retrieves the public activity feed for a specific user
- **Authentication**: Optional (for public feeds) / Required (for private feeds)

#### Request Parameters
- `userId`: User ID (URL parameter)
- `limit` (optional): Number of feed items to return (default: 20, max: 100)
- `offset` (optional): Number of feed items to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: User feed successfully retrieved
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Required for private feeds
- `403 Forbidden`: User does not have permission to view this feed
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate user ID format
2. If authentication provided, validate JWT token
3. Retrieve user profile to check privacy settings
4. If feed is private, verify authenticated user has permission to view
5. Parse and validate query parameters
6. Query database for user's public activity feed items
7. Apply pagination to results
8. Return feed items with pagination metadata

### 3. Create Feed Post
- **Endpoint**: `POST /api/feed/posts`
- **Description**: Creates a new post in the user's feed
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "content": "string",
  "media": [{
    "type": "string",
    "url": "string",
    "caption": "string"
  }],
  "visibility": "string", // public, followers, private
  "location": {
    "name": "string",
    "coordinates": {
      "lat": "number",
      "lng": "number"
    }
  },
  "tripId": "string" // Optional reference to a trip
}
```

#### Field Validations
- `content`:
  - Required field
  - Maximum length: 1000 characters
- `media`:
  - Optional array
  - Maximum of 10 media items
  - Each item must have type and url
  - `type`: Must be one of: "image", "video"
  - `url`: Must be a valid URL
  - `caption`: Optional, maximum 200 characters
- `visibility`:
  - Required field
  - Must be one of: "public", "followers", "private"
- `location.name`:
  - Optional field
  - Maximum length: 100 characters
- `location.coordinates.lat`:
  - Optional field
  - Must be between -90 and 90
- `location.coordinates.lng`:
  - Optional field
  - Must be between -180 and 180
- `tripId`:
  - Optional field
  - Must be a valid trip ID if provided

#### Response Codes
- `201 Created`: Post successfully created
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Referenced trip not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. If tripId provided, verify trip exists and user has access
5. Generate unique post ID
6. Set post creation and update timestamps
7. Set post author to authenticated user
8. Create post record in database
9. If post references a trip, create trip-post association
10. Trigger real-time update to followers' feeds
11. Return created post data

### 4. Like Feed Item
- **Endpoint**: `POST /api/feed/items/:itemId/like`
- **Description**: Adds a like to a feed item
- **Authentication**: Required (JWT)

#### Request Parameters
- `itemId`: Feed item ID (URL parameter)

#### Response Codes
- `200 OK`: Like successfully added
- `400 Bad Request`: Invalid item ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Feed item not found
- `409 Conflict`: User has already liked this item
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate item ID format
4. Retrieve feed item from database
5. If item not found, return 404 Not Found
6. Check if user has already liked this item
7. If already liked, return 409 Conflict
8. Create like record in database
9. Increment like count on feed item
10. Update feed item in database
11. Send notification to item author (if not self)
12. Trigger real-time update for like count
13. Return success response

### 5. Unlike Feed Item
- **Endpoint**: `DELETE /api/feed/items/:itemId/like`
- **Description**: Removes a like from a feed item
- **Authentication**: Required (JWT)

#### Request Parameters
- `itemId`: Feed item ID (URL parameter)

#### Response Codes
- `204 No Content`: Like successfully removed
- `400 Bad Request`: Invalid item ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Feed item not found or like not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate item ID format
4. Retrieve feed item from database
5. If item not found, return 404 Not Found
6. Check if user has liked this item
7. If not liked, return 404 Not Found
8. Delete like record from database
9. Decrement like count on feed item
10. Update feed item in database
11. Trigger real-time update for like count
12. Return 204 No Content response

### 6. Comment on Feed Item
- **Endpoint**: `POST /api/feed/items/:itemId/comments`
- **Description**: Adds a comment to a feed item
- **Authentication**: Required (JWT)

#### Request Parameters
- `itemId`: Feed item ID (URL parameter)

#### Request Body
```json
{
  "content": "string",
  "parentId": "string" // Optional, for nested comments
}
```

#### Field Validations
- `content`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 500 characters
- `parentId`:
  - Optional field
  - Must be a valid comment ID if provided

#### Response Codes
- `201 Created`: Comment successfully added
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Feed item not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate item ID format
4. Validate input fields according to validation rules
5. Retrieve feed item from database
6. If item not found, return 404 Not Found
7. If parentId provided, verify parent comment exists
8. Generate unique comment ID
9. Set comment creation timestamp
10. Set comment author to authenticated user
11. Create comment record in database
12. Increment comment count on feed item
13. Update feed item in database
14. Send notification to item author (if not self) and parent comment author (if applicable)
15. Trigger real-time update for comment
16. Return created comment data

### 7. Delete Comment
- **Endpoint**: `DELETE /api/feed/comments/:commentId`
- **Description**: Deletes a comment from a feed item
- **Authentication**: Required (JWT)

#### Request Parameters
- `commentId`: Comment ID (URL parameter)

#### Response Codes
- `204 No Content`: Comment successfully deleted
- `400 Bad Request`: Invalid comment ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to delete this comment
- `404 Not Found`: Comment not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate comment ID format
4. Retrieve comment from database
5. If comment not found, return 404 Not Found
6. Verify user is comment author or has admin privileges
7. If not authorized, return 403 Forbidden
8. Delete comment record from database
9. Decrement comment count on associated feed item
10. Update feed item in database
11. Delete any nested comments
12. Trigger real-time update for comment deletion
13. Return 204 No Content response

## Data Models

### Feed Item
```javascript
{
  _id: ObjectId,
  type: String, // post, trip_update, achievement
  authorId: ObjectId,
  content: String,
  media: [{
    type: String, // image, video
    url: String,
    caption: String
  }],
  visibility: String, // public, followers, private
  location: {
    name: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  metadata: {
    tripId: ObjectId, // For trip-related posts
    achievementId: ObjectId, // For achievement posts
    referenceId: ObjectId // For other reference types
  },
  engagement: {
    likes: Number,
    comments: Number,
    shares: Number
  },
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### Like
```javascript
{
  _id: ObjectId,
  itemId: ObjectId, // Reference to feed item
  userId: ObjectId, // User who liked the item
  createdAt: Date
}
```

### Comment
```javascript
{
  _id: ObjectId,
  itemId: ObjectId, // Reference to feed item
  authorId: ObjectId, // User who made the comment
  content: String,
  parentId: ObjectId, // For nested comments
  likes: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Feed Preferences
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  contentFilters: {
    hideTripUpdates: Boolean,
    hideAchievements: Boolean,
    hidePromotional: Boolean
  },
  notificationSettings: {
    newLikes: Boolean,
    newComments: Boolean,
    newFollowers: Boolean
  },
  createdAt: Date,
 updatedAt: Date
}
```

## Security Considerations
1. All endpoints require authentication via JWT tokens except for public feeds
2. Users can only view feeds based on their connection and privacy settings
3. Input validation must be performed on all fields
4. Rate limiting must be implemented to prevent spam
5. Sensitive information must not be logged
6. HTTPS must be enforced in production environments
7. Content moderation mechanisms must be in place for user-generated content
8. Privacy settings must be respected for all content visibility
9. Real-time updates should only be sent to authorized users

## Performance Requirements
1. Feed retrieval should respond within 500ms for 95% of requests
2. Real-time updates should be delivered within 100ms
3. The service should support 10,00 concurrent users
4. Feed personalization algorithms should update within 1 second of user actions
5. Media content should be served through a CDN for optimal performance
6. Database queries should be optimized with appropriate indexing
7. Caching should be implemented for frequently accessed feed data
8. Feed pagination should support efficient infinite scrolling

## Integration Points
1. **Authentication Service**: For user authentication and authorization
2. **User Service**: For user profile information and social connections
3. **Trip Service**: For trip-related content and references
4. **Notification Service**: For sending engagement notifications
5. **Real-time Features Service**: For live feed updates
6. **Analytics Service**: For tracking engagement metrics
7. **Media Service**: For storing and serving user media content