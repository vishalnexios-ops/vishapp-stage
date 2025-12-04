const template = require('../Models/templateModel');
require('dotenv').config();
const { sendResponse, sendError } = require('../Utils/responseUtils');

// GET /api/templates?page=1&limit=10&search=birthday
const getTemplates = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Search filter (by title or description)
    const search = req.query.search || "";
    const searchFilter = search
      ? {
        $or: [
          { title: { $regex: search, $options: "i" } },       // case-insensitive
          { description: { $regex: search, $options: "i" } }
        ]
      }
      : {};

    //  Count total templates
    const totalTemplates = await template.countDocuments({
      userId,
      ...searchFilter,
    });

    //  Fetch filtered templates
    const templates = await template
      .find({ userId, ...searchFilter })
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);

    //  Response
    sendResponse(res, 200, "Templates fetched successfully", {
      page,
      limit,
      totalTemplates,
      totalPages: Math.ceil(totalTemplates / limit),
      templates,
    });
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

// get a template by ID
const getTemplateById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const templateId = req.query.templateId;
    const template = await template.findOne({ _id: templateId, userId });
    if (!template) {
      return sendError(res, 404, 'Template not found');
    }
    sendResponse(res, 200, 'Template fetched successfully', { template });
  } catch (error) {
    sendError(res, 500, 'Server error', error.message);
  }
};

// Add a new template
const addTemplate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description } = req.body;
    const newTemplate = new template({ userId, title, description });
    await newTemplate.save();
    await newTemplate.save();
    sendResponse(res, 201, 'Template added successfully', { template: newTemplate });
  } catch (error) {
    sendError(res, 500, 'Server error', error.message);
  }
};

// Edit a template by ID
const editTemplate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const templateId = req.query.templateId;
    const { title, description } = req.body;

    const updatedTemplate = await template.findOneAndUpdate(
      { _id: templateId, userId },
      { title, description },
      { new: true }
    );
    if (!updatedTemplate) {
      return sendError(res, 404, 'Template not found');
    }
    sendResponse(res, 200, 'Template updated successfully', { template: updatedTemplate });
  } catch (error) {
    sendError(res, 500, 'Server error', error.message);
  }
};

// Delete a template by ID
const deleteTemplate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const templateId = req.query.templateId;

    const deletedTemplate = await template.findOneAndDelete({ _id: templateId, userId });

    if (!deletedTemplate) {
      return sendError(res, 404, 'Template not found');
    }

    sendResponse(res, 200, 'Template deleted successfully');
  } catch (error) {
    sendError(res, 500, 'Server error', error.message);
  }
};


module.exports = {
  getTemplates,
  deleteTemplate,
  addTemplate,
  editTemplate,
  getTemplateById,
};