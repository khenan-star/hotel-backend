const express     = require('express');
const Reservation = require('../models/Reservation');
const User        = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalReservations,
      pendingReservations,
      confirmedReservations,
      cancelledReservations,
      checkedIn,
      totalUsers,
      revenueAgg,
      recentReservations
    ] = await Promise.all([
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: 'pending' }),
      Reservation.countDocuments({ status: 'confirmed' }),
      Reservation.countDocuments({ status: 'cancelled' }),
      Reservation.countDocuments({ status: 'checked_in' }),
      User.countDocuments({ role: 'guest' }),
      Reservation.aggregate([
        { $match: { 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Reservation.find({ status: { $in: ['pending', 'confirmed'] } })
        .sort({ createdAt: -1 }).limit(10)
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    // Revenue by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRevenue = await Reservation.aggregate([
      { $match: { 'payment.status': 'paid', createdAt: { $gte: sixMonthsAgo } } },
      { $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Room popularity
    const roomStats = await Reservation.aggregate([
      { $group: { _id: '$room.name', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalReservations, pendingReservations, confirmedReservations,
        cancelledReservations, checkedIn, totalUsers, totalRevenue,
        monthlyRevenue, roomStats, recentReservations
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Get all reservations ─────────────────────────────────────────────────────
router.get('/reservations', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { bookingRef: new RegExp(search, 'i') },
        { 'guest.email': new RegExp(search, 'i') },
        { 'guest.firstName': new RegExp(search, 'i') },
        { 'guest.lastName': new RegExp(search, 'i') }
      ];
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Reservation.countDocuments(query)
    ]);

    res.json({ success: true, reservations, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Update reservation status ────────────────────────────────────────────────
router.patch('/reservations/:id/status', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const allowed = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const updates = { status };
    if (adminNotes) updates.adminNotes = adminNotes;
    const reservation = await Reservation.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Get all users ────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'guest' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Promote user to admin ────────────────────────────────────────────────────
router.patch('/users/:id/role', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
