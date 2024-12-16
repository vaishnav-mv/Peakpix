const express = require("express");
const productRouter = express.Router();
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/multer");

const {getProducts,addProduct,toggleProductStatus,getProductById,updateProduct} = require("../controllers/productController");
  
// Product Management Route
productRouter.get("/", adminAuth, getProducts);
  
// Add new product
productRouter.post(
    "/add",
    adminAuth,
    upload.fields([
      { name: "mainImage", maxCount: 1 },
      { name: "supportImages", maxCount: 2 },
    ]),
    addProduct
  );
  
productRouter.post("/toggle-status/:id", adminAuth, toggleProductStatus);
  
// Get product details for editing
productRouter.get("/edit/:id", adminAuth, getProductById);
  
// Update product details
productRouter.post(
    "/edit/:id",
    adminAuth,
    upload.fields([
      { name: "mainImage", maxCount: 1 },
      { name: "supportImages", maxCount: 2 },
    ]),
    updateProduct
  );
  


module.exports= productRouter