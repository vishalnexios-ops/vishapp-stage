const mongoose = require('mongoose');

// Login session schema with userId, sessionId, loginTime, logoutTime
const loginSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    isLoggedIn: { type: Boolean, default: true },
    loginTime: { type: Date, default: Date.now },
    logoutTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Login', loginSchema);