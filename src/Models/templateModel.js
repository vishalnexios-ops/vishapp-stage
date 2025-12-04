const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', allowNull: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
});

module.exports = mongoose.model('Template', templateSchema);