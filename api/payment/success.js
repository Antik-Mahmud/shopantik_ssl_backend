import { setCorsHeaders, handleOptionsRequest } from '../../lib/cors';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest(res);
  }
  
  setCorsHeaders(res);

  try {
    let tran_id;
    
    if (req.method === 'POST') {
      tran_id = req.body.tran_id;
    } else if (req.method === 'GET') {
      tran_id = req.query.tran_id;
    } else {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    if (!tran_id) {
      return res.status(400).redirect(`${process.env.FRONTEND_URL}/payment-error?reason=invalid_transaction`);
    }

    const orderId = tran_id.split('_')[1];
    return res.redirect(302, `${process.env.FRONTEND_URL}/payment-success?order_id=${orderId}`);

  } catch (error) {
    console.error("Success redirect failed:", error);
    return res.redirect(302, `${process.env.FRONTEND_URL}/payment-error?reason=server_error`);
  }
}