const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: {
      main: {
        type: String,
        required: true,
      },
      supports: {
        type: [String],
        validate: {
          validator: function (v) {
            return v.length === 2;
          },
          message: "Supports images must be exactly 2",
        },
        required: true,
      },
    },
    stock: {
      type: Number,
      required: true,
      max: 100,
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    popularity: {
      type: Number,
      default: 0,
    },
    isActive: { type: Boolean, default: true },
    isOutOfStock: {
      type: Boolean,
      default: false, 
    },
    ratings: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },
      review: {
        type: String,
        trim: true
      },
      date: {
        type: Date,
        default: Date.now
      }
    }],
    averageRating: {
      type: Number,
      default: 0
    },
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  }
);

// Method to calculate average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.totalRatings = 0;
  } else {
    const sum = this.ratings.reduce((acc, item) => acc + item.rating, 0);
    this.averageRating = sum / this.ratings.length;
    this.totalRatings = this.ratings.length;
  }
};

module.exports = mongoose.model("Product", productSchema);
