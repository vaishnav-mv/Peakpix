const express = require("express");
const checkoutRouter = express.Router();
const {userAuth} = require("../middleware/userAuth");
const {
  getCheckoutPage,
  orderSuccessPage,
  razorPay,
  applyCoupon,
  removeCoupon,
  placeOrder,
  paymentSelection,
  confirmPayment,
  walletPayment,
} = require("../controllers/checkoutController");

checkoutRouter.get("/", userAuth, getCheckoutPage);

checkoutRouter.post('/', userAuth, confirmPayment);

checkoutRouter.post('/wallet', userAuth, walletPayment)

checkoutRouter.post('/place-order', userAuth, placeOrder)

checkoutRouter.get("/payment", userAuth, paymentSelection)

checkoutRouter.post('/apply-coupons', userAuth, applyCoupon)

checkoutRouter.get('/remove-coupon/:cartId', userAuth, removeCoupon)

checkoutRouter.post('/order', razorPay);

checkoutRouter.get("/order-success/:orderId", userAuth, orderSuccessPage);

module.exports = checkoutRouter;
