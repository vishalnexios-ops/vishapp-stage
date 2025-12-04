const userModel = require('../Models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sendResponse, sendError } = require('../Utils/responseUtils');

// User registration
const register = async (req, res) => {
    try {
        const { username, email, password, mobile } = req.body;
        // Check if user already exists
        const existingUser = await userModel.findOne({ $or: [{ email }, { username }, { mobile }] });
        if (existingUser) {
            return sendError(res, 400, 'User already exists with this email, username or mobile');
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create new user
        const newUser = new userModel({ username, email, password: hashedPassword, mobile });
        await newUser.save();
        await newUser.save();
        sendResponse(res, 201, 'User registered successfully');
    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// User login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await userModel.findOne({ email });
        if (!user) {
            return sendError(res, 400, 'Invalid email or password');
        }
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return sendError(res, 400, 'Invalid email or password');
        }
        // Create JWT token
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || "Test", { expiresIn: '1h' });

        res.clearCookie('token');

        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        return sendResponse(res, 200, 'Login successful', { token });
    }
    catch (error) {
        return sendError(res, 500, 'Server error', error.message);
    }
};

// Get user profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await userModel.findById(userId).select('-password');
        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        sendResponse(res, 200, 'User profile fetched successfully', user);

    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { username, email, mobile } = req.body;
        const updatedData = { username, email, mobile };

        const user = await userModel.findByIdAndUpdate(userId, updatedData, { new: true }).select('-password');
        if (!user) {
            return sendError(res, 404, 'User not found');
        }
        sendResponse(res, 200, 'Profile updated successfully', user);

    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// Delete user account
const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await userModel.findByIdAndDelete(userId);
        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        sendResponse(res, 200, 'Account deleted successfully');

    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return sendError(res, 403, 'Access denied');
        }
        const userId = req.params.id;
        const user = await userModel.findById(userId).select('-password');
        if (!user) {
            return sendError(res, 404, 'User not found');
        }
        sendResponse(res, 200, 'User fetched successfully', user);
    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// Change password
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { oldPassword, newPassword } = req.body;

        const user = await userModel.findById(userId);
        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return sendError(res, 400, 'Old password is incorrect');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        sendResponse(res, 200, 'Password changed successfully');
    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// Get users with pagination with search,sortby, sortorder (admin only)
const getUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return sendError(res, 403, 'Access denied');
        }
        let { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        const skip = (page - 1) * limit;
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        const query = {
            $or: [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ]
        };
        const users = await userModel.find(query).sort(sortOptions).skip(skip).limit(limit).select('-password');
        const total = await userModel.countDocuments(query);
        sendResponse(res, 200, 'Users fetched successfully', {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    }
    catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};

// Get recently registered users (admin only)
const getRecentUsers = async (req, res) => {
    try {

        if (req.user.role !== 'admin') {
            return sendError(res, 403, 'Access denied');
        }

        const users = await userModel.find().sort({ createdAt: -1 }).limit(10).select('-password');

        sendResponse(res, 200, 'Recent users fetched successfully', users);
    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
}

// Get user by mobile number
const getUserByMobile = async (req, res) => {
    try {
        const { mobile } = req.params;

        const user = await userModel.findOne({
            mobile
        }).select('-password');

        if (!user) {
            return sendError(res, 404, 'User not found');
        }
        sendResponse(res, 200, 'User fetched successfully', user);
    } catch (error) {
        sendError(res, 500, 'Server error', error.message);
    }
};


const logOut = async (req, res) => {
    try {
        res.cookie('token', "");
        return sendResponse(res, 200, 'Logout successful');

    } catch (error) {
        return sendError(res, 500, 'Server error', error.message);
    }
}

module.exports = {
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
};


