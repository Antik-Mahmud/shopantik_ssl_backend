import { supabase } from './supabaseClient';

export async function sendOrderConfirmation(order) {
  try {
    // Save notification to database
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: order.user_id,
        order_id: order.id,
        type: 'order_confirmation',
        message: `Your order #${order.id} has been confirmed`,
        metadata: {
          status: order.status,
          payment_status: order.payment_status
        }
      });

    if (error) throw error;

    // In production, you would add email sending logic here
    if (process.env.NODE_ENV === 'production') {
      // Implement your email sending logic
      console.log(`Would send email for order ${order.id}`);
    } else {
      console.log('Dev mode - Order confirmation:', order.id);
    }

  } catch (error) {
    console.error('Failed to send order confirmation:', error);
    throw error;
  }
}

export async function updateInventory(items) {
  try {
    const updates = items.map(item => 
      supabase.rpc('decrement_product_stock', {
        product_id: item.product_id,
        amount: item.quantity
      })
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      throw new Error(`Failed to update inventory for ${errors.length} items`);
    }

    console.log(`Inventory updated for ${items.length} items`);
  } catch (error) {
    console.error('Inventory update failed:', error);
    throw error;
  }
}