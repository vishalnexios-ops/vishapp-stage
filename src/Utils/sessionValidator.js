const { sendError } = require('./responseUtils');

/**
 * Validates if the sessionId belongs to the user.
 * @param {Object} res - Express response object
 * @param {string} sessionId - The session ID to validate
 * @param {string} userId - The user ID to check against
 * @returns {boolean} - Returns true if valid, false if invalid (response sent)
 */
const validateSession = (res, sessionId, userId) => {
      if (!sessionId || !sessionId.startsWith(`session_`) || !sessionId.includes(`_${userId}`)) {
            sendError(res, 403, "Unauthorized session access.");
            return false;
      }
      return true;
};

module.exports = { validateSession };
