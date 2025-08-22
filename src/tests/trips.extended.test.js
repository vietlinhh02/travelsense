const request = require('supertest');
const createTestApp = require('./setup/testApp');
const { clearMockDB } = require('./setup/mockDb');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Create test app instance
const app = createTestApp();

// Mock dependencies
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock trip service
const mockTripService = {
  createTrip: jest.fn(),
  getUserTrips: jest.fn(),
  getTripDetails: jest.fn(),
  updateTrip: jest.fn(),
  deleteTrip: jest.fn(),
  generateDraftSchedule: jest.fn(),
  optimizeTrip: jest.fn(),
  exportTrip: jest.fn(),
  addActivityToDay: jest.fn(),
  updateActivity: jest.fn(),
  deleteActivity: jest.fn()
};

jest.mock('../services/trips', () => ({
  tripService: mockTripService
}));

describe('Trip Management Extended Test Suite', () => {
  const API_BASE = '/api/v1/trips';
  
  let testUser;
  let authToken;
  let userId;

  beforeEach(async () => {
    await clearMockDB();
    jest.clearAllMocks();
    
    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create mock test user
    userId = '507f1f77bcf86cd799439011';
    testUser = {
      _id: userId,
      email: 'trip.extended.test@example.com',
      firstName: 'Trip',
      lastName: 'Tester'
    };

    // Generate JWT token for authentication
    authToken = jwt.sign(
      { userId: testUser._id },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpirationMinutes + 'm' }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/trips/:id/schedule/generate - Generate Draft Schedule', () => {
    const tripId = '507f1f77bcf86cd799439012';

    describe('Successful Draft Schedule Generation', () => {
      it('should successfully generate draft schedule with focus', async () => {
        const focusData = {
          focus: 'cultural'
        };

        const mockResult = {
          _id: tripId,
          name: 'Paris Trip',
          itinerary: {
            days: [
              {
                dayNumber: 1,
                activities: [
                  {
                    id: 'activity-1',
                    title: 'Visit Louvre Museum',
                    type: 'cultural'
                  }
                ]
              }
            ]
          }
        };

        mockTripService.generateDraftSchedule.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/schedule/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(focusData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Draft schedule generated successfully');
        expect(response.body.data.trip).toEqual(mockResult);
        expect(mockTripService.generateDraftSchedule).toHaveBeenCalledWith(tripId, userId, { focus: 'cultural' });
      });

      it('should log successful draft schedule generation', async () => {
        const mockResult = {
          _id: tripId,
          name: 'Paris Trip'
        };

        mockTripService.generateDraftSchedule.mockResolvedValue(mockResult);

        await request(app)
          .post(`${API_BASE}/${tripId}/schedule/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'adventure' })
          .expect(200);

        expect(console.log).toHaveBeenCalledWith(`Draft schedule generated for trip: Paris Trip for user ${userId}`);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when focus is invalid', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/schedule/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'invalid-focus' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Focus must be one of');
      });

      it('should return 400 when tripId is invalid', async () => {
        const response = await request(app)
          .post(`${API_BASE}/invalid-trip-id/schedule/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'cultural' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Trip ID must be a valid ObjectId');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when no token is provided', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/schedule/generate`)
          .send({ focus: 'cultural' })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle service errors when generating draft schedule', async () => {
        const serviceError = new Error('Draft schedule generation failed');
        mockTripService.generateDraftSchedule.mockRejectedValue(serviceError);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/schedule/generate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'cultural' })
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Server error');
        expect(console.error).toHaveBeenCalledWith('Generate draft schedule error:', serviceError);
      });
    });
  });

  describe('POST /api/v1/trips/:id/optimize - Optimize Trip', () => {
    const tripId = '507f1f77bcf86cd799439012';

    describe('Successful Trip Optimization', () => {
      it('should successfully optimize trip with focus', async () => {
        const optimizationData = {
          focus: 'time'
        };

        const mockResult = {
          _id: tripId,
          name: 'Optimized Paris Trip',
          optimizationScore: 85
        };

        mockTripService.optimizeTrip.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/optimize`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(optimizationData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Trip optimized successfully');
        expect(response.body.data.trip).toEqual(mockResult);
        expect(mockTripService.optimizeTrip).toHaveBeenCalledWith(tripId, userId, { focus: 'time' });
      });

      it('should log successful trip optimization', async () => {
        const mockResult = {
          _id: tripId,
          name: 'Optimized Paris Trip'
        };

        mockTripService.optimizeTrip.mockResolvedValue(mockResult);

        await request(app)
          .post(`${API_BASE}/${tripId}/optimize`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'budget' })
          .expect(200);

        expect(console.log).toHaveBeenCalledWith(`Trip optimized successfully: Optimized Paris Trip for user ${userId}`);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when focus is invalid', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/optimize`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'invalid-focus' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Focus must be one of');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle service errors when optimizing trip', async () => {
        const serviceError = new Error('Trip optimization failed');
        mockTripService.optimizeTrip.mockRejectedValue(serviceError);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/optimize`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ focus: 'time' })
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Server error');
        expect(console.error).toHaveBeenCalledWith('Optimize trip error:', serviceError);
      });
    });
  });

  describe('POST /api/v1/trips/:id/export - Export Trip', () => {
    const tripId = '507f1f77bcf86cd799439012';

    describe('Successful Trip Export', () => {
      it('should successfully export trip in PDF format', async () => {
        const exportData = {
          format: 'pdf',
          options: {
            includeMap: true,
            includePhotos: false
          }
        };

        const mockResult = {
          format: 'pdf',
          downloadUrl: 'https://example.com/download/trip-123.pdf',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        mockTripService.exportTrip.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/export`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(exportData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Trip exported successfully in pdf format');
        expect(response.body.data).toEqual(mockResult);
        expect(mockTripService.exportTrip).toHaveBeenCalledWith(tripId, userId, {
          format: 'pdf',
          includeMap: true,
          includePhotos: false
        });
      });

      it('should successfully export trip in JSON format', async () => {
        const exportData = {
          format: 'json'
        };

        const mockResult = {
          format: 'json',
          data: { trip: 'data' }
        };

        mockTripService.exportTrip.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/export`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(exportData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Trip exported successfully in json format');
        expect(response.body.data).toEqual(mockResult);
      });

      it('should log successful trip export', async () => {
        const mockResult = {
          format: 'ical'
        };

        mockTripService.exportTrip.mockResolvedValue(mockResult);

        await request(app)
          .post(`${API_BASE}/${tripId}/export`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ format: 'ical' })
          .expect(200);

        expect(console.log).toHaveBeenCalledWith(`Trip exported successfully: ${tripId} in ical format for user ${userId}`);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when format is invalid', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/export`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ format: 'invalid-format' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Format must be one of');
      });

      it('should return 400 when format is missing', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/export`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Export format is required');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle service errors when exporting trip', async () => {
        const serviceError = new Error('Trip export failed');
        mockTripService.exportTrip.mockRejectedValue(serviceError);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/export`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ format: 'pdf' })
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Server error');
        expect(console.error).toHaveBeenCalledWith('Export trip error:', serviceError);
      });
    });
  });

  describe('POST /api/v1/trips/:id/days/:dayId/activities - Add Activity to Day', () => {
    const tripId = '507f1f77bcf86cd799439012';
    const dayId = 'day-1';

    describe('Successful Activity Addition', () => {
      it('should successfully add activity to day', async () => {
        const activityData = {
          title: 'Visit Eiffel Tower',
          type: 'attraction',
          startTime: '09:00',
          duration: 120,
          location: {
            name: 'Eiffel Tower',
            coordinates: {
              latitude: 48.8584,
              longitude: 2.2945
            }
          }
        };

        const mockResult = {
          _id: tripId,
          name: 'Paris Trip',
          itinerary: {
            days: [
              {
                dayId: 'day-1',
                activities: [activityData]
              }
            ]
          }
        };

        mockTripService.addActivityToDay.mockResolvedValue(mockResult);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/days/${dayId}/activities`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(activityData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Activity added successfully');
        expect(response.body.data.trip).toEqual(mockResult);
        expect(mockTripService.addActivityToDay).toHaveBeenCalledWith(tripId, userId, dayId, activityData);
      });

      it('should log successful activity addition', async () => {
        const mockResult = {
          _id: tripId,
          name: 'Paris Trip'
        };

        mockTripService.addActivityToDay.mockResolvedValue(mockResult);

        await request(app)
          .post(`${API_BASE}/${tripId}/days/${dayId}/activities`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Test Activity' })
          .expect(200);

        expect(console.log).toHaveBeenCalledWith(`Activity added to trip: ${tripId} for user ${userId}`);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when activity title is missing', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/days/${dayId}/activities`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ type: 'attraction' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Activity title is required');
      });

      it('should return 400 when activity type is invalid', async () => {
        const response = await request(app)
          .post(`${API_BASE}/${tripId}/days/${dayId}/activities`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Activity',
            type: 'invalid-type'
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Activity type must be one of');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle service errors when adding activity', async () => {
        const serviceError = new Error('Activity addition failed');
        mockTripService.addActivityToDay.mockRejectedValue(serviceError);

        const response = await request(app)
          .post(`${API_BASE}/${tripId}/days/${dayId}/activities`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Test Activity', type: 'attraction' })
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Server error');
        expect(console.error).toHaveBeenCalledWith('Add activity error:', serviceError);
      });
    });
  });

  describe('PUT /api/v1/trips/:id/days/:dayId/activities/:activityId - Update Activity', () => {
    const tripId = '507f1f77bcf86cd799439012';
    const dayId = 'day-1';
    const activityId = 'activity-1';

    describe('Successful Activity Update', () => {
      it('should successfully update activity', async () => {
        const updateData = {
          title: 'Updated Activity Title',
          startTime: '10:00',
          duration: 180
        };

        const mockResult = {
          _id: tripId,
          name: 'Paris Trip',
          itinerary: {
            days: [
              {
                dayId: 'day-1',
                activities: [
                  {
                    _id: activityId,
                    ...updateData
                  }
                ]
              }
            ]
          }
        };

        mockTripService.updateActivity.mockResolvedValue(mockResult);

        const response = await request(app)
          .put(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Activity updated successfully');
        expect(response.body.data.trip).toEqual(mockResult);
        expect(mockTripService.updateActivity).toHaveBeenCalledWith(tripId, userId, dayId, activityId, updateData);
      });

      it('should log successful activity update', async () => {
        const mockResult = {
          _id: tripId,
          name: 'Paris Trip'
        };

        mockTripService.updateActivity.mockResolvedValue(mockResult);

        await request(app)
          .put(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Updated Activity' })
          .expect(200);

        expect(console.log).toHaveBeenCalledWith(`Activity updated in trip: ${tripId} for user ${userId}`);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when update data is empty', async () => {
        const response = await request(app)
          .put(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('At least one field must be provided for update');
      });

      it('should return 400 when activityId is invalid', async () => {
        const response = await request(app)
          .put(`${API_BASE}/${tripId}/days/${dayId}/activities/invalid-id`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Updated Activity' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toContain('Activity ID must be a valid ObjectId');
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle service errors when updating activity', async () => {
        const serviceError = new Error('Activity update failed');
        mockTripService.updateActivity.mockRejectedValue(serviceError);

        const response = await request(app)
          .put(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Updated Activity' })
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Server error');
        expect(console.error).toHaveBeenCalledWith('Update activity error:', serviceError);
      });
    });
  });

  describe('DELETE /api/v1/trips/:id/days/:dayId/activities/:activityId - Delete Activity', () => {
    const tripId = '507f1f77bcf86cd799439012';
    const dayId = 'day-1';
    const activityId = 'activity-1';

    describe('Successful Activity Deletion', () => {
      it('should successfully delete activity', async () => {
        const mockResult = {
          _id: tripId,
          name: 'Paris Trip',
          itinerary: {
            days: [
              {
                dayId: 'day-1',
                activities: []
              }
            ]
          }
        };

        mockTripService.deleteActivity.mockResolvedValue(mockResult);

        const response = await request(app)
          .delete(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Activity deleted successfully');
        expect(response.body.data.trip).toEqual(mockResult);
        expect(mockTripService.deleteActivity).toHaveBeenCalledWith(tripId, userId, dayId, activityId);
      });

      it('should log successful activity deletion', async () => {
        const mockResult = {
          _id: tripId,
          name: 'Paris Trip'
        };

        mockTripService.deleteActivity.mockResolvedValue(mockResult);

        await request(app)
          .delete(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(console.log).toHaveBeenCalledWith(`Activity deleted from trip: ${tripId} for user ${userId}`);
      });
    });

    describe('Service Errors (500)', () => {
      it('should handle service errors when deleting activity', async () => {
        const serviceError = new Error('Activity deletion failed');
        mockTripService.deleteActivity.mockRejectedValue(serviceError);

        const response = await request(app)
          .delete(`${API_BASE}/${tripId}/days/${dayId}/activities/${activityId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(500);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Server error');
        expect(console.error).toHaveBeenCalledWith('Delete activity error:', serviceError);
      });
    });
  });
});