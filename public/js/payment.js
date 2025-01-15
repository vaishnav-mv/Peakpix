document.querySelector('.payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const paymentButton = document.getElementById('confirmBtn');
  const orderId = paymentButton.dataset.orderid;
  const finalTotal = paymentButton.dataset.finaltotal;

  let Toast = Swal.mixin({
    toast: true,
    position: "top",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
  });

  try {
    if (paymentMethod === "Razorpay") {
      const amount = finalTotal;
      const currency = "INR";
      const receiptId = "qwerty1";
      const response = await fetch(`/checkout/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount * 100,
          currency,
          receipt: receiptId,
        }),
      });
      const {order, orderData} = await response.json();
      // const data = await response.json();

      // if (!data.success && data.redirectUrl) {
      //   window.location.href = data.redirectUrl;
      //   return;
      // }

      var options = {
        key: "rzp_test_QrPtjXNHHRSmCn",
        amount,
        currency,
        name: "Peakpix",
        description: "Test Transaction",
        order_id: order.id,
        handler: async function (response) {
          try {
            const confirmResponse = await fetch("/checkout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paymentMethod: 'Razorpay',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }),
            });

            const confirmData = await confirmResponse.json();
            const orderId = confirmData.order._id
            if (confirmData.success) {
              await Toast.fire({
                icon: "success",
                title: "Payment completed successful!",
              });
              window.location.href = `/checkout/order-success/${orderId}`;
            } else {
              Toast.fire({
                icon: "error",
                title: confirmData.message || "An error occurred while finalizing the order",
              });
            }
          } catch (error) {
            console.error("Error during payment confirmation:", error);
            Toast.fire({
              icon: "error",
              title: "An unexpected error occurred while finalizing the order",
            });
          }
        },
        prefill: {
          name: orderData.name, //your customer's name
          contact: orderData.mobile,
        },
        notes: {
          address: "Razorpay Corporate Office",
        },
        theme: {
          color: "#3399cc",
        },
      };

      var rzp1 = new window.Razorpay(options);
      rzp1.on("payment.failed", function (response) {
        window.location.href = `/account/order-history/${orderId}`;
      });

      rzp1.open();
    } else if (paymentMethod === "COD") {
      let response = await fetch("/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({orderId, paymentMethod}),
      });
      const result = await response.json();
      console.log("result:",result) // Parse the JS`ON response
      console.log("result orderId:",result.order._id)
      const orderId = result.order._id
      if (result.success) {
        await Toast.fire({
          icon: "success",
          title: result.message,
        });
        window.location.href = `/checkout/order-success/${orderId}`; // Change this URL as needed
      } else {
        Toast.fire({
          icon: "error",
          title:
            result.message || "An error occurred while placing the order",
        });
      }
    } else if (paymentMethod === "Wallet") {
      let response = await fetch("/checkout/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({paymentMethod}),
      });
      const result = await response.json(); // Parse the JSON response
      const orderId = result.order._id
      if (result.success) {
        await Toast.fire({
          icon: "success",
          title: result.message,
        });
        window.location.href = `/checkout/order-success/${orderId}`; // Change this URL as needed
      } else {
        Toast.fire({
          icon: "error",
          title:
            result.message || "An error occurred while placing the order",
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    Toast.fire({
      icon: "error",
      title: `An unexpected error occurred ${error}`,
    });
  }
});
