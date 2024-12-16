const User = require("../models/user");
const Product = require("../models/products");
const Address = require("../models/address");
const Cart = require("../models/cart");
const asyncHandler = require("express-async-handler");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const addToCart = async (userId, productId, quantity) => {
  const product = await Product.findById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [], shippingCharge: 50, total: 0 });
  }

  const itemIndex = cart.items.findIndex((item) =>
    item.productId.equals(productId)
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].subtotal =
      cart.items[itemIndex].quantity * cart.items[itemIndex].price;
  } else {
    cart.items.push({
      productId: product._id,
      name: product.name,
      image: product.images.main,
      price: product.price,
      quantity: quantity,
      subtotal: product.price * quantity,
    });
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
        viewName: "user/verifyOtp",
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
        viewName: "user/verifyOtp",
        error: "Invalid OTP",
        isAdmin: false,
        activePage: "home",
      });
    }
  } else {
    res.render("layout", {
      title: "Verify OTP",
      header: "partials/header",
      viewName: "user/verifyOtp",
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
  const maxPrice = 10000;
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
    
  ]);

  res.render("layout", {
    title: "Peakpix",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "user/shop",
    activePage: "shop",
    isAdmin: false,
    products,
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
    viewName: "user/shop",
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
  const product = await Product.findById(req.params.id).populate('categoryId');
  if (!product) {
    return res.status(404).send("Product not found");
  }


  const relatedProducts = await Product.find({
    categoryId: product.categoryId._id,
    _id: { $ne: product._id }
  }).populate('categoryId');

  res.render("layout", {
    title: "Peakpix",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "user/product-detail",
    activePage: "shop",
    isAdmin: false,
    product,
    relatedProducts,
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
    viewName: "user/userAccount",
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
    viewName: "user/manageAddress",
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
    viewName: "user/editAddress",
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


exports.getCart = asyncHandler(async (req, res) => {
  const userId = req.session.user;
  const cart = await Cart.findOne({ user: userId });

  res.render("layout", {
    title: "Cart",
    header: req.session.user ? "partials/login_header" : "partials/header",
    viewName: "user/cart",
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


