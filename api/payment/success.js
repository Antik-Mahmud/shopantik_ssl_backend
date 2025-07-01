export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { tran_id } = req.body;
    const orderId = tran_id.split('_')[1];
    return res.redirect(302, `https://shopantik.com/payment-success?order_id=${orderId}`);
  } catch (error) {
    console.error("Success redirect failed:", error);
    return res.status(500).send("Internal Server Error");
  }
}
