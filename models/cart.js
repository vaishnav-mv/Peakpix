const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        image: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        discountedPrice: {
          type: Number,
          required: true,
        },
        discountAmount: {
          type: Number,
          required: true,
          default: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        subtotal: {
          type: Number,
          required: true,
        },
      },
    ],
    shippingCharge: {
      type: Number,
      default: 20,
    },
    total: {
      type: Number,
      required: true,
    },
    discountApplied: {
      type: Number, // store the discount amount
      default: 0,
    },
    finalTotal: {
      type: Number, // total after discount
      // required: true,
    },
    appliedCoupon: {
      type: String, // coupon code
    },
  },
  {
    timestamps: true,
  }
);

cartSchema.methods.calculateTotals = function () {
  // Calculate total before discounts
  const originalTotal = this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  // Calculate total savings
  const totalSavings = this.items.reduce((acc, item) => acc + (item.discountAmount * item.quantity), 0);
  
  // Calculate final total after discounts
  this.total = this.items.reduce((acc, item) => acc + item.subtotal, 0);
  
  // Add shipping charge if cart is not empty
  this.finalTotal = this.total + (this.items.length === 0 ? 0 : this.shippingCharge);
  
  return {
    originalTotal,
    totalSavings,
    finalTotal: this.finalTotal
  };
};

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
