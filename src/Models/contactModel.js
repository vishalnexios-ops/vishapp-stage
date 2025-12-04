const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', allowNull: true },
    contact: { type: String, required: true },
    name: { type: String, required: false }
});

module.exports = mongoose.model('Contact', contactSchema);