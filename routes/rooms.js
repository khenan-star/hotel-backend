const express = require('express');
const Room    = require('../models/Room');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/rooms — list all available rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ available: true });
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms — admin only
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/rooms/:id — admin only
router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/rooms/:id — admin only
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Seed default rooms (run once) — POST /api/rooms/seed
router.post('/seed', protect, adminOnly, async (req, res) => {
  try {
    await Room.deleteMany({});
    const rooms = await Room.insertMany([
      {
        name: 'Classic Room', type: 'classic',
        description: 'Refined elegance with a plush king bed, Italian marble bathroom, and sweeping city panoramas.',
        size: '32 m²', view: 'City View', pricePerNight: 1200, maxGuests: 2, totalRooms: 40,
        features: ['King Bed', 'City View', '42" Smart TV', 'Marble Bath', 'Minibar', 'Wi-Fi', 'Room Service', 'Turndown'],
        images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80']
      },
      {
        name: 'Deluxe Suite', type: 'deluxe',
        description: 'A private living room, freestanding soaking tub, curated minibar, and skyline panoramas.',
        size: '58 m²', view: 'Skyline View', pricePerNight: 2400, maxGuests: 2, totalRooms: 20,
        features: ['King Bed', 'Skyline View', 'Separate Living Room', 'Soaking Tub', 'Rainfall Shower', 'Minibar', 'Butler Service', 'Wi-Fi'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900&q=80']
      },
      {
        name: 'Executive Suite', type: 'executive',
        description: 'Floor-to-ceiling panoramic glass, a private dining area, home theatre, and dedicated butler.',
        size: '85 m²', view: 'Panoramic View', pricePerNight: 4200, maxGuests: 3, totalRooms: 10,
        features: ['King Bed', '360° Panoramic View', 'Private Dining', 'Home Theatre', 'Butler Service', 'Jacuzzi', 'Walk-in Wardrobe', 'Wi-Fi'],
        images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=900&q=80']
      },
      {
        name: 'Presidential Suite', type: 'presidential',
        description: 'The pinnacle of luxury — a two-floor private residence with panoramic views, grand piano, and 24-hour personal butler.',
        size: '240 m²', view: '360° City Panorama', pricePerNight: 9500, maxGuests: 4, totalRooms: 2,
        features: ['Master Bedroom', 'Guest Room', 'Grand Piano', 'Private Gym', 'Chef Kitchen', 'Personal Butler', 'Helipad Access', 'Rolls-Royce Transfer'],
        images: ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900&q=80']
      }
    ]);
    res.json({ success: true, message: `${rooms.length} rooms seeded.`, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
