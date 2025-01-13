const Address = require("../models/address");
const Cart = require("../models/cart");
const OrderItem = require("../models/orderItem");
const Order = require("../models/order");
const Product = require("../models/products");
const Coupon = require("../models/coupon");
const User = require("../models/user");
const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");

exports.getCheckoutPage = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const cart = await Cart.findOne({ user: userId });
  const addresses = await Address.find({ user: userId });
  const coupons = await Coupon.find({ isActive: true });
  const totalAmount = cart ? cart.total : 0;

  res.render("layout", {
    title: "Checkout",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/checkout",
    activePage: "Shop",
    isAdmin: false,
    cart,
    addresses,
    coupons,
    totalAmount,
  });
});

exports.applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode, cartId } = req.body;

  try {
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired coupon code" });
    }

    const currentDate = new Date();
    if (currentDate < coupon.validFrom || currentDate > coupon.validUntil) {
      return res.status(400).json({
        success: false,
        message: `Coupon ${couponCode} is not valid at this time.`,
      });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = parseFloat(((coupon.discountValue / 100) * cart.total).toFixed(2));
      if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
        discount = coupon.maxDiscountValue;
      }
    } else if (coupon.discountType === "fixed") {
      discount = coupon.discountValue;
    }

    if (cart.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: "A coupon has already been applied to this cart.",
      });
    }

    let finalTotal = cart.total - discount;

    await Cart.updateOne(
      { _id: cartId },
      {
        $set: {
          appliedCoupon: coupon.code,
          discountApplied: discount,
          finalTotal,
        },
      }
    );

    res.json({
      success: true,
      message: `Coupon ${couponCode} applied successfully.`,
      finalTotal,
      appliedCoupon: cart.appliedCoupon,
      discountApplied: discount
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while applying the coupon",
    });
  }
});

exports.removeCoupon = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId;
  try {
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    if (!cart.appliedCoupon) {
      return res
        .status(400)
        .json({ success: false, message: "No coupon applied to this cart." });
    }

    cart.appliedCoupon = null;
    cart.discountApplied = 0;

    cart.calculateTotals();

    await Cart.updateOne(
      { _id: cartId },
      {
        $set: {
          appliedCoupon: cart.appliedCoupon,
          discountApplied: cart.discountApplied,
          finalTotal: cart.finalTotal,
        },
      }
    );

    res.json({
      success: true,
      message: "Coupon removed successfully",
      finalTotal: cart.finalTotal,
      discountApplied: cart.discountApplied
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while removing the coupon",
    });
  }
});

exports.razorPay = asyncHandler(async (req, res) => {
  try {
    
    const orderData = await Order.findById(req.params.id)
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const options = req.body;
    const order = await razorpay.orders.create(options); //calls razorpay api to create an order with the provided options

    if (!order) {
      await Order.findByIdAndUpdate(orderData._id, {
        status: "Pending",
        paymentMethod: "Razorpay"
      });

      return res.status(400).json({ 
        success: false,
        message: "Payment failed",
        redirectUrl: `/orders/${orderData._id}` // URL to order detail page
      });

    }

    res.status(200).json({
      success: true,
      order,
      orderData
    });
    
  } catch (err) {
    console.error("Razorpay Error:", err);

    // If there's an error, update order status and redirect
    if (req.params.id) {
      await Order.findByIdAndUpdate(req.params.id, {
        status: "Pending",
        paymentMethod: "Razorpay"
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Payment processing failed",
      redirectUrl: `/orders/${req.params.id}` // URL to order detail page
    });
  }
});

exports.confirmPayment = asyncHandler(async (req, res) => {
  const orderId = req.body.orderId;
  const paymentMethod = req.body.paymentMethod;
  
  try {
    const order = await Order.findById(orderId)
      .populate({
        path: 'orderItems',
        populate: { path: 'product' }
      });
      
    if (!order) {
      return res.status(404).json({success: false, message: "Order not found!"});
    }

    if (paymentMethod === 'COD') {
      if (order.finalTotal > 1000) {
        return res.status(400).json({
          success: false,
          message: "Cash on Delivery is not available for orders above ₹1000."
        });
      }
    }

    // Update product stock after payment confirmation
    for (const orderItem of order.orderItems) {
      const product = orderItem.product;
      const updatedStock = product.stock - orderItem.quantity;
      const isOutOfStock = updatedStock <= 0;

      await Product.findByIdAndUpdate(
        product._id,
        {
          $inc: { stock: -orderItem.quantity, popularity: 1 },
          $set: { isOutOfStock }
        }
      );
    }

    order.paymentMethod = paymentMethod;
    order.status = "Processed";

    await order.save();

    // Delete the cart and create a new empty cart
    await Cart.deleteOne({ user: order.user });
    let cart = new Cart({ user: order.user._id, items: [], total: 0 });
    await cart.save();
    
    res.status(200).json({
      success: true,
      message: "Payment confirmed, order updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    res.status(500).json({
      success: false,
      message: "Error processing payment",
      error: error.message
    });
  }
});


exports.walletPayment = asyncHandler(async (req, res) => {
  const orderId = req.body.orderId;
  const userId = req.session.user;

  try {
    // Find the user and their wallet balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }

    // Find the order
    const order = await Order.findById(orderId)
      .populate({
        path: 'orderItems',
        populate: { path: 'product' }
      });
      
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found!" });
    }

    // Check if the wallet balance is sufficient
    if (user.walletBalance < order.finalTotal) {
      return res.status(400).json({ 
        success: false, 
        message: "Insufficient wallet balance. Please use a different payment method."
      });
    }

    // Deduct the order amount from the wallet
    const updatedWalletBalance = parseFloat((user.walletBalance - order.finalTotal).toFixed(2));

    // Update product stock after payment confirmation
    for (const orderItem of order.orderItems) {
      const product = orderItem.product;
      const updatedStock = product.stock - orderItem.quantity;
      const isOutOfStock = updatedStock <= 0;

      await Product.findByIdAndUpdate(
        product._id,
        {
          $inc: { stock: -orderItem.quantity, popularity: 1 },
          $set: { isOutOfStock }
        }
      );
    }

    // Update the order status and payment method
    order.paymentMethod = "Wallet";
    order.status = "Processed";

    // Save the updated user and order
    await User.updateOne(
      { _id: userId },
      { 
        $set: { walletBalance: updatedWalletBalance },
        $push: { walletTransactions: { transactionType: "Debit", amount: order.finalTotal, description: `Payment for Order ID: ${orderId}`, date: new Date() }}
      }
    );
    await order.save();

    // Delete the cart and create a new empty cart
    await Cart.deleteOne({ user: order.user });
    let cart = new Cart({ user: order.user._id, items: [], total: 0 });
    await cart.save();

    res.status(200).json({
      success: true,
      message: "Payment confirmed using wallet, order updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error processing wallet payment ${error.message}`,
      error: error.message,
    });
  }
});


exports.placeOrder = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const {
    name,
    mobile,
    alternateMobile,
    location,
    city,
    state,
    landmark,
    zip,
  } = req.body;

  // Address validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: "Name is required." });
  }
  if (!mobile || !/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ message: "Valid mobile number is required." });
  }
  if (alternateMobile && !/^\d{10}$/.test(alternateMobile)) {
    return res.status(400).json({ message: "Valid alternate mobile number is required." });
  }
  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    return res.status(400).json({ message: "Location is required." });
  }
  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    return res.status(400).json({ message: "City is required." });
  }
  if (!state || typeof state !== 'string' || state.trim().length === 0) {
    return res.status(400).json({ message: "State is required." });
  }
  if (!zip || !/^\d{6}$/.test(zip)) { // Assuming ZIP code is 5 digits
    return res.status(400).json({ message: "Valid ZIP code is required." });
  }

  try {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(400).json({ message: "Cart not found" });
    }

    if (cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const orderItems = await Promise.all(
      cart.items.map(async (item) => {
        const orderItem = new OrderItem({
          quantity: item.quantity,
          product: item.productId,
        });
        await orderItem.save();
        return orderItem;
      })
    );

    const order = new Order({
      user: userId,
      name,
      mobile,
      alternateMobile,
      location,
      city,
      state,
      landmark,
      zip,
      orderItems: orderItems.map((item) => item._id),
      shippingCharge: cart.shippingCharge,
      totalAmount: cart.total, 
      discountApplied: cart.discountApplied,
      finalTotal: cart.finalTotal, 
      appliedCoupon: cart.appliedCoupon || null,
      paymentMethod: null, 
    });

    const placedOrder = await order.save();

    res.status(201).json({
      success: true,
      message: "Proceeding to payment page",
      orderId: placedOrder._id,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error placing the order", error: error.message });
  }
});

exports.paymentSelection = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId).populate({
      path: "orderItems",
      populate: {
        path: "product",
      },
    });
    
    const user = await User.findById(req.session.user).select('walletBalance');

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("layout", {
      title: "Checkout",
      header: req.session.user ? "partials/login_header" : "partials/header",
      viewName: "users/payment",
      activePage: "Shop",
      isAdmin: false,
      order,
      walletBalance: user.walletBalance
    });
  } catch (error) {
    res.status(500).send("Error fetching order");
  }
})

exports.orderSuccessPage = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate({
        path: "orderItems",
        populate: {
          path: "product",
          select: "name price",
        },
      })
      .exec();

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("layout", {
      title: "Order Success",
      header: req.session.user ? "partials/login_header" : "partials/header",
      viewName: "users/orderSuccess",
      activePage: "Order",
      isAdmin: false,
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send("Server Error");
  }
});

exports.getOrderHistory = asyncHandler(async (req, res) => {
  const userId = req.session.user;

  const orders = await Order.find({ user: userId })
    .populate({ path: "orderItems", populate: "product" })
    .sort({ createdAt: -1 });

  res.render("layout", {
    title: "Order History",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/orderHistory",
    activePage: "Order History",
    isAdmin: false,
    orders,
  });
});

exports.getOrderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate({
    path: "orderItems",
    populate: {
      path: "product",
    },
  });

  res.render("layout", {
    title: "Order Detail",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/orderDetail",
    activePage: "Order",
    isAdmin: false,
    order,
  });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason } = req.body;

    // Validate cancel reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ message: "Cancel reason is required and cannot be empty." });
    }
    if (reason.trim().length < 10) { // Example: Minimum length of 10 characters
      return res.status(400).json({ message: "Cancel reason must be at least 10 characters long." });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.status === "Shipped" || order.status === "Delivered") {
      order.isCancelled = true;
      await Order.findByIdAndUpdate(orderId, {
        isCancelled: true,
        cancellationReason: reason.trim()
      });
    } else if (order.status === "Pending" || order.status === "Processed") {
      const user = await User.findById(order.user);
      if (!user) {
        throw new Error("User not found");
      }

      if (order.paymentMethod !== 'COD') {
        await User.findByIdAndUpdate(order.user, {
          $inc: { walletBalance: order.finalTotal }, // Add the order amount to the wallet balance
          $push: {
            walletTransactions: {
              transactionType: "Credit",
              amount: order.finalTotal,
              description: `Refund for cancelled order #${order._id}`,
              date: new Date(),
            },
          },
        });
      }

      // Update product stock
      for (const orderItemId of order.orderItems) {
        const item = await OrderItem.findById(orderItemId).populate('product');
        if (item && item.product) {
          await Product.findByIdAndUpdate(item.product._id, {
            $inc: { stock: item.quantity }
          });
        }
      }

      await Order.findByIdAndUpdate(orderId, { 
        status: "Cancelled",
        cancellationReason: reason.trim(),  // Save the reason
        isCancelled: true 
      });
    } else {
      res.status(400).json({ message: "Order cannot be cancelled in its current status" });
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});


exports.returnOrder = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.id;
    const { reason } = req.body;

    // Validate return reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ message: "Return reason is required and cannot be empty." });
    }
    if (reason.trim().length < 10) { // Example: Minimum length of 10 characters
      return res.status(400).json({ message: "Return reason must be at least 10 characters long." });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!['Shipped', 'Delivered'].includes(order.status)) {
      return res.status(400).json({ message: "This order cannot be returned" });
    }

    // Update order with return request details
    await Order.findByIdAndUpdate(
      orderId,
      {
        return: {
          status: true,
          reason: reason.trim(),
          date: new Date(),
          isApproved: false,
          requestStatus: 'Pending'
        }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error('Return error:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message || "Error processing return request" 
    });
  }
});