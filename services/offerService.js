const applyOffer = (price, offer) => {
  if (!offer) return { discountedPrice: price, discountAmount: 0 };

  // Check if the offer is within the valid date range
  const now = new Date();
  if (now < offer.validFrom || now > offer.validUntil || offer.status !== 'active') {
    return { discountedPrice: price, discountAmount: 0 };
  }

  let discountAmount = 0;

  if (offer.discountType === 'percentage') {
    discountAmount = (price * offer.discountValue / 100);
  } else if (offer.discountType === 'fixed') {
    discountAmount = offer.discountValue;
  }

  // Apply maximum discount if specified
  if (offer.maxDiscountAmount && discountAmount > offer.maxDiscountAmount) {
    discountAmount = offer.maxDiscountAmount;
  }

  return {
    discountedPrice: price - discountAmount,
    discountAmount: discountAmount
  };
};

const calculateDiscountedPrice = (productPrice, productOffer, categoryOffer) => {
  const productDiscount = applyOffer(productPrice, productOffer);
  const categoryDiscount = applyOffer(productPrice, categoryOffer);

  // Return the best discount
  if (productDiscount.discountAmount >= categoryDiscount.discountAmount) {
    return {
      discountedPrice: productDiscount.discountedPrice,
      discountAmount: productDiscount.discountAmount
    };
  } else {
    return {
      discountedPrice: categoryDiscount.discountedPrice,
      discountAmount: categoryDiscount.discountAmount
    };
  }
};

module.exports = {
  calculateDiscountedPrice,
};
