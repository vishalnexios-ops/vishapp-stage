const {
        addTemplate,
    getTemplates,
    deleteTemplate,
    editTemplate
} = require('../Controllers/templateController');

const express = require('express');
const router = express.Router();
const auth = require('../Middlewares/authMiddleware');
// Add a new template
router.post('/', auth, addTemplate);
// Get all templates for the logged-in user
router.get('/', auth, getTemplates);
// Delete a template by ID
router.delete('/', auth, deleteTemplate);
// Edit a template by ID
router.put('/', auth, editTemplate);
module.exports = router;