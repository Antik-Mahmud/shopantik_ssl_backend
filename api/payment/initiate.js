import SSLCommerzPayment from 'sslcommerz-lts';
import { setCorsHeaders, handleOptionsRequest } from '../../lib/cors';

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;
const is_live = process.env.SSLC_IS_LIVE === 'true';
const frontendUrl = process.env.FRONTEND_URL || "https://shopantik.com";
const backendUrl = process.env.BACKEND_URL || "https://shopantik-ssl-backend.vercel.app";

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(res);
  }
  
  setCorsHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { orderData, customer, cartItems } = req.body;
    
    if (!orderData?.id || !customer?.email || !cartItems?.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request data' 
      });
    }

    const tran_id = `ORDER_${orderData.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const paymentAmount = orderData.has_discounted_price 
      ? orderData.shipping_cost 
      : orderData.total;

    const data = {
      total_amount: paymentAmount,
      currency: 'BDT',
      tran_id,
      success_url: `${backendUrl}/api/payment/success`,
      fail_url: `${backendUrl}/api/payment/fail`,
      cancel_url: `${backendUrl}/api/payment/cancel`,
      ipn_url: `${backendUrl}/api/payment/ipn`,
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

    return res.status(200).json({
      success: true,
      gateway_url: apiResponse.GatewayPageURL,
      tran_id
    });

  } catch (error) {
    console.error("Payment initiation failed:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Payment initiation failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}