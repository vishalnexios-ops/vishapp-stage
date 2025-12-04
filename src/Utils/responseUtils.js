const sendResponse = (res, statusCode, message, data = null) => {
      const response = {
            success: statusCode >= 200 && statusCode < 300,
            message,
      };
      if (data !== null && data !== undefined) {
            response.data = data;
      }
      return res.status(statusCode).json(response);
};

const sendError = (res, statusCode, message, error = null) => {
      const response = {
            success: false,
            message,
      };
      if (error) {
            response.error = error;
      }
      return res.status(statusCode).json(response);
};

module.exports = {
      sendResponse,
      sendError
};
