# Review System Specification

## Overview
The Review System manages all aspects of user reviews and ratings for providers and services on the TravelSense v2 platform. This service handles review submission, moderation, aggregation, and display. It provides users with the ability to share their experiences and helps other users make informed decisions based on community feedback.

## API Endpoints

### 1. Submit Review
- **Endpoint**: `POST /api/reviews`
- **Description**: Submits a new review for a provider or service
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "providerId": "string", // Required if not reviewing a specific service
  "serviceId": "string", // Optional: review for specific service
  "bookingId": "string", // Optional: link to booking
  "tripId": "string", // Optional: link to trip
  "rating": "number", // Required rating (1-5 stars)
  "title": "string", // Required review title
  "comment": "string", // Required detailed review comment
  "pros": ["string"], // Optional list of positive aspects
  "cons": ["string"], // Optional list of negative aspects
  "photos": ["string"] // Optional array of photo URLs
}
```

#### Field Validations
- `providerId`:
  - Required if serviceId not provided
  - Must be a valid MongoDB ObjectId
- `serviceId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `bookingId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `tripId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `rating`:
  - Required field
  - Must be an integer between 1 and 5
- `title`:
  - Required field
  - Minimum length: 5 characters
  - Maximum length: 100 characters
- `comment`:
  - Required field
  - Minimum length: 20 characters
  - Maximum length: 2000 characters
- `pros`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 10 items
- `cons`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 10 items
- `photos`:
  - Optional array
  - Each item must be a valid URL
  - Maximum of 5 items

#### Response Codes
- `201 Created`: Review successfully submitted
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Provider, service, booking, or trip not found
- `409 Conflict`: User has already reviewed this provider/service
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Ensure either providerId or serviceId is provided
5. Retrieve provider record if providerId provided
6. Retrieve service record if serviceId provided
7. If provider or service not found, return 404 Not Found
8. If bookingId provided, retrieve booking and verify user access
9. If tripId provided, retrieve trip and verify user access
10. Check if user has already submitted a review for this provider/service
11. If duplicate review found, return 409 Conflict
12. Generate a unique review ID
13. Set review status to "pending" (awaiting moderation)
14. Set createdAt and updatedAt timestamps
15. Create review record in database
16. Send confirmation email to user
17. Return created review data (excluding moderation fields)

### 2. Get Reviews
- **Endpoint**: `GET /api/reviews`
- **Description**: Retrieves reviews with optional filtering and pagination
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "providerId": "string", // Optional filter by provider
  "serviceId": "string", // Optional filter by service
  "userId": "string", // Optional filter by user (own reviews only)
  "rating": "number", // Optional filter by rating
  "status": "string", // Optional filter by status
  "limit": "number", // Optional number of results (default: 20, max: 50)
  "offset": "number", // Optional offset for pagination (default: 0)
  "sortBy": "string", // Optional sort field (createdAt, rating, helpful)
  "sortOrder": "string" // Optional sort order (asc, desc)
}
```

#### Field Validations
- `providerId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `serviceId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `userId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `rating`:
  - Optional field
  - Must be an integer between 1 and 5
- `status`:
  - Optional field
  - Must be one of: "pending", "approved", "rejected"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 20 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified
- `sortBy`:
  - Optional field
  - Must be one of: "createdAt", "rating", "helpful"
- `sortOrder`:
  - Optional field
  - Must be one of: "asc", "desc"

#### Response Codes
- `200 OK`: Reviews successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Authentication required for user-specific filters
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate query parameters according to validation rules
2. If userId filter is specified, validate JWT token
3. If userId filter is specified, verify user ID matches authenticated user
4. Build database query based on provided filters
5. Apply pagination parameters
6. Execute query to retrieve reviews
7. Format results for response (exclude moderation fields for non-admins)
8. Return reviews list with pagination metadata

### 3. Get Review Details
- **Endpoint**: `GET /api/reviews/:id`
- **Description**: Retrieves detailed information for a specific review
- **Authentication**: Not required (public endpoint)

#### Request Parameters
- `id`: Review ID (URL parameter)

#### Response Codes
- `200 OK`: Review details successfully retrieved
- `400 Bad Request`: Invalid review ID format
- `404 Not Found`: Review not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate review ID format
2. Retrieve review record from database by ID
3. If review not found, return 404 Not Found
4. If review status is not "approved", check user permissions
5. If review not approved and user lacks permissions, return 404 Not Found
6. Format review details for response
7. Return review details

### 4. Update Review
- **Endpoint**: `PUT /api/reviews/:id`
- **Description**: Updates a review (limited window after submission)
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "rating": "number",
  "title": "string",
  "comment": "string",
  "pros": ["string"],
  "cons": ["string"]
}
```

#### Field Validations
- `rating`:
  - Required field
  - Must be an integer between 1 and 5
- `title`:
  - Required field
  - Minimum length: 5 characters
  - Maximum length: 100 characters
- `comment`:
  - Required field
  - Minimum length: 20 characters
  - Maximum length: 2000 characters
- `pros`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 10 items
- `cons`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 10 items

#### Response Codes
- `200 OK`: Review successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to update this review
- `404 Not Found`: Review not found
- `409 Conflict`: Review cannot be modified (time limit or status)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate review ID format
4. Retrieve review record from database by ID
5. If review not found, return 404 Not Found
6. Verify user is the author of this review
7. If user is not author, return 403 Forbidden
8. Check if review can be modified (within time limit and status)
9. If review cannot be modified, return 409 Conflict
10. Validate input fields according to validation rules
11. Update review fields with provided values
12. Update updatedAt timestamp
13. Save updated review record to database
14. Return updated review data

### 5. Delete Review
- **Endpoint**: `DELETE /api/reviews/:id`
- **Description**: Deletes a review (limited window after submission)
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Review ID (URL parameter)

#### Response Codes
- `204 No Content`: Review successfully deleted
- `400 Bad Request`: Invalid review ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to delete this review
- `404 Not Found`: Review not found
- `409 Conflict`: Review cannot be deleted (time limit or status)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate review ID format
4. Retrieve review record from database by ID
5. If review not found, return 404 Not Found
6. Verify user is the author of this review
7. If user is not author, return 403 Forbidden
8. Check if review can be deleted (within time limit and status)
9. If review cannot be deleted, return 409 Conflict
10. Delete review record from database
11. Update provider/service rating statistics
12. Return 204 No Content response

### 6. Moderate Review
- **Endpoint**: `PUT /api/reviews/:id/moderate`
- **Description**: Moderates a review (admin only)
- **Authentication**: Required (JWT) - Admin only

#### Request Body
```json
{
  "status": "string", // Required moderation status
  "reason": "string" // Optional moderation reason
}
```

#### Field Validations
- `status`:
  - Required field
  - Must be one of: "approved", "rejected"
- `reason`:
  - Optional field
  - Maximum length: 200 characters

#### Response Codes
- `200 OK`: Review successfully moderated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `404 Not Found`: Review not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate review ID format
6. Retrieve review record from database by ID
7. If review not found, return 404 Not Found
8. Validate input fields according to validation rules
9. Update review moderation status
10. Set moderatedBy field to admin user ID
11. Set moderatedAt timestamp
12. If status is "approved", update provider/service rating statistics
13. If status is "rejected", notify review author
14. Update updatedAt timestamp
15. Save updated review record to database
16. Return updated review data

### 7. Mark Review Helpful
- **Endpoint**: `POST /api/reviews/:id/helpful`
- **Description**: Marks a review as helpful (or removes helpful mark)
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Review ID (URL parameter)

#### Request Body
```json
{
  "helpful": "boolean" // Required: true to mark helpful, false to remove
}
```

#### Field Validations
- `helpful`:
  - Required field
  - Boolean value

#### Response Codes
- `200 OK`: Helpful status successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Review not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate review ID format
4. Retrieve review record from database by ID
5. If review not found, return 404 Not Found
6. Validate input fields according to validation rules
7. Update helpful count based on current user status and request
8. Add or remove user ID from helpful users array
9. Update updatedAt timestamp
10. Save updated review record to database
11. Return updated helpful count

### 8. Get Provider Rating Stats
- **Endpoint**: `GET /api/reviews/stats/:providerId`
- **Description**: Retrieves rating statistics for a provider
- **Authentication**: Not required (public endpoint)

#### Request Parameters
- `providerId`: Provider ID (URL parameter)

#### Response Codes
- `200 OK`: Rating statistics successfully retrieved
- `400 Bad Request`: Invalid provider ID format
- `404 Not Found`: Provider not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate provider ID format
2. Retrieve provider record from database by providerId
3. If provider not found, return 404 Not Found
4. Calculate rating statistics from approved reviews
5. Format statistics for response
6. Return rating statistics including:
   - Average rating
   - Total review count
   - Rating distribution (count for each star rating)
   - Recent reviews (limited count)

## Data Models

### Review
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  providerId: ObjectId,
  serviceId: ObjectId, // Optional: review for specific service
  bookingId: ObjectId, // Optional: link to booking
  tripId: ObjectId, // Optional: link to trip
 rating: Number, // 1-5
  title: String,
  comment: String,
  pros: [String],
  cons: [String],
  photos: [String], // URLs to photo uploads
  helpful: {
    count: Number,
    users: [ObjectId] // Users who found review helpful
  },
  status: String, // "pending", "approved", "rejected"
  moderatedBy: ObjectId, // Admin who moderated
  moderatedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Provider Rating Stats
```javascript
{
  _id: ObjectId,
  providerId: ObjectId,
  averageRating: Number, // 0-5
  totalReviews: Number,
  ratingDistribution: {
    "5": Number, // Count of 5-star reviews
    "4": Number, // Count of 4-star reviews
    "3": Number, // Count of 3-star reviews
    "2": Number, // Count of 2-star reviews
    "1": Number  // Count of 1-star reviews
  },
  lastUpdated: Date
}
```

## Review Moderation Workflow

### Status Transitions
1. **pending** → **approved**: Review approved by moderator
2. **pending** → **rejected**: Review rejected by moderator
3. **approved** → **rejected**: Review re-moderated (exceptional cases)
4. **rejected** → **approved**: Review re-moderated (exceptional cases)

### Moderation Guidelines
1. Reviews must be relevant to the provider/service
2. Reviews must be factual and not contain false information
3. Reviews must not contain hate speech or discriminatory content
4. Reviews must not contain personal attacks or harassment
5. Reviews must not contain spam or promotional content
6. Reviews must not violate privacy (names, contact info, etc.)
7. Reviews must not contain explicit content

### Automated Moderation
1. Profanity filtering
2. Spam detection
3. Duplicate content detection
4. URL/link filtering
5. Length validation

## Rating Calculation

### Provider Rating
1. Weighted average of all approved service reviews
2. Updated in real-time as new reviews are approved
3. Recalculated when reviews are moderated

### Service Rating
1. Simple average of all approved reviews for the service
2. Updated in real-time as new reviews are approved
3. Recalculated when reviews are moderated

## Security Considerations
1. All endpoints require authentication via JWT tokens (except public read endpoints)
2. Users can only submit reviews for services they've booked
3. Users can only modify/delete their own reviews
4. Review moderation is restricted to admins only
5. Input validation must be performed on all fields
6. Rate limiting must be implemented to prevent abuse
7. HTTPS must be enforced in production environments
8. Photo uploads must be properly validated and sanitized
9. Review content must be sanitized to prevent XSS attacks