require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');
const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Add this for form data handling

// SSLCommerz Config
const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;
const is_live = false; // true for live, false for sandbox

app.get('/', (req, res) => {
  res.send('Welcome to ShopAntik SSLCommerz Payment Integration');
});

// Payment Redirection Endpoints (NEW)
app.post('/payment/success', (req, res) => {
  const tran_id = req.body.tran_id;
  const orderId = tran_id.split('_')[1]; // Extract from "ORDER_123_..."
  res.redirect(`${process.env.FRONTEND_URL}/payment-success?order_id=${orderId}`);
});

app.post('/payment/fail', (req, res) => {
  const orderId = req.body.tran_id.split('_')[1];
  res.redirect(`${process.env.FRONTEND_URL}/payment-failed?order_id=${orderId}`);
});

app.post('/payment/cancel', (req, res) => {
  const orderId = req.body.tran_id.split('_')[1];
  res.redirect(`${process.env.FRONTEND_URL}/payment-cancelled?order_id=${orderId}`);
});

// Initialize Payment (UPDATED)
app.post('/api/payment/initiate', async (req, res) => {
    try {
        const { orderData, customer, cartItems } = req.body;

        // Create transaction ID
        const tran_id = `ORDER_${orderData.id}_${Date.now()}`;

        const paymentAmount = orderData.has_discounted_price ? orderData.shipping_cost : orderData.total;

        const data = {
            total_amount: paymentAmount,
            currency: 'BDT',
            tran_id: tran_id,
            // Updated to point to our server endpoints instead of frontend directly
            success_url: `${process.env.BACKEND_URL}/payment/success`,
            fail_url: `${process.env.BACKEND_URL}/payment/fail`,
            cancel_url: `${process.env.BACKEND_URL}/payment/cancel`,
            ipn_url: `${process.env.BACKEND_URL}/api/payment/ipn`,
            shipping_method: orderData.shipping_location === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka',
            product_name: cartItems.map(item => item.name).join(', '),
            product_category: 'Books',
            product_profile: 'physical-goods',
            cus_name: customer.name,
            cus_email: customer.email,
            cus_add1: customer.address,
            cus_city: customer.city,
            cus_postcode: customer.postalCode,
            cus_country: 'Bangladesh',
            cus_phone: customer.phone,
            ship_name: customer.name,
            ship_add1: customer.address,
            ship_city: customer.city,
            ship_postcode: customer.postalCode,
            ship_country: 'Bangladesh',
            value_a: orderData.id // Store order ID for validation
        };

        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(data);

        // Return the Gateway URL to frontend
        res.json({
            success: true,
            gateway_url: apiResponse.GatewayPageURL,
            tran_id: tran_id
        });

    } catch (error) {
        console.error('Payment initiation failed:', error);
        res.status(500).json({
            success: false,
            message: 'Payment initiation failed',
            error: error.message
        });
    }
});

// IPN Handler (server.js)
app.post('/api/payment/ipn', async (req, res) => {
  try {
    const { val_id, tran_id, status, value_a: orderId } = req.body;
    
    // 1. Validate the payment with SSLCommerz
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const validationData = await sslcz.validate({ val_id });

    // 2. Determine order status based on validation
    let orderUpdate = {
      payment_data: validationData,
      sslcommerz_tran_id: tran_id,
      updated_at: new Date().toISOString()
    };

    switch(status) {
      case 'VALID':
      case 'VALIDATED':
        orderUpdate.status = validationData.value_b === 'cod_partial' 
          ? 'processing' 
          : 'paid';
        orderUpdate.payment_status = validationData.value_b === 'cod_partial'
          ? 'delivery_paid'
          : 'paid';
        break;
        
      case 'FAILED':
        orderUpdate.status = 'failed';
        orderUpdate.payment_status = 'failed';
        break;
        
      case 'CANCELLED':
        orderUpdate.status = 'cancelled';
        orderUpdate.payment_status = 'cancelled';
        break;
        
      default:
        orderUpdate.status = 'pending';
        orderUpdate.payment_status = 'pending';
    }

    // 3. Update order in database
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // 4. Optional: Trigger other actions (email, inventory, etc.)
    if (orderUpdate.status === 'paid' || orderUpdate.status === 'processing') {
      await sendOrderConfirmation(updatedOrder);
      await updateInventory(updatedOrder.items);
    }

    // 5. Respond to SSLCommerz
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('IPN processing failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Helper functions
async function sendOrderConfirmation(order) {
  // Implement your email sending logic
}

async function updateInventory(items) {
  // Implement inventory reduction logic
}

// Start server
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});