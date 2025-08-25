const { validationResult } = require('express-validator');
const { responseService } = require('../../services/common');
const tripDraftService = require('../../services/trips/tripDraft.service');

/**
 * TripDraft Controller - Manages temporary trip planning conversations
 */

// Get user's active drafts
const getUserActiveDrafts = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Get active drafts for user
    const drafts = await tripDraftService.getUserActiveDrafts(userId);

    console.log(`Retrieved ${drafts.length} active drafts for user ${userId}`);

    responseService.sendSuccess(res, { drafts }, 'Active drafts retrieved successfully');
  } catch (error) {
    console.error('Get user active drafts error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get specific draft by ID
const getDraftById = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token
    const userId = req.user.userId;

    // Extract draft ID from URL parameters
    const { draftId } = req.params;

    // Get draft by ID
    const draft = await tripDraftService.getOrCreateActiveDraft(userId, draftId);

    console.log(`Retrieved draft ${draftId} for user ${userId}`);

    responseService.sendSuccess(res, {
      draft: tripDraftService.getDraftSummary(draft)
    }, 'Draft retrieved successfully');
  } catch (error) {
    console.error('Get draft by ID error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Update draft with new information
const updateDraft = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token
    const userId = req.user.userId;

    // Extract draft ID from URL parameters
    const { draftId } = req.params;

    // Extract update data from request body
    const { extracted, missing, ambiguities } = req.body;

    // Update draft
    const updatedDraft = await tripDraftService.updateDraft(
      draftId,
      extracted || {},
      missing || [],
      ambiguities || []
    );

    console.log(`Updated draft ${draftId} for user ${userId}, readiness: ${updatedDraft.readinessScore}%`);

    responseService.sendSuccess(res, {
      draft: tripDraftService.getDraftSummary(updatedDraft)
    }, 'Draft updated successfully');
  } catch (error) {
    console.error('Update draft error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Materialize draft into actual trip
const materializeDraft = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token
    const userId = req.user.userId;

    // Extract draft ID from URL parameters
    const { draftId } = req.params;

    // Extract trip data from request body
    const { tripData, force } = req.body;

    // Materialize draft
    const createdTrip = await tripDraftService.materializeDraft(draftId, tripData, force);

    console.log(`Materialized draft ${draftId} into trip ${createdTrip._id} for user ${userId}`);

    responseService.sendSuccess(res, {
      trip: createdTrip,
      message: `Trip "${createdTrip.name}" created successfully from draft`
    }, 'Trip created successfully');
  } catch (error) {
    console.error('Materialize draft error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Delete draft
const deleteDraft = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token
    const userId = req.user.userId;

    // Extract draft ID from URL parameters
    const { draftId } = req.params;

    // Delete draft
    const success = await tripDraftService.deleteDraft(draftId);

    if (success) {
      console.log(`Deleted draft ${draftId} for user ${userId}`);
      responseService.sendSuccess(res, null, 'Draft deleted successfully');
    } else {
      responseService.sendError(res, 'Draft not found', 404);
    }
  } catch (error) {
    console.error('Delete draft error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Clean up expired drafts (admin only)
const cleanupExpiredDrafts = async (req, res) => {
  try {
    // Clean up expired drafts
    const deletedCount = await tripDraftService.cleanupExpiredDrafts();

    console.log(`Cleaned up ${deletedCount} expired drafts`);

    responseService.sendSuccess(res, {
      deletedCount,
      message: `Successfully cleaned up ${deletedCount} expired drafts`
    }, 'Cleanup completed successfully');
  } catch (error) {
    console.error('Cleanup expired drafts error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

module.exports = {
  getUserActiveDrafts,
  getDraftById,
  updateDraft,
  materializeDraft,
  deleteDraft,
  cleanupExpiredDrafts
};
