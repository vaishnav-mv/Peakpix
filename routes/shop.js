const express = require('express')
const shopRouter = express.Router()
const Product = require('../models/products')
const {userAuth} = require('../middleware/userAuth')

const {getShop,filterShop,getProduct,getStock,getCart,getCartItemID,addToCart,updateCart,deleteItemFromCart
} = require('../controllers/userController')

shopRouter.get('/',getShop)

shopRouter.post("/", filterShop);

shopRouter.get('/search-products', async (req, res) => {
  const query = req.query.query || '';

  try {
    let products;
    if (query === '') {
      products = await Product.find();

    } else {
      const regex = new RegExp('^' + query, 'i');
      products = await Product.find({ name: { $regex: regex } });
    }

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

shopRouter.get("/cart", userAuth, getCart);

shopRouter.get("/cart-item-id", userAuth, getCartItemID);

shopRouter.post("/cart/updateQuantity", userAuth, updateCart);

shopRouter.get("/cart/:id", userAuth, addToCart);

shopRouter.delete("/cart/:id", userAuth, deleteItemFromCart);



// Get the stock of a product
shopRouter.get("/stock", userAuth, getStock);

shopRouter.get("/:id", getProduct);


module.exports = shopRouter