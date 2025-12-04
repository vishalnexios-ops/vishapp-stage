const { 
  register,
    login,
    getProfile,
    updateProfile,
    deleteAccount,
    getUserById,
    changePassword,
    getUsers,
    getRecentUsers,
    getUserByMobile,
    logOut
 } = require('../Controllers/userControllers');


const express = require('express');
const router = express.Router();

const auth = require('../Middlewares/authMiddleware');
// User registration
router.post('/register', register);
// User login
router.post('/login', login);
// Get user profile
router.get('/profile', auth, getProfile);
// Update user profile
router.put('/profile', auth, updateProfile);
// Delete user account
router.delete('/profile', auth, deleteAccount);
// Get user by ID (admin only)
router.get('/user/:id', auth, getUserById);
// Change password
router.post('/change-password', auth, changePassword);
// Get all users (admin only)
router.get('/users', auth, getUsers);
// Get recent users (admin only)
router.get('/users/recent', auth, getRecentUsers);
// Get user by mobile number
router.get('/user/mobile/:mobile', auth, getUserByMobile);

router.get('/logout', logOut);

module.exports = router;
