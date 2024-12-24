const express = require("express");
const categoryRouter = express.Router();
const adminAuth = require("../middleware/adminAuth");
const {
  getCategory,
  toggleCategoryStatus,
  deleteCategory,
  addCategory,
  updateCategory
} = require("../controllers/categoryController");

// Get all categories
categoryRouter.get("/", adminAuth, getCategory);

// Add a new category
categoryRouter.post("/", adminAuth, addCategory);

// Toggle category status
categoryRouter.post("/toggle-status/:id", adminAuth, toggleCategoryStatus);

// Delete a category
categoryRouter.post("/delete/:id", adminAuth, deleteCategory);

// Update a category
categoryRouter.post('/edit/:id', adminAuth, updateCategory);

module.exports = categoryRouter;
