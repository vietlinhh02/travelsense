# Real-time Features Specification

## Overview
The Real-time Features service enables live communication and collaboration capabilities within the TravelSense v2 platform. This service implements WebSocket connections for real-time updates, collaborative trip planning, live notifications, and chat functionality. It provides a seamless experience for users working together on travel plans and receiving instant updates about their bookings and activities.

## WebSocket Endpoints

### 1. WebSocket Connection
- **Endpoint**: `wss://api.travelsense.v2/ws`
- **Description**: Establishes a WebSocket connection for real-time communication
- **Authentication**: Required (JWT token in query parameter)

#### Connection Parameters
- `token`: JWT authentication token

#### Connection Response
```json
{
 "event": "connected",
  "data": {
    "userId": "string",
    "sessionId": "string",
    "timestamp": "ISO 8601 date"
  }
}
```

#### Business Logic
1. Validate JWT token from query parameter
2. Extract user ID from token payload
3. Create WebSocket session for user
4. Store session information in memory or Redis
5. Send connection confirmation to client
6. Subscribe user to relevant channels based on their context

### 2. Join Trip Room
- **Event**: `join_trip_room`
- **Description**: Joins a user to a trip collaboration room
- **Authentication**: Required (via established WebSocket connection)

#### Request Payload
```json
{
  "tripId": "string"
}
```

#### Response Events
- `trip_room_joined`: Confirmation of successful room join
- `user_joined`: Notification to other room members
- `trip_updated`: Current trip state sent to joining user

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId

#### Business Logic
1. Validate trip ID format
2. Retrieve trip record from database by tripId
3. If trip not found, send error response
4. Verify user has access to this trip
5. If user lacks access, send error response
6. Add user to trip room in WebSocket server
7. Notify other room members of new user join
8. Send current trip state to joining user
9. Subscribe user to trip updates

### 3. Leave Trip Room
- **Event**: `leave_trip_room`
- **Description**: Removes a user from a trip collaboration room
- **Authentication**: Required (via established WebSocket connection)

#### Request Payload
```json
{
  "tripId": "string"
}
```

#### Response Events
- `trip_room_left`: Confirmation of successful room leave
- `user_left`: Notification to other room members

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId

#### Business Logic
1. Validate trip ID format
2. Check if user is in the specified trip room
3. If user not in room, send error response
4. Remove user from trip room in WebSocket server
5. Notify other room members of user leave
6. Unsubscribe user from trip updates

### 4. Send Trip Update
- **Event**: `trip_update`
- **Description**: Sends a real-time update for a trip to all room members
- **Authentication**: Required (via established WebSocket connection)

#### Request Payload
```json
{
  "tripId": "string",
  "updateType": "string", // Type of update
  "data": "object" // Update data
}
```

#### Broadcast Events
- `trip_updated`: Sent to all room members with update details

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `updateType`:
  - Required field
  - Must be one of: "activity_added", "activity_removed", "activity_updated", "day_added", "day_removed", "constraint_added", "constraint_removed"
- `data`:
  - Required field
  - Must be a valid JSON object

#### Business Logic
1. Validate trip ID format
2. Check if user is in the specified trip room
3. If user not in room, send error response
4. Validate updateType and data fields
5. Process update based on updateType:
   - For activity updates, validate activity data
   - For day updates, validate day data
   - For constraint updates, validate constraint data
6. Apply update to trip in database
7. Broadcast update to all room members
8. Log update for audit purposes

### 5. Send Chat Message
- **Event**: `chat_message`
- **Description**: Sends a chat message to all room members
- **Authentication**: Required (via established WebSocket connection)

#### Request Payload
```json
{
  "tripId": "string",
  "message": "string",
  "type": "string" // Optional message type
}
```

#### Broadcast Events
- `chat_message`: Sent to all room members with message details

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `message`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 1000 characters
- `type`:
  - Optional field
  - Must be one of: "text", "suggestion", "alert"

#### Business Logic
1. Validate trip ID format
2. Check if user is in the specified trip room
3. If user not in room, send error response
4. Validate message and type fields
5. Create message object with sender information and timestamp
6. Store message in database for persistence
7. Broadcast message to all room members
8. Send notification to users not currently in the room

### 6. Typing Indicator
- **Event**: `typing`
- **Description**: Sends typing indicator to room members
- **Authentication**: Required (via established WebSocket connection)

#### Request Payload
```json
{
  "tripId": "string",
  "isTyping": "boolean"
}
```

#### Broadcast Events
- `user_typing`: Sent to all room members with typing status

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `isTyping`:
  - Required field
  - Boolean value

#### Business Logic
1. Validate trip ID format
2. Check if user is in the specified trip room
3. If user not in room, send error response
4. Validate isTyping field
5. Broadcast typing status to all room members
6. Set timeout to automatically clear typing status after inactivity

### 7. Presence Update
- **Event**: `presence_update`
- **Description**: Updates user presence status in a room
- **Authentication**: Required (via established WebSocket connection)

#### Request Payload
```json
{
  "tripId": "string",
  "status": "string" // User presence status
}
```

#### Broadcast Events
- `user_presence_updated`: Sent to all room members with presence status

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `status`:
  - Required field
  - Must be one of: "online", "away", "busy", "offline"

#### Business Logic
1. Validate trip ID format
2. Check if user is in the specified trip room
3. If user not in room, send error response
4. Validate status field
5. Update user presence status in room
6. Broadcast presence update to all room members

## HTTP API Endpoints

### 1. Get Active Connections
- **Endpoint**: `GET /api/realtime/connections`
- **Description**: Retrieves information about active WebSocket connections (admin only)
- **Authentication**: Required (Admin JWT)

#### Response Codes
- `200 OK`: Connection information successfully retrieved
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Retrieve active WebSocket connection information
6. Format connection data for response
7. Return connection information

### 2. Broadcast Message
- **Endpoint**: `POST /api/realtime/broadcast`
- **Description**: Sends a message to all connected clients (admin only)
- **Authentication**: Required (Admin JWT)

#### Request Body
```json
{
  "message": "string",
  "type": "string" // Optional message type
}
```

#### Field Validations
- `message`:
  - Required field
  - Maximum length: 1000 characters
- `type`:
  - Optional field
  - Must be one of: "announcement", "alert", "maintenance"

#### Response Codes
- `200 OK`: Message successfully broadcast
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate input fields according to validation rules
6. Create broadcast message with admin information and timestamp
7. Send message to all active WebSocket connections
8. Log broadcast for audit purposes
9. Return success response

### 3. Disconnect User
- **Endpoint**: `POST /api/realtime/disconnect/:userId`
- **Description**: Forces disconnection of a specific user (admin only)
- **Authentication**: Required (Admin JWT)

#### Request Parameters
- `userId`: User ID to disconnect (URL parameter)

#### Response Codes
- `200 OK`: User successfully disconnected
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `404 Not Found`: User not found or not connected
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate user ID format
6. Check if user is currently connected via WebSocket
7. If user not connected, return 404 Not Found
8. Disconnect user's WebSocket connection
9. Clean up user session data
10. Log disconnection for audit purposes
11. Return success response

## Data Models

### WebSocket Session
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  sessionId: String, // Unique session identifier
  connectionTime: Date,
  lastActivity: Date,
  ip: String, // Client IP address
  userAgent: String, // Client user agent
  rooms: [String], // Trip IDs user is connected to
  status: String // "connected", "disconnected"
}
```

### Chat Message
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  userId: ObjectId,
  message: String,
  type: String, // "text", "suggestion", "alert"
  timestamp: Date,
  edited: Boolean,
  editedAt: Date
}
```

### Trip Update Log
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  userId: ObjectId,
  updateType: String, // "activity_added", "activity_removed", etc.
  data: Object, // Update details
  timestamp: Date
}
```

## Real-time Features

### Collaborative Trip Planning
1. **Multi-user Editing**: Multiple users can simultaneously edit a trip
2. **Conflict Resolution**: Automatic conflict detection and resolution
3. **Real-time Updates**: Instant synchronization of changes across all clients
4. **Presence Indicators**: Show which users are currently viewing/editing the trip
5. **Typing Indicators**: Show when users are actively making changes

### Live Notifications
1. **Instant Alerts**: Real-time notifications for important events
2. **Chat Messages**: Instant messaging between collaborators
3. **System Updates**: Platform-wide announcements and maintenance notifications
4. **Booking Updates**: Real-time booking status changes

### Connection Management
1. **Session Persistence**: Maintain connections across network interruptions
2. **Heartbeat Monitoring**: Detect and handle disconnected clients
3. **Load Balancing**: Distribute connections across multiple server instances
4. **Scalability**: Handle thousands of concurrent connections

## Security Considerations

### Authentication and Authorization
1. All WebSocket connections require valid JWT tokens
2. Users can only join rooms for trips they have access to
3. Admin-only endpoints require appropriate privileges
4. Rate limiting for connection attempts and message sending

### Data Protection
1. Input validation and sanitization for all real-time data
2. Encryption of data in transit using WSS (WebSocket Secure)
3. Secure storage of chat messages and update logs
4. Regular cleanup of expired session data

### Privacy
1. Users can only see presence information for trips they're collaborating on
2. Chat messages are only visible to trip collaborators
3. Personal information is not exposed in real-time updates
4. Option to disable presence indicators for privacy

## Performance Optimization

### Connection Handling
1. **Connection Pooling**: Efficient management of WebSocket connections
2. **Message Queuing**: Handle high-volume message traffic
3. **Broadcast Optimization**: Efficient distribution of messages to multiple recipients
4. **Compression**: Compress messages to reduce bandwidth usage

### Scalability
1. **Horizontal Scaling**: Distribute connections across multiple server instances
2. **Redis Pub/Sub**: Use Redis for message distribution in clustered environments
3. **Load Balancing**: Distribute connections evenly across servers
4. **Caching**: Cache frequently accessed data to reduce database queries

### Resource Management
1. **Memory Management**: Efficient use of memory for connection data
2. **Connection Limits**: Prevent resource exhaustion with connection limits
3. **Idle Timeout**: Automatically disconnect idle clients
4. **Monitoring**: Real-time monitoring of connection and resource usage

## Error Handling

### Connection Errors
1. **Authentication Failures**: Handle invalid or expired tokens
2. **Network Issues**: Gracefully handle network interruptions
3. **Server Errors**: Provide informative error messages for server issues
4. **Rate Limiting**: Handle excessive connection attempts or message sending

### Message Errors
1. **Validation Errors**: Handle invalid message formats
2. **Authorization Errors**: Handle unauthorized access attempts
3. **Data Errors**: Handle malformed or inconsistent data
4. **Broadcast Errors**: Handle failures in message distribution

## Monitoring and Logging

### Connection Metrics
1. **Active Connections**: Track number of currently connected clients
2. **Connection Rate**: Monitor new connection rate
3. **Disconnection Rate**: Track client disconnection patterns
4. **Session Duration**: Monitor average session length

### Message Metrics
1. **Message Volume**: Track number of messages sent/received
2. **Message Types**: Monitor distribution of message types
3. **Latency**: Measure message delivery latency
4. **Error Rates**: Track real-time communication errors

### Audit Logging
1. **Connection Events**: Log all connection and disconnection events
2. **Message Events**: Log important message exchanges
3. **Admin Actions**: Log all admin actions related to real-time features
4. **Security Events**: Log potential security incidents