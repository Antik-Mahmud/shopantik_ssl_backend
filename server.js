require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');
const app = express();

// Update these URLs for CPanel deployment
const FrontEndURL = "http://localhost:5173";
const BackEndURL = "https://shopantik-ssl-backend.onrender.com"; // Changed to your new subdomain

const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://shopantik.com", // Your production domain
  "https://www.shopantik.com" // Optional: with www
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SSLCommerz Config
const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;
const is_live = process.env.NODE_ENV === 'production'; // Auto-set based on environment

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'active',
    service: 'ShopAntik Payment Gateway',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Payment Endpoints (Updated for CPanel)
app.post('/payment/success', (req, res) => {
  try {
    const tran_id = req.body.tran_id || req.query.tran_id;
    if (!tran_id) {
      return res.redirect(`http://localhost:5173/payment-error?reason=missing_transaction`);
    }
    const orderId = tran_id.split('_')[1];
    res.redirect(`http://localhost:5173/payment-success?order_id=${orderId}`);
  } catch (error) {
    res.redirect(`http://localhost:5173/payment-error?reason=server_error`);
  }
});

app.post('/payment/fail', (req, res) => {
  try {
    const tran_id = req.body.tran_id || req.query.tran_id;
    if (!tran_id) {
      return res.redirect(`http://localhost:5173/payment-error?reason=missing_transaction`);
    }
    const orderId = tran_id.split('_')[1];
    res.redirect(`http://localhost:5173/payment-failed?order_id=${orderId}`);
  } catch (error) {
    res.redirect(`http://localhost:5173/payment-error?reason=server_error`);
  }
});

app.post('/payment/cancel', (req, res) => {
  try {
    const tran_id = req.body.tran_id || req.query.tran_id;
    if (!tran_id) {
      return res.redirect(`http://localhost:5173/payment-error?reason=missing_transaction`);
    }
    const orderId = tran_id.split('_')[1];
    res.redirect(`http://localhost:5173/payment-cancelled?order_id=${orderId}`);
  } catch (error) {
    res.redirect(`http://localhost:5173/payment-error?reason=server_error`);
  }
});

// Initialize Payment
app.post('/initiate', async (req, res) => {
  try {
    const { orderData, customer, cartItems } = req.body;

    if (!orderData?.id || !customer?.email || !cartItems?.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request data' 
      });
    }

    const tran_id = `ORDER_${orderData.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const paymentAmount = orderData.has_discounted_price ? orderData.shipping_cost : orderData.total;

    const data = {
      total_amount: paymentAmount,
      currency: 'BDT',
      tran_id: tran_id,
      success_url: `https://shopantik-ssl-backend.onrender.com/payment/success`,
      fail_url: `https://shopantik-ssl-backend.onrender.com/payment/fail`,
      cancel_url: `https://shopantik-ssl-backend.onrender.com/payment/cancel`,
      ipn_url: `https://shopantik-ssl-backend.onrender.com/ipn`,
      shipping_method: orderData.shipping_location === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka',
      product_name: cartItems.map(item => item.name).join(', ').substring(0, 255),
      product_category: 'Books',
      product_profile: 'physical-goods',
      cus_name: customer.name.substring(0, 50),
      cus_email: customer.email.substring(0, 50),
      cus_add1: customer.address.substring(0, 50),
      cus_city: customer.city.substring(0, 50),
      cus_postcode: customer.postalCode.substring(0, 50),
      cus_country: 'Bangladesh',
      cus_phone: customer.phone.substring(0, 20),
      ship_name: customer.name.substring(0, 50),
      ship_add1: customer.address.substring(0, 50),
      ship_city: customer.city.substring(0, 50),
      ship_postcode: customer.postalCode.substring(0, 50),
      ship_country: 'Bangladesh',
      value_a: orderData.id,
      value_b: 'online_payment'
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);

    if (!apiResponse.GatewayPageURL) {
      throw new Error('No Gateway URL received from SSLCommerz');
    }

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
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// Add this AFTER all other routes
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Helper functions
async function sendOrderConfirmation(order) {
  // Implement your email sending logic
}

async function updateInventory(items) {
  // Implement inventory reduction logic
}

// Server setup for CPanel
const PORT = process.env.PORT || 3000;
app.listen(PORT, 'localhost', () => {
  console.log(`Payment API running on port ${PORT}`);
});