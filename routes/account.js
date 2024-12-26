const express = require("express");
const accountRouter = express.Router();
const {userAuth} = require("../middleware/userAuth");
const {
  cancelOrder,
  getOrderHistory,
  getOrderDetail,
} = require("../controllers/checkoutController");
const {
  getUserAccount,
  getAddresses,
  addAddress,
  updateDefaultAddress,
  getAddressDetails,
  editAddressPage,
  updateAddress,
  deleteAddress,
  updateUserAccount,
  walletTransactions,
  updatePassword,
  downloadInvoice,
} = require("../controllers/userController");

accountRouter.get("/", userAuth, getUserAccount);

accountRouter.get("/addresses", userAuth, getAddresses);

accountRouter.post("/addresses", userAuth, addAddress);

accountRouter.post("/addresses/default", userAuth, updateDefaultAddress);

accountRouter.get("/addresses/edit/:id", userAuth, editAddressPage);

accountRouter.get("/addresses/:id", userAuth, getAddressDetails);

accountRouter.post("/addresses/edit/:id", userAuth, updateAddress);

accountRouter.delete("/addresses/delete/:id", userAuth, deleteAddress);

accountRouter.post("/update-password", userAuth, updatePassword);

accountRouter.post("/:id", userAuth, updateUserAccount);

accountRouter.get("/wallet/transactions", userAuth, walletTransactions);

accountRouter.get("/order-history", userAuth, getOrderHistory);

accountRouter.get("/order-history/cancel/:id", userAuth, cancelOrder);

accountRouter.get("/order-history/:id", userAuth, getOrderDetail);

accountRouter.get("/order/:id/invoice", downloadInvoice);


module.exports = accountRouter;
