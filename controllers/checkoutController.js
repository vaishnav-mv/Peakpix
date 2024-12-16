const Address = require("../models/address");
const Cart = require("../models/cart");
const OrderItem = require("../models/orderItem");
const Order = require("../models/order");
const Product = require("../models/products");
const User = require("../models/user");
const asyncHandler = require("express-async-handler");

const getCheckoutPage = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const cart = await Cart.findOne({ user: userId });
  const addresses = await Address.find({ user: userId });
  res.render("layout", {
    title: "Checkout",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "user/checkout",
    activePage: "Shop",
    isAdmin: false,
    cart,
    addresses,
  });
});

const confirmPayment = asyncHandler(async (req, res) => {
  const orderId = req.body.orderId;
  const paymentMethod = req.body.paymentMethod;
  const order = await Order.findById(orderId)
  if (!order) {
    return res.status(404).json({success: false, message: "Order not found!"});
  }

  order.paymentMethod = paymentMethod;
  order.status = "Processed";

  await order.save();
  res.status(200).json({
    success: true,
    message: "Payment confirmed, order updated successfully",
    order,
  });
})


const placeOrder = asyncHandler(async (req, res) => {
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

  // Validate required fields
  if (!location || !city || !state || !zip) {
    return res.status(400).json({ success: false, message: "All address fields are required." });
  }

  try {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(400).json({ success: false, message: "Cart not found" });
    }

    if (cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const orderItems = await Promise.all(
      cart.items.map(async (item) => {
        const orderItem = new OrderItem({
          quantity: item.quantity,
          product: item.productId,
        });
        await orderItem.save();

        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }

        const updatedStock = product.stock - item.quantity;
        const isOutOfStock = updatedStock <= 0;

        await Product.findByIdAndUpdate(
          item.productId,
          {
            $inc: { stock: -item.quantity, popularity: 1 },
            $set: { isOutOfStock },
          } // Decrement stock by the ordered quantity
        );

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

    await Cart.deleteOne({ user: userId });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: placedOrder._id,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({
      success: false,
      message: "Error placing the order",
      error: error.message, // Include error message for debugging
    });
  }
});

const paymentSelection = asyncHandler(async (req, res) => {
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
      viewName: "user/payment",
      activePage: "Shop",
      isAdmin: false,
      order,
      walletBalance: user.walletBalance
    });
  } catch (error) {
    res.status(500).send("Error fetching order");
  }
})

const orderSuccessPage = asyncHandler(async (req, res) => {
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
      viewName: "user/orderSuccess",
      activePage: "Order",
      isAdmin: false,
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send("Server Error");
  }
});

const getOrderHistory = asyncHandler(async (req, res) => {
  const userId = req.session.user;

  const orders = await Order.find({ user: userId })
    .populate({ path: "orderItems", populate: "product" })
    .sort({ dateOrdered: -1 });

  res.render("layout", {
    title: "Order History",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "user/orderHistory",
    activePage: "Order History",
    isAdmin: false,
    orders,
  });
});

const getOrderDetail = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate({
    path: "orderItems",
    populate: {
      path: "product",
    },
  });

  res.render("layout", {
    title: "Order Detail",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "user/orderDetail",
    activePage: "Order",
    isAdmin: false,
    order,
  });
});

const cancelOrder = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.status === "Shipped" || order.status === "Delivered") {
      order.isCancelled = true;
      await Order.findByIdAndUpdate(orderId, {
        isCancelled: true,
      });
    } else if (order.status === "Pending" || order.status === "Processed") {
      const user = await User.findById(order.user);
      if (!user) {
        throw new Error("User not found");
      }

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

      await Order.findByIdAndUpdate(orderId, { status: "Cancelled" });
    } else {
      res
        .status(400)
        .json({ message: "Order cannot be cancelled in its current status" });
    }

    return res.status(200).json({
      message: "Order cancelled successfully",
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});


module.exports={getCheckoutPage,confirmPayment, placeOrder,paymentSelection,
   orderSuccessPage,getOrderHistory,getOrderDetail,cancelOrder}