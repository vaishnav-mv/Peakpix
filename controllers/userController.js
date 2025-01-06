const User = require("../models/user");
const Product = require("../models/products");
const Address = require("../models/address");
const Cart = require("../models/cart");
const Offer = require("../models/offer")
const Order = require("../models/order");
const PDFDocument = require("pdfkit");
const asyncHandler = require("express-async-handler");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const moment = require("moment");
const { calculateDiscountedPrice } = require("../services/offerService");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const addToCart = async (userId, productId, quantity) => {
  // Get product with populated offers
  const product = await Product.findById(productId)
    .populate('offerId')
    .populate({
      path: 'categoryId',
      populate: { path: 'offerId' }
    });

  if (!product) {
    throw new Error("Product not found");
  }

  // Calculate discounted price using the offerService
  const productOffer = product.offerId;
  const categoryOffer = product.categoryId?.offerId;
  const { discountedPrice, discountAmount } = calculateDiscountedPrice(
    product.price,
    productOffer,
    categoryOffer
  );

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [], total: 0 });
  }

  const itemIndex = cart.items.findIndex((item) =>
    item.productId.equals(productId)
  );

  // Create the item object with proper number values
  const cartItem = {
    productId: product._id,
    name: product.name,
    image: product.images.main,
    price: Number(product.price),
    discountedPrice: Number(discountedPrice), // Ensure it's a number
    discountAmount: Number(discountAmount),    // Ensure it's a number
    quantity: Number(quantity),
    subtotal: Number(discountedPrice) * Number(quantity) // Calculate subtotal using numbers
  };

  if (itemIndex > -1) {
    // Update existing item
    cart.items[itemIndex] = {
      ...cart.items[itemIndex],
      ...cartItem
    };
  } else {
    // Add new item
    cart.items.push(cartItem);
  }

  cart.calculateTotals();
  await cart.save();
  return cart;
};

exports.successGoogleLogin = async (req , res) => { 
	if(!req.user) 
		res.redirect('/failure'); 
  try {
    let user = await User.findOne({ email: req.user.email });

    if (!user) {
      user = new User({
        firstName: req.user.name.givenName,
        lastName: req.user.name.familyName,
        email: req.user.email,
        password: "123456",
        status: "Active",
        isGoogleUser: true,
      });
      await user.save();
    }

    req.session.user = user;

    res.redirect("/");
  } catch (error) {
    console.error("Error during Google login: ", error);
    res.redirect("/login");
  }
}

exports.failureGoogleLogin = (req , res) => { 
	res.send("Error"); 
}

exports.sendOtp = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const findUser = await User.findOne({ email });

  if (!findUser) {
    const otp = crypto.randomInt(100000, 999999);
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    console.log(otp)
    req.session.otp = otp;
    req.session.otpExpiry = otpExpiry;
    req.session.tempUser = { firstName, lastName, email, password };

    const mailOptions = {
      from: "vaishnavam02@gmail.com",
      to: email,
      subject: "Your OTP for Signup",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.render("layout", {
        title: "Verify OTP",
        header: "partials/header",
        viewName: "users/verifyOtp",
        error: null,
        isAdmin: false,
        activePage: "home",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error sending OTP" });
    }
  } else {
    throw new Error("User Already Exists");
  }
});

exports.resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.session.tempUser; // Fetch tempUser from session
  if (!email) {
    return res
      .status(400)
      .json({ error: "No user data in session. Please sign up again." });
  }

  // Generate new OTP and update session
  const otp = crypto.randomInt(100000, 999999);
  const otpExpiry = Date.now() + 5 * 60 * 1000;
  
  console.log(otp)
  req.session.otp = otp;
  req.session.otpExpiry = otpExpiry;

  const mailOptions = {
    from: "vaishnavam02@gmail.com",
    to: email,
    subject: "Your OTP for Signup",
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "New OTP sent successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

exports.verifyAndSignUp = asyncHandler(async (req, res) => {
  const { otp } = req.body;

  if (req.session.otp && req.session.otpExpiry > Date.now()) {
    if (req.session.otp == otp) {
      const { firstName, lastName, email, password } = req.session.tempUser;

      const newUser = new User({
        firstName,
        lastName,
        email,
        password,
      });

      await newUser.save();

      req.session.otp = null;
      req.session.otpExpiry = null;
      req.session.tempUser = null;

      req.session.user = newUser._id;
      res.redirect("/");
    } else {
      res.render("layout", {
        title: "Verify OTP",
        header: "partials/header",
        viewName: "users/verifyOtp",
        error: "Invalid OTP",
        isAdmin: false,
        activePage: "home",
      });
    }
  } else {
    res.render("layout", {
      title: "Verify OTP",
      header: "partials/header",
      viewName: "users/verifyOtp",
      error: "OTP has expired. Please sign up again.",
      isAdmin: false,
      activePage: "home",
    });
  }
});

exports.loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const findUser = await User.findOne({ email });

  if (
    findUser &&
    (await findUser.isPasswordMatched(password)) &&
    findUser.status === "Active"
  ) {
    req.session.user = findUser._id;
    res.status(200).json({
      success: true,
      message: "Login successful",
      redirectUrl: "/",
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid Credentials",
    });
  }
});

exports.logoutUser = asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to log out" });
    }
    res.redirect("/login");
  });
});

exports.getShop = asyncHandler(async (req, res) => {
  const category = "";
  const minPrice = 200;
  const maxPrice = 5000;
  const sortBy = "";
  const products = await Product.aggregate([
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    {
      $unwind: "$categoryDetails",
    },
    {
      $match: {
        "categoryDetails.isActive": true, // Only include products where the associated category is active
        isActive: true,
      },
    },
    {
      $lookup: {
        from: "offers",
        localField: "offerId", // Lookup for product-specific offer
        foreignField: "_id",
        as: "productOfferDetails",
      },
    },
    {
      $unwind: {
        path: "$productOfferDetails",
        preserveNullAndEmptyArrays: true, // Include products without a product-specific offer
      },
    },
    {
      $lookup: {
        from: "offers",
        localField: "categoryDetails.offerId", // Lookup for category-specific offer
        foreignField: "_id",
        as: "categoryOfferDetails",
      },
    },
    {
      $unwind: {
        path: "$categoryOfferDetails",
        preserveNullAndEmptyArrays: true, // Include categories without a category-wide offer
      },
    },
  ]);

  const productsWithDiscounts = products.map((product) => {
    // Get the offers (if they exist)
    const productOffer = product.productOfferDetails || null;
    const categoryOffer = product.categoryOfferDetails || null;

    // Calculate the best discounted price
    const discountedPrice = calculateDiscountedPrice(
      product.price,
      productOffer,
      categoryOffer
    );

    // Return the product along with the calculated discounted price
    return {
      ...product,
      discountedPrice, // Add the discounted price
    };
  });

  res.render("layout", {
    title: "Peakpix",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/shop",
    activePage: "shop",
    isAdmin: false,
    products: productsWithDiscounts,
    category,
    minPrice,
    maxPrice,
    sortBy,
  });
});

exports.filterShop = asyncHandler(async (req, res) => {
  const sortBy = req.body.sort;
  const category = req.body.category;
  const minPrice = parseFloat(req.body.minPrice) || 0;
  const maxPrice = parseFloat(req.body.maxPrice) || Infinity;

  let sortCriteria = {};
  let matchCriteria = { "categoryDetails.isActive": true, isActive: true };

  switch (sortBy) {
    case "popularity":
      sortCriteria = { popularity: -1 };
      break;
    case "price-asc":
      sortCriteria = { price: 1 };
      break;
    case "price-desc":
      sortCriteria = { price: -1 };
      break;
    case "rating":
      sortCriteria = { averageRatings: -1 };
      break;
    case "featured":
      sortCriteria = { featured: -1 };
      break;
    case "new":
      sortCriteria = { createdAt: -1 };
      break;
    case "a-z":
      sortCriteria = { name: 1 };
      break;
    case "z-a":
      sortCriteria = { name: -1 };
      break;
    default:
      sortCriteria = null;
      break;
  }

  if (category) {
    matchCriteria["categoryDetails.name"] = category;
  }

  if (!isNaN(minPrice) && !isNaN(maxPrice)) {
    matchCriteria.price = { $gte: minPrice, $lte: maxPrice };
  }

  const pipeline = [
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    {
      $unwind: "$categoryDetails",
    },
    {
      $match: matchCriteria,
    },
  ];

  if (sortCriteria !== null) {
    pipeline.push({ $sort: sortCriteria });
  }

  const products = await Product.aggregate(pipeline);

  res.render("layout", {
    title: "Peakpix",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/shop",
    activePage: "shop",
    isAdmin: false,
    products,
    category,
    minPrice,
    maxPrice,
    sortBy,
  });
});

exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('categoryId')
  .populate({
    path: 'ratings.user',
    select: 'firstName lastName'  // Select the user fields you want to display
  });
  if (!product) {
    return res.status(404).send("Product not found");
  }

  const categoryOffer = product.categoryId.offerId
    ? await Offer.findById(product.categoryId.offerId)
    : null;

  const productOffer = product.offerId
    ? await Offer.findById(product.offerId)
    : null;

  const discountedPrice = calculateDiscountedPrice(
    product.price,
    productOffer,
    categoryOffer
  );

  const relatedProducts = await Product.find({
    categoryId: product.categoryId._id,
    _id: { $ne: product._id }
  }).populate('categoryId');


  // Calculate discounted prices for related products
  const relatedProductsWithDiscounts = await Promise.all(
    relatedProducts.map(async (relatedProduct) => {
      const relatedProductOffer = relatedProduct.offerId
        ? await Offer.findById(relatedProduct.offerId)
        : null;
      const relatedCategoryOffer = relatedProduct.categoryId.offerId
        ? await Offer.findById(relatedProduct.categoryId.offerId)
        : null;

      const discountedPrice = calculateDiscountedPrice(
        relatedProduct.price,
        relatedProductOffer,
        relatedCategoryOffer
      );

      return {
        ...relatedProduct.toObject(),
        discountedPrice
      };
    })
  );
  

  res.render("layout", {
    title: "Peakpix",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/product-detail",
    activePage: "shop",
    isAdmin: false,
    product: {
      ...product.toObject(),
      discountedPrice 
    },
    relatedProducts: relatedProductsWithDiscounts,
    isLoggedIn: !!req.session.user,  
    userId: req.session.user || null
  });
});

exports.getStock = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Return the stock quantity
    res.json({ stock: product.stock });
  } catch (error) {
    console.error("Error fetching stock information:", error);
    res.status(500).json({ error: "Server error" });
  }
});

exports.getUserAccount = asyncHandler(async (req, res) => {
  const id = req.session.user;
  const user = await User.findById(id);

  res.render("layout", {
    title: "My Peakpix Account",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/userAccount",
    activePage: "Home",
    isAdmin: false,
    user,
  });
});

exports.updateUserAccount = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const existingUser = await User.findOne({
    email,
    _id: { $ne: req.params.id },
  });
  if (existingUser) {
    return res
      .status(400)
      .json({ success: false, message: "Email is already in use" });
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, {
    $set: req.body,
  });

  if (!updatedUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res
    .status(200)
    .json({ success: true, message: "Account updated successfully" });
});

exports.updatePassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.session.user;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})

exports.resetPassword  = asyncHandler(async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const email = req.session.email; // Assuming user ID is stored in session

  // Check if user is authenticated
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }

  // Check if passwords match
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const user = await User.find({email});
    const userId = user[0]._id;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

exports.getAddresses = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const addresses = await Address.find({ user: userId });

  res.render("layout", {
    title: "Manage Address",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/manageAddress",
    activePage: "Home",
    isAdmin: false,
    addresses,
  });
});

exports.getAddressDetails = asyncHandler(async (req, res) => {
  const addressid = req.params.id;
  const userId = req.session.user;

  const user = await User.findById(userId);
  const address = await Address.findById(addressid);

  const result = {
    name: user.firstName + user.lastName,
    mobile: user.mobile,
    location: address.location,
    city: address.city,
    state: address.state,
    landmark: address.landmark || "",
    zip: address.zip,
  };
  res.status(200).json(result);
});

exports.addAddress = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const userAddresses = await Address.find({ user: userId });

  if (req.body.isDefault == "true")
    await Address.updateMany({}, { $set: { isDefault: false } });

  const newAddress = new Address({
    user: userId,
    location: req.body.location,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country,
    zip: req.body.zip,
    addressType: req.body.addressType,
    customName: req.body.customName,
    isDefault: userAddresses.length === 0 || req.body.isDefault,
  });

  await newAddress.save();

  await User.findByIdAndUpdate(userId, {
    $push: { addresses: newAddress._id },
  });

  res.redirect("/account/addresses");
});

exports.updateDefaultAddress = asyncHandler(async (req, res) => {
  const { newDefaultId } = req.body;

  try {
    await Address.updateMany({}, { $set: { isDefault: false } });

    await Address.findByIdAndUpdate(newDefaultId, {
      $set: { isDefault: true },
    });

    res.status(200).send("Default address updated successfully");
  } catch (error) {
    console.error("Error updating default address:", error);
    res.status(500).send("Internal Server Error");
  }
});

exports.editAddressPage = asyncHandler(async (req, res) => {
  const addressId = req.params.id;
  const address = await Address.findById(addressId);

  res.render("layout", {
    title: "Edit Address",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/editAddress",
    activePage: "Home",
    isAdmin: false,
    address,
  });
});

exports.updateAddress = asyncHandler(async (req, res) => {
  const addressId = req.params.id;
  const updatedAddress = {
    customName: req.body.customName,
    addressType: req.body.addressType,
    location: req.body.location,
    city: req.body.city,
    state: req.body.state,
    zip: req.body.zip,
    country: req.body.country,
  };

  await Address.findByIdAndUpdate(addressId, updatedAddress);

  res.redirect("/account/addresses");
});

exports.deleteAddress = asyncHandler(async (req, res) => {
  const addressId = req.params.id;

  const result = await Address.findByIdAndDelete(addressId);

  if (!result) {
    return res.status(404).send("Address not found");
  }

  res.status(200).send("Address deleted successfully");
});

exports.walletTransactions = asyncHandler(async (req, res) => {
  const userId = req.session.user;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.render("layout", {
    title: "My Peakpix Account",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/walletTransaction",
    activePage: "Home",
    isAdmin: false,
    user,
  });
})

exports.getCart = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const cart = await Cart.findOne({ user: userId });

  res.render("layout", {
    title: "Cart",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "users/cart",
    activePage: "Shop",
    isAdmin: false,
    cart,
  });
});

exports.getCartItemID = asyncHandler(async (req, res) => {
  const userId = req.session.user;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Find the cart for the user
    const cart = await Cart.findOne({ user: userId }).populate(
      "items.productId"
    );

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Extract product IDs and quantities
    const products = cart.items.map((item) => ({
      productId: item.productId._id.toString(),
      quantity: item.quantity,
      name: item.name,
    }));

    // Return product IDs and quantities as response
    res.json({ products });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ error: "Server error" });
  }
});

exports.addToCart = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const productId = req.params.id;
  try {
    await addToCart(userId, productId, 1);
    res.status(200).json({ message: "Item added to cart successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add item to cart" });
  }
});

exports.updateCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.session.user;

  const cart = await addToCart(userId, productId, quantity);

  res.json(cart);
});

exports.deleteItemFromCart = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const userId = req.session.user;

  try {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Remove the item with the specified productId
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );
    // Save the updated cart
    cart.calculateTotals();
    await cart.save();

    res.status(200).json({ message: "Item removed successfully", cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

exports.getWishList = asyncHandler(async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Check if userId exists
    if (!userId) {
      return res.status(401).send('Unauthorized'); // or redirect to login
    }

    const user = await User.findById(userId).populate('wishlist');
    
    const wishlist = user.wishlist.map(product => ({
      _id: product._id,
      name: product.name,
      price: product.price,
      image: product.images.main, // Adjust according to your schema
      description: product.description,
      price: product.price
    }));//maps over wishlist array to create a new array of products with specific fields prepares the wishlist data for rendering.

    // Check if user is found
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Render the view with wishlist data
    res.render("layout", {
      title: "Wishlist",
      header: req.session.user ? "partials/login_header" : "partials/header",
      viewName: "users/wishlist",
      activePage: "Shop",
      isAdmin: false,
      wishlist,
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).send('Server error');
  }
});

exports.addToWishlist = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const userId = req.session.user;

  if (!userId || !productId) {
    return res.status(400).json({ message: "User ID and Product ID are required" });
  }

  try {
    // Check if the product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Add product to the user's wishlist
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ message: "Product is already in the wishlist" });
    }

    // Update the user's wishlist by adding the productId
    await User.updateOne(
      { _id: userId },
      { $push: { wishlist: productId } }
    );

    res.status(200).json({ message: "Product added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error", error });
  }
})

exports.removeWishlist = asyncHandler(async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.id; 

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { wishlist: productId } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist successfully'
    });
  } catch (error) {
    console.error('Error removing product from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while removing the product from wishlist',
      error: error.message
    });
  }
})

exports.getInvoiceData = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate({ 
      path: "orderItems", 
      populate: "product" 
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Process order items to ensure all required data is present
    const processedOrderItems = order.orderItems.map(item => ({
      product: {
        name: item.product?.name || 'Product Not Available',
        price: Number(item.product?.price || 0)
      },
      quantity: Number(item.quantity || 0),
      total: Number(item.product?.price || 0) * Number(item.quantity || 0)
    }));

    // Calculate totals
    const subtotal = processedOrderItems.reduce((sum, item) => sum + item.total, 0);

    const invoiceData = {
      orderId: order._id,
      dateOrdered: order.dateOrdered || order.createdAt,
      paymentMethod: order.paymentMethod || 'N/A',
      status: order.status || 'N/A',
      name: order.name || 'N/A',
      location: order.location || 'N/A',
      city: order.city || 'N/A',
      state: order.state || 'N/A',
      zip: order.zip || 'N/A',
      mobile: order.mobile || 'N/A',
      orderItems: processedOrderItems,
      totalAmount: Number(order.totalAmount || 0),
      shippingCharge: Number(order.shippingCharge || 0),
      discountApplied: Number(order.discountApplied || 0),
      finalTotal: Number(order.finalTotal || subtotal + (order.shippingCharge || 0) - (order.discountApplied || 0))
    };
    console.log(invoiceData);

    res.json(invoiceData);
    
  } catch (error) {
    console.error("Error in getInvoiceData:", error);
    res.status(500).json({ 
      message: 'Error generating invoice data',
      error: error.message 
    });
  }
});


exports.addRating = asyncHandler(async (req, res) => {
  const { productId, rating, review } = req.body;
  const userId = req.session.user;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user has already rated
    const existingRatingIndex = product.ratings.findIndex(
      r => r.user.toString() === userId.toString()
    );

    if (existingRatingIndex >= 0) {
      // Update existing rating
      product.ratings[existingRatingIndex] = {
        user: userId,
        rating: Number(rating),
        review,
        date: new Date()
      };
    } else {
      // Add new rating
      product.ratings.push({
        user: userId,
        rating: Number(rating),
        review,
        date: new Date()
      });
    }

    // Calculate new average
    product.calculateAverageRating();
    await product.save();

    res.status(200).json({
      success: true,
      message: "Rating added successfully",
      averageRating: product.averageRating,
      totalRatings: product.totalRatings
    });
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ message: "Error adding rating" });
  }
});
