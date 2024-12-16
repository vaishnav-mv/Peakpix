const express = require("express");
const adminRouter = express.Router();
const adminAuth = require("../middleware/adminAuth");

const {getAdminHome,getAdminLogin,loginAdmin,logoutAdmin,getUsers,toggleUserStatus,
    getOrders,updateOrderStatus,viewOrder,getCoupons,getOffers
} = require("../controllers/adminController");
const categoryRouter = require("./category");
const productRouter = require("./product");

adminRouter.get('/',adminAuth,getAdminHome)

adminRouter.route("/login").get(getAdminLogin).post(loginAdmin)

adminRouter.post("/logout", adminAuth, logoutAdmin)

// User Management Routes
adminRouter.get("/users", adminAuth, getUsers)

// User status toggle
adminRouter.post("/users/toggle-status/:id", adminAuth, toggleUserStatus)

// Product Management Route
adminRouter.use("/products", productRouter);

// Order Management Route
adminRouter.get("/orders", adminAuth, getOrders);

adminRouter.post("/orders/update-status/:id", adminAuth, updateOrderStatus);

adminRouter.get("/orders/view/:id", adminAuth, viewOrder);

// Category Management Route
adminRouter.use("/category", categoryRouter);

// Coupon Management Route
adminRouter.get("/coupon", adminAuth, getCoupons);

// Offer Management Route
adminRouter.get("/offer", adminAuth, getOffers);



module.exports = adminRouter
  