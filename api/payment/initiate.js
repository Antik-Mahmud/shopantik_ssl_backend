import SSLCommerzPayment from 'sslcommerz-lts';

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;
const is_live = false;
const FrontEndURL = "https://shopantik.com";
const BackEndURL = "https://shopantik-ssl-backend.vercel.app";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { orderData, customer, cartItems } = req.body;
    const tran_id = `ORDER_${orderData.id}_${Date.now()}`;
    const paymentAmount = orderData.has_discounted_price ? orderData.shipping_cost : orderData.total;

    const data = {
      total_amount: paymentAmount,
      currency: 'BDT',
      tran_id,
      success_url: `${BackEndURL}/api/payment/success`,
      fail_url: `${BackEndURL}/api/payment/fail`,
      cancel_url: `${BackEndURL}/api/payment/cancel`,
      ipn_url: `${BackEndURL}/api/payment/ipn`,
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
      value_a: orderData.id
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);

    return res.status(200).json({
      success: true,
      gateway_url: apiResponse.GatewayPageURL,
      tran_id
    });

  } catch (error) {
    console.error("Initiation failed:", error);
    return res.status(500).json({ success: false, message: "Failed to initiate payment", error: error.message });
  }
}
