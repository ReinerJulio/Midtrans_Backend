const express = require('express');
const cors = require('cors');
const midtransClient = require('midtrans-client');
const crypto = require('crypto');
require('dotenv').config();
console.log('Server key:', process.env.MIDTRANS_SERVER_KEY);


const app = express();
app.use(cors());
app.use(express.json());

// Midtrans Configuration (gunakan variabel .env yang benar)
const snap = new midtransClient.Snap({
    isProduction: true, // Ganti ke true di production
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const coreApi = new midtransClient.CoreApi({
    isProduction: true, // Ganti ke true di production
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Create payment
app.post('/api/create-payment', async (req, res) => {
    try {
        const { order_id, amount, email, package } = req.body;

        if (!order_id) {
            return res.status(400).json({ error: "Missing order_id" });
        }

        const parameter = {
            transaction_details: {
                order_id,
                gross_amount: amount
            },
            customer_details: {
                email,
                first_name: 'User'
            },
            item_details: [{
                id: package.toLowerCase(),
                price: amount,
                quantity: 1,
                name: `${package} Package`
            }],
            enabled_payments: [
                'gopay', 'shopeepay', 'other_qris',
                'bca_va', 'bni_va', 'bri_va',
                'indomaret', 'alfamart',
                'credit_card'
            ]
        };

        const transaction = await snap.createTransaction(parameter);
        res.json({
            token: transaction.token,
            redirect_url: transaction.redirect_url,
            order_id: parameter.transaction_details.order_id
        });
    } catch (error) {
  console.error('❌ Midtrans error:', error?.ApiResponse || error?.response?.data || error.message);
  res.status(500).json({
    error: 'Failed to create payment',
    detail: error?.ApiResponse || error?.response?.data || error.message
  });
}
});

// Check payment status
app.get('/api/payment-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log('🔍 Checking payment status for Order ID:', orderId);

        const statusResponse = await coreApi.transaction.status(orderId);
        console.log('✅ Midtrans response:', statusResponse);

        res.json(statusResponse);
    } catch (error) {
        console.error('❌ Error checking status:');
        if (error.ApiResponse) {
            console.error(error.ApiResponse);
        } else if (error.response) {
            console.error(error.response.data); // Tambahan untuk Axios-style error
        } else {
            console.error(error.message);
        }
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});


// Webhook endpoint (Midtrans Notification URL)
app.post('/api/webhook', (req, res) => {
    try {
        const notification = req.body;

        const signature = crypto
            .createHash('sha512')
            .update(
                notification.order_id +
                notification.status_code +
                notification.gross_amount +
                process.env.MIDTRANS_SERVER_KEY
            )
            .digest('hex');

        if (signature !== notification.signature_key) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        console.log('Webhook received:', notification);

        // TODO: Update database here

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
