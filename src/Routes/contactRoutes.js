const { addContact, getContacts, deleteContact, editContact } = require('../Controllers/contactController');

const express = require('express');
const router = express.Router();
const auth = require('../Middlewares/authMiddleware');

// Add a new contact
router.post('/', auth, addContact);
// Get all contacts for the logged-in user
router.get('/', auth, getContacts);
// Delete a contact by ID
router.delete('/', auth, deleteContact);
// Edit a contact by ID
router.put('/', auth, editContact);
module.exports = router;
