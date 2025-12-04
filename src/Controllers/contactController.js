const Contact = require("../Models/contactModel");
require("dotenv").config();
const { sendResponse, sendError } = require('../Utils/responseUtils');

// GET /api/contacts?page=1&limit=10&search=John
const getContacts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    //  Search filter
    const search = req.query.search || "";
    const searchFilter = search
      ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { contact: { $regex: search, $options: "i" } },
        ],
      }
      : {};

    const totalContacts = await Contact.countDocuments({
      userId,
      ...searchFilter,
    });

    const contacts = await Contact.find({
      userId,
      ...searchFilter,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    sendResponse(res, 200, "Contacts fetched successfully", {
      page,
      limit,
      totalContacts,
      totalPages: Math.ceil(totalContacts / limit),
      contacts,
    });
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

// get a contact by ID
const getContactById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactId = req.query.contactId;
    const contact = await Contact.findOne({ _id: contactId, userId });
    if (!contact) {
      return sendError(res, 404, "Contact not found");
    }
    sendResponse(res, 200, "Contact fetched successfully", { contact });
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

// Add a new contact
const addContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contact, name } = req.body;

    const existingContact = await Contact.findOne({ userId, contact });

    if (existingContact) {
      existingContact.name = name;
      await existingContact.save();
      return sendResponse(res, 200, "Contact updated successfully", { contact: existingContact });
    }

    const newContact = new Contact({ userId, contact, name });
    await newContact.save();

    sendResponse(res, 201, "Contact added successfully", { contact: newContact });
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

// edit a contact by ID
const editContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactId = req.query.contactId;
    const { contact, name } = req.body;
    const updatedContact = await Contact.findOneAndUpdate(
      { _id: contactId, userId },
      { contact, name },
      { new: true }
    );
    if (!updatedContact) {
      return sendError(res, 404, "Contact not found");
    }
    sendResponse(res, 200, "Contact updated successfully", { contact: updatedContact });
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

// Delete a contact by ID
const deleteContact = async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactId = req.query.contactId;
    const deletedContact = await Contact.findOneAndDelete({
      _id: contactId,
      userId,
    });
    if (!deletedContact) {
      return sendError(res, 404, "Contact not found");
    }
    sendResponse(res, 200, "Contact deleted successfully");
  } catch (error) {
    sendError(res, 500, "Server error", error.message);
  }
};

module.exports = {
  getContacts,
  getContactById,
  addContact,
  editContact,
  deleteContact,
};
