const asyncHandler = require("express-async-handler")
const Admin = require('../models/admin')
const User = require('../models/user')
const Order = require('../models/order')


const getAdminLogin = asyncHandler(async (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin");
    }
    res.render("admin/adminLogin", { title: "Admin Login" });
});

// Handle Admin Login
const loginAdmin = asyncHandler(async (req, res) => {
    const { user, password } = req.body;
    const findAdmin = await Admin.findOne({ user });

    if (findAdmin && (await findAdmin.isPasswordMatched(password))) {
        req.session.admin = findAdmin._id;

        res.redirect("/admin");
    } else {
        throw new Error("Invalid Credentials");
    }
});


const getAdminHome = asyncHandler(async (req, res) => {
    res.render("layout", {
        title: "Peakpix",
        viewName: "admin/adminHome",
        activePage: "dashboard",
        isAdmin: true,
    });
});

const logoutAdmin = asyncHandler(async (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Failed to log out" });
        }
        res.redirect("/admin/login");
    });
});

// ============================
//  User Management Controllers
// ============================

// Render User Management Page
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find();

    if (!users) {
        throw new Error("Failed to fetch users");
    }

    res.render("layout", {
        title: "User Management",
        viewName: "admin/userManagement",
        activePage: "users",
        isAdmin: true,
        users: users,
    });
});

// Toggle user status
const toggleUserStatus = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    // Determine the new status
    const newStatus = user.status === "Active" ? "Inactive" : "Active";

    // Update the status field only
    const result = await User.updateOne(
        { _id: userId },
        { $set: { status: newStatus } }
    );

    // Check if the update was successful
    if (result.modifiedCount === 0) {
        res.status(404);
        throw new Error("User not found or status not changed");
    }

    // Redirect back to user management page
    res.redirect("/admin/users");
});


// ============================
//  Order Management Controllers
// ============================

// Render Order Management Page
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({ dateOrdered: -1 });

  res.render("layout", {
    title: "Order Management",
    viewName: "admin/orderManagement",
    activePage: "orders",
    isAdmin: true,
    orders,
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const status = req.body.status;
  try {
    const updatedOrder = await Order.updateOne(
      { _id: orderId },
      { $set: { status } }
    );

    if (!updatedOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

const viewOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const order = await Order.findById({ _id: orderId })
    .populate("user", "firstName lastName email mobile")
    .populate({ path: "orderItems", populate: "product" });

  res.render("layout", {
    title: "Order Management",
    viewName: "admin/viewOrder",
    activePage: "orders",
    isAdmin: true,
    order,
  });
});

// ============================
//  Coupon Management Controllers
// ============================

// Render Coupon Management Page
const getCoupons = asyncHandler(async (req, res) => {
  res.render("layout", {
    title: "Coupon Management",
    viewName: "admin/couponManagement",
    activePage: "coupon",
    isAdmin: true,
  });
});

// ============================
//  Offer Management Controllers
// ============================

// Render Offer Management Page
const getOffers = asyncHandler(async (req, res) => {
  
  res.render("layout", {
    title: "Offer Management",
    viewName: "admin/offerManagement",
    activePage: "offer",
    isAdmin: true,
  });
});




module.exports = { getAdminLogin, loginAdmin, getAdminHome, logoutAdmin, getUsers, toggleUserStatus,
    getOrders,updateOrderStatus,viewOrder,getCoupons,getOffers}