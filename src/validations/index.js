const authValidation = require('./auth.validation');
const userValidation = require('./user.validation');
const tripValidation = require('./trip.validation');
const aiValidation = require('./ai.validation');
const searchValidation = require('./search.validation');
const aiProviderValidation = require('./aiProvider.validation');

module.exports = {
  authValidation,
  userValidation,
  tripValidation,
  aiValidation,
  searchValidation,
  aiProviderValidation
};
