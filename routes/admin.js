const express = require("express");
const adminRouter = express.Router();
const adminAuth = require("../middleware/adminAuth");
const Category = require("../models/categories");
const Product = require("../models/products");
const {
  loginAdmin,
  logoutAdmin,
  getUsers,
  getOrders,
  getCoupons,
  getOffers,
  getAdminHome,
  getAdminLogin,
  toggleUserStatus,
  updateOrderStatus,
  approveReturn,
  viewOrder,
  addOffer,
  updateOffer,
  deleteOffer,
  addCoupon,
  updateCoupon,
  deleteCoupon,
  getSalesReport,
  getSalesData,
  getBestSellers,
  toggleCouponStatus,
  toggleOfferStatus,
} = require("../controllers/adminController");
const categoryRouter = require("./category");
const productRouter = require("./product");

// Admin Home Route
adminRouter.get("/", adminAuth, getAdminHome);

adminRouter.post("/sales-report", adminAuth, getSalesReport);

adminRouter.get("/sales-data", adminAuth, getSalesData);

adminRouter.get("/best-sellers", getBestSellers);

// Admin Authentication Routes
// Admin Login Route
adminRouter.route("/login").get(getAdminLogin).post(loginAdmin);
// Admin Logout Route
adminRouter.post("/logout", adminAuth, logoutAdmin);

// User Management Routes
adminRouter.get("/users", adminAuth, getUsers);

// User status toggle
adminRouter.post("/users/toggle-status/:id", adminAuth, toggleUserStatus);

// Product Management Route
adminRouter.use("/products", productRouter);

// Order Management Route
adminRouter.get("/orders", adminAuth, getOrders);

adminRouter.post("/orders/update-status/:id", adminAuth, updateOrderStatus);

adminRouter.post('/orders/approve-return/:id', adminAuth, approveReturn);

adminRouter.get("/orders/view/:id", adminAuth, viewOrder);

// Category Management Route
adminRouter.use("/category", categoryRouter);

// Coupon Management Route
adminRouter.get("/coupon", adminAuth, getCoupons);

adminRouter.post("/coupon/add", adminAuth, addCoupon);

adminRouter.post("/coupon/update/:id", adminAuth, updateCoupon);

adminRouter.delete("/coupon/delete/:id", adminAuth, deleteCoupon);

adminRouter.put("/coupon/toggle-status/:id", adminAuth, toggleCouponStatus);

// Offer Management Route
adminRouter.get("/offer", adminAuth, getOffers);
adminRouter.post("/offer", adminAuth, addOffer);
adminRouter.get("/offer/categories", async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching categories" });
  }
});
adminRouter.get("/offer/products", async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching products" });
  }
});

adminRouter.post("/offer/update/:id", adminAuth, updateOffer);

adminRouter.delete("/offer/delete/:id", adminAuth, deleteOffer);

adminRouter.put("/offer/toggle/:id", adminAuth, toggleOfferStatus);


module.exports = adminRouter;
