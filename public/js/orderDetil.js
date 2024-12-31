async function cancelOrder(orderId) {
  try {
    const { value: reason } = await Swal.fire({
      title: 'Cancel Order',
      input: 'textarea',
      inputLabel: 'Please provide a reason for cancellation',
      inputPlaceholder: 'Enter your reason here...',
      inputAttributes: {
        'aria-label': 'Cancellation reason'
      },
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || value.trim().length === 0) {
          return 'You need to provide a reason for cancellation!'
        }
      }
    });

    if (reason) {
      const response = await fetch(`/account/order-history/cancel/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Order cancelled successfully',
          timer: 1500,
          showConfirmButton: false
        });
        window.location.reload();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: data.message || 'Failed to cancel order'
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'An error occurred while cancelling the order'
    });
  }
}
function downloadInvoice(orderId) {
  const invoiceUrl = `/account/order/${orderId}/invoice`;
  window.location.href = invoiceUrl;
}

async function returnOrder(orderId) {
  try {
    const { value: reason } = await Swal.fire({
      title: 'Return Order',
      input: 'textarea',
      inputLabel: 'Please provide a reason for return',
      inputPlaceholder: 'Enter your reason here...',
      inputAttributes: {
        'aria-label': 'Return reason'
      },
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || value.trim().length === 0) {
          return 'You need to provide a reason for return!'
        }
      }
    });

    if (reason) {
      const response = await fetch(`/account/order-history/return/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Return request submitted successfully',
          timer: 1500,
          showConfirmButton: false
        });
        window.location.reload();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: data.message || 'Failed to submit return request'
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'An error occurred while submitting return request'
    });
  }
}