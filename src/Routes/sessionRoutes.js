const {
    createSession,
    sendMessage,
    getSessions,
    sendMediaUrl,
    logoutSession,
    getMessageById,
    getAllMessages,
    sendToMultiple,    
    scheduleMessage,
    getScheduleMessage,
    getDashboardStats,
    getSentMessage,
    getUserData,    
} = require('../Controllers/sessionControllers');

const express = require('express');
const router = express.Router();
const auth = require('../Middlewares/authMiddleware');

// Create a new session
router.get('/create-session', auth, createSession);

// Send a text message
router.post('/send-message', auth, sendMessage);

// List active sessions (admin only)
router.get('/', auth, getSessions);

// Send media by URL
router.post('/send-media', auth, sendMediaUrl);

router.get('/logout', auth, logoutSession);

router.get('/message', auth, getMessageById);

router.get('/all-messages', auth, getAllMessages);

router.post('/send-multiple', auth, sendToMultiple);

router.post('/schedule-message', auth, scheduleMessage);

router.get('/schedule-message', auth, getScheduleMessage);

router.get('/dashboard-stats', auth, getDashboardStats);

router.get('/get-sent-message', auth, getSentMessage);

router.get('/user-data', auth, getUserData);


module.exports = router;
