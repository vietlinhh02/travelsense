const { TripDraft } = require('../../models/trips');
const crypto = require('crypto');

/**
 * TripDraftService - Manages temporary trip planning conversations
 * Responsible for: Draft state management, conversation tracking, readiness assessment
 */
class TripDraftService {
  constructor() {
    this.defaultExpirationHours = 24;
  }

  /**
   * Create new trip draft for user
   * @param {string} userId - User ID
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<Object>} Created trip draft
   */
  async createDraft(userId, sessionId = null) {
    try {
      const newDraft = new TripDraft({
        userId,
        sessionId: sessionId || this.generateSessionId(),
        extracted: {
          travelers: { adults: 2, children: 0, infants: 0 }
        },
        missing: ['destinations', 'dates'],
        ambiguities: [],
        conversationHistory: []
      });

      const savedDraft = await newDraft.save();
      console.log(`Created new trip draft for user ${userId}: ${savedDraft._id}`);

      return savedDraft;
    } catch (error) {
      console.error('Error creating trip draft:', error);
      throw new Error('Failed to create trip draft');
    }
  }

  /**
   * Get or create active draft for user
   * @param {string} userId - User ID
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<Object>} Active trip draft
   */
  async getOrCreateActiveDraft(userId, sessionId = null) {
    try {
      // Try to find existing active draft
      let draft;
      if (sessionId) {
        draft = await TripDraft.findBySessionId(sessionId);
      } else {
        const activeDrafts = await TripDraft.findActiveByUserId(userId);
        draft = activeDrafts[0]; // Get most recent
      }

      // If no active draft, create new one
      if (!draft) {
        draft = await this.createDraft(userId, sessionId);
      }

      return draft;
    } catch (error) {
      console.error('Error getting active draft:', error);
      throw new Error('Failed to get or create trip draft');
    }
  }

  /**
   * Update draft with extracted information
   * @param {string} draftId - Draft ID
   * @param {Object} extractedData - Extracted information
   * @param {Array} missing - Missing fields
   * @param {Array} ambiguities - Ambiguities
   * @returns {Promise<Object>} Updated draft
   */
  async updateDraft(draftId, extractedData, missing = [], ambiguities = []) {
    try {
      const draft = await TripDraft.findById(draftId);
      if (!draft) {
        throw new Error('Trip draft not found');
      }

      // Update extracted information
      draft.updateExtracted(extractedData, missing, ambiguities);

      // Save changes
      const updatedDraft = await draft.save();

      console.log(`Updated trip draft ${draftId}, readiness: ${updatedDraft.readinessScore}%`);

      return updatedDraft;
    } catch (error) {
      console.error('Error updating draft:', error);
      throw new Error('Failed to update trip draft');
    }
  }

  /**
   * Add message to draft conversation
   * @param {string} draftId - Draft ID
   * @param {string} role - Message role (user/assistant)
   * @param {string} content - Message content
   * @param {Object} extractedData - Optional extracted data from message
   * @returns {Promise<Object>} Updated draft
   */
  async addMessage(draftId, role, content, extractedData = null) {
    try {
      const draft = await TripDraft.findById(draftId);
      if (!draft) {
        throw new Error('Trip draft not found');
      }

      draft.addMessage(role, content, extractedData);

      // If user message with extracted data, update draft
      if (role === 'user' && extractedData) {
        draft.updateExtracted(
          extractedData.extracted || {},
          extractedData.missing || [],
          extractedData.ambiguities || []
        );
      }

      const updatedDraft = await draft.save();
      return updatedDraft;
    } catch (error) {
      console.error('Error adding message to draft:', error);
      throw new Error('Failed to add message to trip draft');
    }
  }

  /**
   * Check if draft is ready for trip creation
   * @param {string} draftId - Draft ID
   * @returns {Promise<boolean>} Ready status
   */
  async isReadyForTripCreation(draftId) {
    try {
      const draft = await TripDraft.findById(draftId);
      if (!draft) {
        return false;
      }

      return draft.isReadyForTripCreation();
    } catch (error) {
      console.error('Error checking draft readiness:', error);
      return false;
    }
  }

  /**
   * Get next question to ask user
   * @param {string} draftId - Draft ID
   * @returns {Promise<string|null>} Next question or null
   */
  async getNextQuestion(draftId) {
    try {
      const draft = await TripDraft.findById(draftId);
      if (!draft) {
        return null;
      }

      return draft.getNextQuestion();
    } catch (error) {
      console.error('Error getting next question:', error);
      return null;
    }
  }

  /**
   * Materialize draft into actual trip
   * @param {string} draftId - Draft ID
   * @param {Object} tripData - Additional trip data from AI generation
   * @param {boolean} force - Force creation even if not ready
   * @returns {Promise<Object>} Created trip
   */
  async materializeDraft(draftId, tripData = {}, force = false) {
    try {
      const draft = await TripDraft.findById(draftId);
      if (!draft) {
        throw new Error('Trip draft not found');
      }

      if (!force && !draft.isReadyForTripCreation()) {
        throw new Error('Draft is not ready for trip creation');
      }

      const { Trip } = require('../../models/trips');

      // Create trip from draft data
      const trip = new Trip({
        name: tripData.name || draft.extracted.destinations?.[0] ?
              `Trip to ${draft.extracted.destinations[0]}` : 'New Trip',
        userId: draft.userId,
        destination: {
          origin: draft.extracted.origin || 'Current Location',
          destination: draft.extracted.destinations?.[0] || 'Unknown',
          startDate: draft.extracted.dates?.start || new Date(),
          endDate: draft.extracted.dates?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        duration: draft.extracted.duration ||
                 Math.ceil((draft.extracted.dates?.end - draft.extracted.dates?.start) / (1000 * 60 * 60 * 24)) ||
                 7,
        travelers: draft.extracted.travelers || { adults: 2, children: 0, infants: 0 },
        budget: draft.extracted.budget,
        preferences: {
          interests: draft.extracted.interests || [],
          constraints: draft.extracted.avoid || [],
          pace: draft.extracted.pace,
          nightlife: draft.extracted.nightlife,
          dayStart: draft.extracted.dayStart,
          dayEnd: draft.extracted.dayEnd,
          quietMorningAfterLateNight: draft.extracted.quietMorningAfterLateNight,
          transportPrefs: draft.extracted.transportPrefs,
          walkingLimitKm: draft.extracted.walkingLimitKm,
          dietary: draft.extracted.dietary,
          mobility: draft.extracted.mobility,
          mustSee: draft.extracted.mustSee,
          avoid: draft.extracted.avoid
        },
        itinerary: tripData.itinerary || { days: [] },
        metadata: {
          createdFromDraft: draftId,
          readinessScore: draft.readinessScore,
          conversationTurns: draft.conversationHistory.length
        }
      });

      const savedTrip = await trip.save();

      // Mark draft as materialized
      draft.status = 'materialized';
      await draft.save();

      console.log(`Materialized draft ${draftId} into trip ${savedTrip._id}`);

      return savedTrip;
    } catch (error) {
      console.error('Error materializing draft:', error);
      throw new Error('Failed to create trip from draft');
    }
  }

  /**
   * Delete draft
   * @param {string} draftId - Draft ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteDraft(draftId) {
    try {
      const result = await TripDraft.findByIdAndDelete(draftId);
      return !!result;
    } catch (error) {
      console.error('Error deleting draft:', error);
      return false;
    }
  }

  /**
   * Clean up expired drafts
   * @returns {Promise<number>} Number of deleted drafts
   */
  async cleanupExpiredDrafts() {
    try {
      const result = await TripDraft.cleanupExpired();
      console.log(`Cleaned up ${result.deletedCount} expired trip drafts`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired drafts:', error);
      return 0;
    }
  }

  /**
   * Get draft summary for API response
   * @param {Object} draft - Draft object
   * @returns {Object} Summary object
   */
  getDraftSummary(draft) {
    return {
      id: draft._id,
      sessionId: draft.sessionId,
      status: draft.status,
      readinessScore: draft.readinessScore,
      extracted: draft.extracted,
      missing: draft.missing,
      ambiguities: draft.ambiguities,
      messageCount: draft.conversationHistory.length,
      nextQuestion: draft.getNextQuestion(),
      isReady: draft.isReadyForTripCreation(),
      expiresAt: draft.expiresAt
    };
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `draft_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get all active drafts for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of draft summaries
   */
  async getUserActiveDrafts(userId) {
    try {
      const drafts = await TripDraft.findActiveByUserId(userId);
      return drafts.map(draft => this.getDraftSummary(draft));
    } catch (error) {
      console.error('Error getting user drafts:', error);
      return [];
    }
  }
}

module.exports = new TripDraftService();
