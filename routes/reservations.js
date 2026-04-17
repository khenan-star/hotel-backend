const express     = require('express');
const { body, validationResult } = require('express-validator');
const Reservation = require('../models/Reservation');
const Room        = require('../models/Room');
const { protect } = require('../middleware/auth');
const {
  sendReservationConfirmation,
  sendCancellationEmail,
  sendAdminNewBookingAlert
} = require('../utils/email');

const router = express.Router();

// ─── Check availability ───────────────────────────────────────────────────────
// GET /api/reservations/availability?roomId=&checkIn=&checkOut=
router.get('/availability', async (req, res) => {
  try {
    const { roomId, checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: 'checkIn and checkOut are required.' });
    }

    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (ci >= co) return res.status(400).json({ success: false, message: 'checkOut must be after checkIn.' });

    // Find conflicting reservations
    const query = {
      status: { $in: ['pending', 'confirmed', 'checked_in'] },
      checkIn:  { $lt: co },
      checkOut: { $gt: ci }
    };
    if (roomId) query['room.roomId'] = roomId;

    const conflicting = await Reservation.find(query).select('room.roomId');
    const bookedRoomIds = conflicting.map(r => r.room.roomId?.toString());

    // Get rooms not in the booked list
    const roomQuery = roomId ? { _id: roomId } : {};
    const rooms = await Room.find({ ...roomQuery, available: true });

    const available = rooms.filter(r => !bookedRoomIds.includes(r._id.toString()));

    res.json({ success: true, available, nights: Math.round((co - ci) / (1000 * 60 * 60 * 24)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Create reservation ───────────────────────────────────────────────────────
router.post('/', [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('email').isEmail(),
  body('checkIn').isISO8601(),
  body('checkOut').isISO8601(),
  body('roomName').trim().notEmpty(),
  body('pricePerNight').isNumeric(),
  body('guests').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const {
      firstName, lastName, email, phone, nationality,
      checkIn, checkOut, guests, specialRequests,
      roomId, roomName, roomType, pricePerNight
    } = req.body;

    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    const nights = Math.round((co - ci) / (1000 * 60 * 60 * 24));

    if (nights <= 0) return res.status(400).json({ success: false, message: 'Invalid dates.' });

    // Check availability if roomId given
    if (roomId) {
      const conflict = await Reservation.findOne({
        'room.roomId': roomId,
        status: { $in: ['pending', 'confirmed', 'checked_in'] },
        checkIn:  { $lt: co },
        checkOut: { $gt: ci }
      });
      if (conflict) return res.status(409).json({ success: false, message: 'Room is not available for the selected dates.' });
    }

    const reservation = await Reservation.create({
      guest: { firstName, lastName, email, phone, nationality },
      room:  { roomId, name: roomName, type: roomType, pricePerNight },
      checkIn: ci,
      checkOut: co,
      nights,
      guests,
      specialRequests
    });

    // Emails — fire and forget
    sendReservationConfirmation(reservation).catch(console.error);
    sendAdminNewBookingAlert(reservation).catch(console.error);

    res.status(201).json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Get reservation by ref (public — for guests without account) ─────────────
router.get('/lookup/:ref', async (req, res) => {
  try {
    const reservation = await Reservation.findOne({ bookingRef: req.params.ref.toUpperCase() });
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found.' });
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Get my reservations (authenticated) ─────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const reservations = await Reservation.find({ 'guest.email': req.user.email })
      .sort({ createdAt: -1 });
    res.json({ success: true, reservations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Get single reservation ───────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Not found.' });

    // Allow owner or admin
    if (reservation.guest.email !== req.user.email && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Cancel reservation ───────────────────────────────────────────────────────
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
