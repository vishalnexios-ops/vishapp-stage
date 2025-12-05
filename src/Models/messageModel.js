const mongoose = require('mongoose');
// Whatsapp message schema with sender, receiver,sessionId,senderMobile,receiverMobile content(audio,video,text,image,document), timestamp
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', allowNull: true },
    content: {
        type: String,
        // required: true
    },
    contentType: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document'],
        // required: true
    },
    sessionId: { type: String, required: true },
    senderMobile: { type: String, required: true },
    receiverMobile: { type: String, required: true },
    mediaUrl: { type: String },
    direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
    schedulled: { type: Boolean, default: false },
    scheduledTime: { type: Date },
    scheduledStatus: { type: String, enum: ['pending','sent','scheduledSent'], default: 'sent' },
    sentAt:{ type: Date}
}, { timestamps: true });


module.exports = mongoose.model('Message', messageSchema);

