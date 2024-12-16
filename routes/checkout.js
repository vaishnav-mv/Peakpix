const express = require("express");
const checkoutRouter = express.Router();
const {userAuth} = require("../middleware/userAuth");

const {getCheckoutPage,confirmPayment, placeOrder,paymentSelection,orderSuccessPage
} = require("../controllers/checkoutController");
  
checkoutRouter.get("/", userAuth, getCheckoutPage);

checkoutRouter.post('/', userAuth, confirmPayment);

checkoutRouter.post('/place-order', userAuth, placeOrder)

checkoutRouter.get("/payment/:orderId", userAuth, paymentSelection)

checkoutRouter.get("/order-success/:orderId", userAuth, orderSuccessPage);

module.exports = checkoutRouter