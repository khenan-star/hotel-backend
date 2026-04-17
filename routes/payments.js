const express     = require('express');
const stripe      = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Reservation = require('../models/Reservation');
const { sendPaymentReceipt } = require('../utils/email');

const router = express.Router();

// ─── Create Payment Intent ────────────────────────────────────────────────────
// POST /api/payments/create-intent
router.post('/create-intent', async (req, res) => {
  try {
    const { reservationId } = req.body;
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found.' });
    if (reservation.payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Already paid.' });
    }

    // Stripe expects amount in smallest currency unit (halalas = SAR × 100)
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(reservation.totalAmount * 100),
      currency: 'sar',
      metadata: {
        reservationId: reservation._id.toString(),
        bookingRef:    reservation.bookingRef,
        guestEmail:    reservation.guest.email
      },
      receipt_email: reservation.guest.email
    });

    // Store intent ID
    reservation.payment.stripePaymentIntentId = paymentIntent.id;
    await reservation.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
// POST /api/payments/webhook  (raw body, registered in server.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const reservation = await Reservation.findOne({
        'payment.stripePaymentIntentId': pi.id
      });
      if (reservation) {
        reservation.payment.status        = 'paid';
        reservation.payment.stripeChargeId = pi.latest_charge;
        reservation.payment.method        = pi.payment_method_types?.[0] || 'card';
        reservation.payment.paidAt        = new Date();
        reservation.status                = 'confirmed';
        await reservation.save();
        sendPaymentReceipt(reservation).catch(console.error);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const reservation = await Reservation.findOne({
        'payment.stripePaymentIntentId': pi.id
      });
      if (reservation) {
        reservation.payment.status = 'failed';
        await reservation.save();
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const reservation = await Reservation.findOne({
        'payment.stripeChargeId': charge.id
      });
      if (reservation) {
        reservation.payment.status = 'refunded';
        await reservation.save();
      }
      break;
    }
  }

  res.json({ received: true });
});

// ─── Confirm payment manually (fallback for testing) ─────────────────────────
// POST /api/payments/confirm
router.post('/confirm', async (req, res) => {
  try {
    const { reservationId, paymentIntentId } = req.body;
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ success: false, message: 'Not found.' });

    reservation.payment.status  = 'paid';
    reservation.payment.paidAt  = new Date();
    reservation.payment.method  = 'card';
    if (paymentIntentId) reservation.payment.stripePaymentIntentId = paymentIntentId;
    reservation.status = 'confirmed';
    await reservation.save();

    sendPaymentReceipt(reservation).catch(console.error);
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
