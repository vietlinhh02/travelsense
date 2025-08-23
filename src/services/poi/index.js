const POIExtractor = require('./poiExtractor.service');
const FoursquareClient = require('./foursquareClient.service');
const TripAdvisorClient = require('./tripadvisorClient.service');
const POICacheService = require('./poiCacheService');

module.exports = {
  POIExtractor,
  FoursquareClient,
  TripAdvisorClient,
  POICacheService
};