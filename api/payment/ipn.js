import SSLCommerzPayment from 'sslcommerz-lts';
import { supabase } from '../../lib/supabaseClient';
import { sendOrderConfirmation, updateInventory } from '../../lib/helpers';

const store_id = process.env.SSLC_STORE_ID;
const store_passwd = process.env.SSLC_STORE_PASSWORD;
const is_live = false;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { val_id, tran_id, status, value_a: orderId } = req.body;

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const validationData = await sslcz.validate({ val_id });

    let orderUpdate = {
      payment_data: validationData,
      sslcommerz_tran_id: tran_id,
      updated_at: new Date().toISOString()
    };

    switch (status) {
      case 'VALID':
      case 'VALIDATED':
        orderUpdate.status = validationData.value_b === 'cod_partial' ? 'processing' : 'paid';
        orderUpdate.payment_status = validationData.value_b === 'cod_partial' ? 'delivery_paid' : 'paid';
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

    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    if (orderUpdate.status === 'paid' || orderUpdate.status === 'processing') {
      await sendOrderConfirmation(updatedOrder);
      await updateInventory(updatedOrder.items);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("IPN processing failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
