# Trip Sharing & Collaboration Service Specification

## Overview
The Trip Sharing & Collaboration Service enables users to share their trips with others and collaborate on trip planning. This service handles permissions, real-time collaboration, and social features related to trip sharing. Users can invite others to view or edit their trips, comment on trip activities, and work together to plan travel experiences. The service integrates with the core Trip Service and Real-time Features Service to provide a seamless collaborative experience.

## API Endpoints

### 1. Share Trip
- **Endpoint**: `POST /api/trip-sharing/trips/:tripId/share`
- **Description**: Shares a trip with other users
- **Authentication**: Required (JWT)

#### Request Parameters
- `tripId`: Trip ID (URL parameter)

#### Request Body
```json
{
  "recipients": [{
    "userId": "string",
    "email": "string",
    "role": "string" // viewer, editor, owner
  }],
  "message": "string",
  "expirationDate": "ISO 8601 date"
}
```

#### Field Validations
- `recipients`:
  - Required field
  - Must contain at least one recipient
  - Maximum of 50 recipients
- `recipients.userId`:
  - Optional field (required if email not provided)
 - Must be a valid user ID
- `recipients.email`:
  - Optional field (required if userId not provided)
  - Must be a valid email format
- `recipients.role`:
  - Required field
  - Must be one of: "viewer", "editor", "owner"
- `message`:
  - Optional field
  - Maximum length: 500 characters
- `expirationDate`:
  - Optional field
  - Must be a valid date
  - Must be in the future

#### Response Codes
- `200 OK`: Trip successfully shared
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to share this trip
- `404 Not Found`: Trip not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate input fields according to validation rules
5. Retrieve trip record from database
6. Verify user has permission to share this trip (owner or editor with sharing rights)
7. If trip not found, return 404 Not Found
8. For each recipient:
   - If userId provided, verify user exists
   - If email provided and userId not found, send email invitation
   - Create or update sharing record in database
   - Set appropriate permissions based on role
9. If expirationDate provided, set sharing expiration
10. Send notification to recipients
11. Log sharing activity
12. Return success response

### 2. Get Trip Sharing Info
- **Endpoint**: `GET /api/trip-sharing/trips/:tripId`
- **Description**: Retrieves sharing information for a trip
- **Authentication**: Required (JWT)

#### Request Parameters
- `tripId`: Trip ID (URL parameter)

#### Response Codes
- `200 OK`: Sharing information successfully retrieved
- `400 Bad Request`: Invalid trip ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to view sharing info
- `404 Not Found`: Trip not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Retrieve trip record from database
5. Verify user has permission to view sharing info for this trip
6. If trip not found, return 404 Not Found
7. Retrieve sharing records for trip from database
8. Return sharing information including:
   - List of collaborators with roles
   - Sharing settings
   - Expiration information
   - Recent activity

### 3. Update Trip Sharing Permissions
- **Endpoint**: `PUT /api/trip-sharing/trips/:tripId/permissions/:userId`
- **Description**: Updates sharing permissions for a user on a trip
- **Authentication**: Required (JWT)

#### Request Parameters
- `tripId`: Trip ID (URL parameter)
- `userId`: User ID (URL parameter)

#### Request Body
```json
{
  "role": "string" // viewer, editor, owner
}
```

#### Field Validations
- `role`:
  - Required field
  - Must be one of: "viewer", "editor", "owner"

#### Response Codes
- `200 OK`: Permissions successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to update permissions
- `404 Not Found`: Trip or user not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID and user ID formats
4. Validate input fields according to validation rules
5. Retrieve trip record from database
6. Verify user has permission to update permissions (must be owner)
7. If trip not found, return 404 Not Found
8. Verify target user has existing sharing record for trip
9. If user not found, return 404 Not Found
10. Update sharing record with new role
11. If role is "owner", transfer ownership and update previous owner to "editor"
12. Send notification to affected user
13. Log permission change activity
14. Return success response

### 4. Remove Trip Access
- **Endpoint**: `DELETE /api/trip-sharing/trips/:tripId/access/:userId`
- **Description**: Removes a user's access to a shared trip
- **Authentication**: Required (JWT)

#### Request Parameters
- `tripId`: Trip ID (URL parameter)
- `userId`: User ID (URL parameter)

#### Response Codes
- `204 No Content`: Access successfully removed
- `400 Bad Request`: Invalid trip ID or user ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to remove access
- `404 Not Found`: Trip or user not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID and user ID formats
4. Retrieve trip record from database
5. Verify user has permission to remove access (must be owner or removing self)
6. If trip not found, return 404 Not Found
7. Verify target user has existing sharing record for trip
8. If user not found, return 404 Not Found
9. Delete sharing record from database
10. If user is removing self, send notification to trip owner
11. If owner is removing user, send notification to affected user
12. Log access removal activity
13. Return 204 No Content response

### 5. Get Shared Trips
- **Endpoint**: `GET /api/trip-sharing/shared-trips`
- **Description**: Retrieves trips shared with the authenticated user
- **Authentication**: Required (JWT)

#### Request Parameters
- `role` (optional): Filter by role (viewer, editor, owner)
- `limit` (optional): Number of trips to return (default: 20, max: 50)
- `offset` (optional): Number of trips to skip for pagination (default: 0)

#### Response Codes
- `200 OK`: Shared trips successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Parse and validate query parameters
4. Query database for trips shared with user
5. Apply role filtering if specified
6. Retrieve trip details from Trip Service
7. Apply pagination to results
8. Return shared trips list with pagination metadata

### 6. Comment on Trip Activity
- **Endpoint**: `POST /api/trip-sharing/trips/:tripId/comments`
- **Description**: Adds a comment to a trip or specific activity within a trip
- **Authentication**: Required (JWT)

#### Request Parameters
- `tripId`: Trip ID (URL parameter)

#### Request Body
```json
{
  "activityId": "string", // Optional, for commenting on specific activity
  "content": "string",
  "parentId": "string" // Optional, for nested comments
}
```

#### Field Validations
- `activityId`:
  - Optional field
  - Must be a valid activity ID if provided
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
- `403 Forbidden`: User does not have permission to comment on this trip
- `404 Not Found`: Trip or activity not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate input fields according to validation rules
5. Retrieve trip record from database
6. Verify user has permission to comment on this trip
7. If trip not found, return 404 Not Found
8. If activityId provided, verify activity exists in trip
9. If parentId provided, verify parent comment exists
10. Generate unique comment ID
11. Set comment creation timestamp
12. Set comment author to authenticated user
13. Create comment record in database
14. Send notification to trip collaborators (excluding author)
15. Trigger real-time update for comment
16. Return created comment data

### 7. Join Trip Collaboration
- **Endpoint**: `POST /api/trip-sharing/trips/:tripId/join`
- **Description**: Joins a trip collaboration session for real-time editing
- **Authentication**: Required (JWT)

#### Request Parameters
- `tripId`: Trip ID (URL parameter)

#### Response Codes
- `200 OK`: Successfully joined collaboration session
- `400 Bad Request`: Invalid trip ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to collaborate on this trip
- `404 Not Found`: Trip not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Retrieve trip record from database
5. Verify user has permission to collaborate on this trip (editor or owner)
6. If trip not found, return 404 Not Found
7. Generate collaboration session token
8. Add user to collaboration session in real-time service
9. Return session information and connection details

## Data Models

### Trip Sharing
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  ownerId: ObjectId,
  collaborators: [{
    userId: ObjectId,
    role: String, // viewer, editor, owner
    invitedAt: Date,
    joinedAt: Date,
    status: String // pending, accepted, declined
  }],
  settings: {
    allowEditing: Boolean,
    allowInviting: Boolean,
    allowDownloading: Boolean,
    visibility: String // private, link, public
  },
  invitationLink: String, // For link-based sharing
  expirationDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Trip Comment
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  activityId: ObjectId, // Optional, for activity-specific comments
  authorId: ObjectId,
  content: String,
  parentId: ObjectId, // For nested comments
  likes: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Collaboration Session
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  sessionId: String,
  participants: [{
    userId: ObjectId,
    joinedAt: Date,
    lastActiveAt: Date,
    permissions: {
      canEdit: Boolean,
      canInvite: Boolean
    }
  }],
  active: Boolean,
  createdAt: Date,
  expiresAt: Date
}
```

### Sharing Activity Log
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  userId: ObjectId,
  action: String, // shared, unshared, permission_changed, commented
  details: Object, // Action-specific details
  ipAddress: String,
  userAgent: String,
  createdAt: Date
}
```

## Security Considerations
1. All endpoints require authentication via JWT tokens
2. Users can only share trips they own or have sharing permissions for
3. Role-based access control must be enforced for all sharing operations
4. Input validation must be performed on all fields
5. Rate limiting must be implemented to prevent abuse
6. Sensitive information must not be logged
7. HTTPS must be enforced in production environments
8. Collaboration sessions must have secure token generation and validation
9. Real-time collaboration must only be accessible to authorized users
10. Audit logging must track all sharing and collaboration activities

## Performance Requirements
1. Trip sharing operations should respond within 300ms for 95% of requests
2. Real-time collaboration should have latency under 100ms
3. The service should support 5,000 concurrent collaboration sessions
4. Comment operations should respond within 200ms
5. Shared trips listing should respond within 500ms
6. Database queries should be optimized with appropriate indexing
7. Caching should be implemented for frequently accessed sharing information
8. WebSockets should be used for real-time collaboration features

## Integration Points
1. **Authentication Service**: For user authentication and authorization
2. **Trip Service**: For trip data and validation
3. **User Service**: For user profile information
4. **Notification Service**: For sending sharing notifications
5. **Real-time Features Service**: For collaborative editing sessions
6. **Analytics Service**: For tracking sharing and collaboration metrics