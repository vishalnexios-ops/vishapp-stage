const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sendError } = require('../Utils/responseUtils');

const auth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return sendError(res, 401, 'No token, authorization denied');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "Test");
        req.user = decoded;
        next();
    } catch (error) {
        sendError(res, 401, 'Token is not valid');
    }
};
module.exports = auth;