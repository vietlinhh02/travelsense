# Push Notification Service Specification

## Overview
The Push Notification Service for Phase 6 is specifically designed to handle mobile push notifications for the TravelSense v2 platform. This service extends the core notification system with mobile-specific features such as device targeting, offline delivery queuing, rich media notifications, and enhanced delivery reliability. It provides optimized push notification delivery for mobile devices with support for both iOS and Android platforms, including handling of device token management, notification categorization, and delivery analytics.

## Key Features and Functionality
1. **Mobile-Optimized Delivery**: Specialized delivery mechanisms for iOS and Android platforms
2. **Device Token Management**: Registration, validation, and lifecycle management of device tokens
3. **Offline Delivery Queuing**: Queue notifications for delivery when devices come online
4. **Rich Media Support**: Support for images, videos, and interactive notifications
5. **Geofencing Integration**: Location-based push notifications
6. **Delivery Scheduling**: Time-based and condition-based notification scheduling
7. **Priority Management**: Intelligent notification prioritization for battery efficiency
8. **Analytics and Tracking**: Detailed delivery and engagement metrics
9. **A/B Testing**: Support for notification content testing
10. **Silent Notifications**: Background data synchronization triggers

## Technical Requirements
- **Runtime**: Node.js 18+
- **Framework**: Express.js with custom middleware
- **Push Providers**: Firebase Cloud Messaging (FCM) for Android, Apple Push Notification Service (APNs) for iOS
- **Database**: MongoDB for notification storage and device token management
- **Caching**: Redis for rate limiting and temporary storage
- **Message Queue**: RabbitMQ or Apache Kafka for async processing
- **Security**: HTTPS enforcement, JWT authentication, token encryption
- **Monitoring**: Integration with Prometheus and Grafana
- **Logging**: Structured logging with Winston

## API Endpoints

### 1. Register Device Token
- **Endpoint**: `POST /api/mobile/notifications/devices`
- **Description**: Registers a device token for push notifications
- **Authentication**: Required (JWT Access Token)

#### Request Body
```json
{
  "deviceToken": "string", // Device push token
  "deviceType": "string", // "ios" or "android"
  "deviceId": "string", // Unique device identifier
  "appName": "string" // Application name
}
```

#### Field Validations
- `deviceToken`:
  - Required field
  - Must be a valid device token format
- `deviceType`:
  - Required field
  - Must be one of: "ios", "android"
- `deviceId`:
  - Required field
  - Must be a unique device identifier
- `appName`:
  - Required field
  - Maximum length: 50 characters

#### Response Codes
- `201 Created`: Device token successfully registered
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Check if device token already exists for user
5. If token exists, update existing record
6. If token doesn't exist, create new device token record
7. Store device token with associated user ID
8. Return success response

### 2. Send Mobile Push Notification
- **Endpoint**: `POST /api/mobile/notifications/push`
- **Description**: Sends a push notification to mobile devices
- **Authentication**: Required (JWT Access Token)

#### Request Body
```json
{
  "userIds": ["string"], // Required user IDs to notify
  "title": "string", // Required notification title
  "body": "string", // Required notification body
  "data": "object", // Optional data payload
  "priority": "string", // Optional notification priority
  "channel": "string", // Optional notification channel
  "imageUrl": "string", // Optional image URL for rich notification
  "actionButtons": [
    {
      "id": "string", // Button identifier
      "title": "string", // Button title
      "action": "string" // Action to perform
    }
  ],
  "schedule": {
    "type": "string", // "immediate", "delayed", "recurring"
    "delay": "number", // Delay in seconds (for delayed)
    "time": "string", // Specific time (ISO 8601 format)
    "recurrence": "string" // Recurrence pattern
  }
}
```

#### Field Validations
- `userIds`:
  - Required field
  - Must be an array of valid MongoDB ObjectIds
  - Minimum of 1 item
  - Maximum of 10000 items
- `title`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 100 characters
- `body`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 500 characters
- `data`:
  - Optional field
  - Must be a valid JSON object if provided
- `priority`:
  - Optional field
  - Must be one of: "normal", "high"
- `channel`:
  - Optional field
  - Must be one of: "general", "bookings", "trips", "messages", "promotions"
- `imageUrl`:
  - Optional field
  - Must be a valid URL if provided
- `actionButtons`:
  - Optional field
  - Must be an array of button objects if provided
  - Maximum of 3 buttons
- `actionButtons[].id`:
  - Required if actionButtons provided
  - Maximum length: 20 characters
- `actionButtons[].title`:
  - Required if actionButtons provided
  - Maximum length: 20 characters
- `actionButtons[].action`:
  - Required if actionButtons provided
  - Maximum length: 50 characters
- `schedule.type`:
  - Required if schedule provided
  - Must be one of: "immediate", "delayed", "recurring"
- `schedule.delay`:
  - Required if schedule.type is "delayed"
  - Must be a positive integer
- `schedule.time`:
  - Required if schedule.type is "recurring"
  - Must be a valid ISO 8601 timestamp
- `schedule.recurrence`:
  - Optional field
  - Must be a valid recurrence pattern if provided

#### Response Codes
- `202 Accepted`: Push notification queued for sending
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Push notification service error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload (sender)
3. Validate input fields according to validation rules
4. Validate all user IDs
5. Retrieve device tokens for specified users from database
6. Check rate limits for sender
7. If rate limit exceeded, return 429 Too Many Requests
8. Process scheduling information if provided
9. For immediate notifications, queue for immediate delivery
10. For scheduled notifications, store in scheduled notifications collection
11. For recurring notifications, create recurring notification job
12. Store push notification record in database
13. Set notification status to "queued"
14. Set createdAt and updatedAt timestamps
15. Return success response with notification ID

### 3. Get Device Tokens
- **Endpoint**: `GET /api/mobile/notifications/devices`
- **Description**: Retrieves registered device tokens for the authenticated user
- **Authentication**: Required (JWT Access Token)

#### Response Codes
- `200 OK`: Device tokens successfully retrieved
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Retrieve device tokens associated with user from database
4. Format device token data for response
5. Return device tokens list

### 4. Remove Device Token
- **Endpoint**: `DELETE /api/mobile/notifications/devices/:deviceId`
- **Description**: Removes a device token from push notifications
- **Authentication**: Required (JWT Access Token)

#### Request Parameters
- `deviceId`: Device identifier (URL parameter)

#### Response Codes
- `204 No Content`: Device token successfully removed
- `400 Bad Request`: Invalid device ID format
- `401 Unauthorized`: Invalid or expired access token
- `404 Not Found`: Device token not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Validate device ID format
4. Retrieve device token record from database by device ID
5. If device token not found, return 404 Not Found
6. Verify user owns this device token
7. If user doesn't own token, return 403 Forbidden
8. Remove device token from database
9. Return 204 No Content response

### 5. Update Notification Preferences
- **Endpoint**: `PUT /api/mobile/notifications/preferences`
- **Description**: Updates mobile-specific notification preferences
- **Authentication**: Required (JWT Access Token)

#### Request Body
```json
{
  "push": {
    "enabled": "boolean",
    "channels": {
      "bookings": "boolean",
      "trips": "boolean",
      "messages": "boolean",
      "promotions": "boolean"
    },
    "quietHours": {
      "enabled": "boolean",
      "startTime": "string", // HH:MM format
      "endTime": "string" // HH:MM format
    },
    "doNotDisturb": {
      "enabled": "boolean",
      "days": ["string"] // Days when DND is active
    }
 }
}
```

#### Field Validations
- `push.enabled`:
  - Required field
  - Must be a boolean value
- `push.channels.bookings`:
  - Optional field
  - Must be a boolean value if provided
- `push.channels.trips`:
  - Optional field
  - Must be a boolean value if provided
- `push.channels.messages`:
  - Optional field
  - Must be a boolean value if provided
- `push.channels.promotions`:
  - Optional field
  - Must be a boolean value if provided
- `push.quietHours.enabled`:
  - Optional field
  - Must be a boolean value if provided
- `push.quietHours.startTime`:
  - Required if quietHours.enabled is true
  - Must be in HH:MM format (24-hour)
- `push.quietHours.endTime`:
  - Required if quietHours.enabled is true
  - Must be in HH:MM format (24-hour)
- `push.doNotDisturb.enabled`:
  - Optional field
  - Must be a boolean value if provided
- `push.doNotDisturb.days`:
  - Required if doNotDisturb.enabled is true
  - Must be an array of day names if provided
  - Valid values: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"

#### Response Codes
- `200 OK`: Notification preferences successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Retrieve existing mobile notification preferences from database
5. Update preferences with provided values
6. Validate quiet hours time format
7. Validate do not disturb days
8. Save updated preferences to database
9. Update updatedAt timestamp
10. Return updated preferences

### 6. Get Notification Analytics
- **Endpoint**: `GET /api/mobile/notifications/analytics`
- **Description**: Retrieves analytics data for mobile push notifications
- **Authentication**: Required (JWT Access Token)

#### Request Parameters
```json
{
  "startDate": "string", // ISO 8601 date
  "endDate": "string", // ISO 8601 date
  "metrics": ["string"] // Array of metrics to retrieve
}
```

#### Field Validations
- `startDate`:
  - Required field
  - Must be a valid ISO 8601 date
- `endDate`:
  - Required field
  - Must be a valid ISO 8601 date
  - Must be after startDate
- `metrics`:
  - Optional field
  - Must be an array of strings if provided
  - Valid values: "delivery_rate", "open_rate", "click_rate", "bounce_rate"

#### Response Codes
- `200 OK`: Analytics data successfully retrieved
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Validate query parameters according to validation rules
4. Retrieve analytics data for specified date range
5. Filter data based on requested metrics
6. Format analytics data for response
7. Return analytics data

## Data Models

### Mobile Device Token
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Associated user
  deviceToken: String, // Device push token (encrypted)
  deviceType: String, // "ios" or "android"
  deviceId: String, // Unique device identifier
  appName: String, // Application name
  lastAccessedAt: Date, // Last time device was active
 createdAt: Date,
  updatedAt: Date
}
```

### Mobile Push Notification
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Sender user ID
  userIds: [ObjectId], // Recipient user IDs
  title: String, // Notification title
  body: String, // Notification body
  data: Object, // Data payload
  priority: String, // "normal", "high"
  channel: String, // Notification channel
  imageUrl: String, // Image URL for rich notification
  actionButtons: [
    {
      id: String, // Button identifier
      title: String, // Button title
      action: String // Action to perform
    }
  ],
  schedule: {
    type: String, // "immediate", "delayed", "recurring"
    delay: Number, // Delay in seconds
    time: Date, // Specific time for scheduling
    recurrence: String // Recurrence pattern
  },
  status: String, // "queued", "sending", "sent", "delivered", "failed"
  providerIds: [String], // IDs from push providers
  deliveryStats: {
    queued: Number, // Number queued for delivery
    sent: Number, // Number sent
    delivered: Number, // Number delivered
    failed: Number // Number failed
  },
  createdAt: Date,
  updatedAt: Date,
  scheduledAt: Date, // When notification was scheduled
  sentAt: Date, // When notification sending completed
  deliveredAt: Date // When all notifications were delivered
}
```

### Mobile Notification Preferences
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  push: {
    enabled: Boolean,
    channels: {
      bookings: Boolean,
      trips: Boolean,
      messages: Boolean,
      promotions: Boolean
    },
    quietHours: {
      enabled: Boolean,
      startTime: String, // HH:MM format
      endTime: String // HH:MM format
    },
    doNotDisturb: {
      enabled: Boolean,
      days: [String] // Active DND days
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Analytics
```javascript
{
  _id: ObjectId,
  notificationId: ObjectId, // Reference to notification
  userId: ObjectId, // Recipient user ID
  deviceId: String, // Device identifier
  deviceType: String, // "ios" or "android"
  sentAt: Date, // When notification was sent
  deliveredAt: Date, // When notification was delivered
  openedAt: Date, // When notification was opened
  clickedAt: Date, // When notification action was clicked
  dismissedAt: Date, // When notification was dismissed
  error: String, // Error message if failed
  createdAt: Date
}
```

## Integration Points with Existing Services
1. **Notification Service**: Core notification system for shared functionality
2. **User Service**: For user profile and preference data
3. **Authentication Service**: For user authentication and token validation
4. **Analytics Service**: For collecting and reporting notification metrics
5. **Trip Service**: For trip-related notifications
6. **Booking Service**: For booking-related notifications

## Security Considerations
1. **Device Token Encryption**: All device tokens must be encrypted at rest
2. **Transport Security**: All communications must use HTTPS
3. **Authentication**: All endpoints require valid JWT tokens
4. **Authorization**: Users can only manage their own device tokens
5. **Rate Limiting**: Prevent abuse through rate limiting mechanisms
6. **Input Validation**: Strict validation of all input parameters
7. **Audit Logging**: Comprehensive logging of all notification operations
8. **Provider Security**: Secure storage of push provider credentials

## Performance Requirements
1. **Delivery Speed**: 95% of notifications delivered within 5 seconds
2. **Throughput**: Support for 100 concurrent notification sends
3. **Reliability**: 99.9% delivery success rate
4. **Scalability**: Horizontal scaling to support 1 million registered devices
5. **Battery Efficiency**: Optimize notifications to minimize battery drain
6. **Offline Handling**: Queue notifications for offline devices
7. **Retry Mechanisms**: Automatic retry for failed deliveries
8. **Load Balancing**: Distribute notification load across multiple instances

## Monitoring and Analytics
1. **Delivery Metrics**: Track delivery rates, latency, and failures
2. **Engagement Metrics**: Monitor open rates, click rates, and dismissals
3. **Device Analytics**: Track performance across different device types
4. **Error Tracking**: Capture and analyze delivery errors
5. **User Behavior**: Monitor notification preferences and opt-outs
6. **Provider Performance**: Track performance of different push providers
7. **Geographic Distribution**: Monitor delivery performance by region
8. **A/B Testing**: Track performance of different notification content

## Error Handling
1. **Device Token Errors**: Handle invalid or expired device tokens
2. **Provider Errors**: Handle push provider outages and errors
3. **Network Errors**: Implement retry mechanisms for network failures
4. **Rate Limiting**: Handle rate limit exceeded conditions
5. **Validation Errors**: Provide clear error messages for invalid input
6. **Authentication Errors**: Handle token expiration and invalid tokens
7. **Database Errors**: Implement fallback mechanisms for database issues
8. **Recovery Mechanisms**: Automatic recovery from common error conditions