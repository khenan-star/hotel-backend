const express     = require('express');
const { body, validationResult } = require('express-validator');
const Reservation = require('../models/Reservation');
const { protect } = require('../middleware/auth');
const {
  sendReservationConfirmation,
  sendCancellationEmail,
  sendAdminNewBookingAlert
} = require('../utils/email');

const router = express.Router();

// ─── GET /api/reservations/availability ───────────────────────────────────────
router.get('/availability', async (req, res) => {
  try {
    const { roomName, checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: 'checkIn and checkOut are required.' });
    }
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (ci >= co) return res.status(400).json({ success: false, message: 'checkOut must be after checkIn.' });

    const query = {
      status: { $in: ['pending', 'confirmed', 'checked_in'] },
      checkIn:  { $lt: co },
      checkOut: { $gt: ci }
    };
    if (roomName) query.roomName = roomName;

    const conflicting = await Reservation.find(query).select('roomName');
    const nights = Math.round((co - ci) / (1000 * 60 * 60 * 24));
    res.json({ success: true, conflicting, nights });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/reservations ───────────────────────────────────────────────────
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('First name required'),
  body('lastName').trim().notEmpty().withMessage('Last name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date required'),
  body('roomName').trim().notEmpty().withMessage('Room name required'),
  body('pricePerNight').isNumeric().withMessage('Price required'),
  body('guests').trim().notEmpty().withMessage('Guests required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const {
      firstName, lastName, email, phone, nationality,
      checkIn, checkOut, guests, specialRequests,
      roomId, roomName, roomType, pricePerNight
    } = req.body;

    const ci     = new Date(checkIn);
    const co     = new Date(checkOut);
    const nights = Math.round((co - ci) / (1000 * 60 * 60 * 24));

    if (nights <= 0) return res.status(400).json({ success: false, message: 'Check-out must be after check-in.' });

    const reservation = await Reservation.create({
      guest: { firstName, lastName, email, phone, nationality },
      roomName, roomType, roomId,
      pricePerNight: Number(pricePerNight),
      checkIn: ci, checkOut: co,
      nights, guests, specialRequests
    });

    sendReservationConfirmation(reservation).catch(console.error);
    sendAdminNewBookingAlert(reservation).catch(console.error);

    res.status(201).json({ success: true, reservation });
  } catch (err) {
    console.error('Reservation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/reservations/lookup/:ref ───────────────────────────────────────
router.get('/lookup/:ref', async (req, res) => {
  try {
    const reservation = await Reservation.findOne({ bookingRef: req.params.ref.toUpperCase() });
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found.' });
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/reservations/my ─────────────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const reservations = await Reservation.find({ 'guest.email': req.user.email }).sort({ createdAt: -1 });
    res.json({ success: true, reservations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/reservations/:id ────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Not found.' });
    if (reservation.guest.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/reservations/:id/cancel ──────────────────────────────────────
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Not found.' });
    if (reservation.guest.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    if (['cancelled', 'checked_out'].includes(reservation.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this reservation.' });
    }
    reservation.status       = 'cancelled';
    reservation.cancelledAt  = new Date();
    reservation.cancelReason = req.body.reason || 'Guest request';
    await reservation.save();
    sendCancellationEmail(reservation).catch(console.error);
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;