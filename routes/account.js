const express = require('express')
const accountRouter = express.Router()
const {userAuth} = require("../middleware/userAuth")
const {getUserAccount,updateUserAccount,walletTransactions,getAddresses,addAddress,
    getAddressDetails,updateDefaultAddress,editAddressPage,updateAddress,deleteAddress,
    updatePassword
} = require("../controllers/userController")

const{getOrderHistory,getOrderDetail,cancelOrder}  = require("../controllers/checkoutController")

// Get routes
accountRouter.get("/", userAuth, getUserAccount)
accountRouter.get("/addresses", userAuth, getAddresses)
accountRouter.get("/addresses/edit/:id", userAuth, editAddressPage)
accountRouter.get("/addresses/:id", userAuth, getAddressDetails)
accountRouter.get("/order-history", userAuth, getOrderHistory);
accountRouter.get("/order-history/cancel/:id", userAuth, cancelOrder);
accountRouter.get("/order-history/:id", userAuth, getOrderDetail);

// Post routes
accountRouter.post("/add-addresses", userAuth, addAddress)
accountRouter.post("/addresses/default", userAuth, updateDefaultAddress)
accountRouter.post("/addresses/edit/:id", userAuth, updateAddress)
accountRouter.post("/update-password", userAuth, updatePassword)
accountRouter.post("/:id", userAuth, updateUserAccount)




accountRouter.delete("/addresses/delete/:id", userAuth, deleteAddress)


module.exports = accountRouter