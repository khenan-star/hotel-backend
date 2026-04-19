const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  // Reference number shown to guest
  bookingRef: {
    type: String,
    unique: true,
    default: () => 'AGH-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  },

  // Guest info (stored directly so it persists even if user account deleted)
  guest: {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    firstName:   { type: String, required: true },
    lastName:    { type: String, required: true },
    email:       { type: String, required: true },
    phone:       String,
    nationality: String
  },

  // Room
  room: {
    roomId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    name:      { type: String, required: true },
    type:      String,
    pricePerNight: { type: Number, required: true }
  },

  // Stay
  checkIn:       { type: Date, required: true },
  checkOut:      { type: Date, required: true },
  nights:        { type: Number, required: true },
  guests:        { type: String, required: true },
  specialRequests: String,

  // Pricing
  subtotal:      Number,   // nights × pricePerNight
  taxes:         Number,   // 15% VAT
  totalAmount:   Number,   // subtotal + taxes

  // Payment
  payment: {
    status:          { type: String, enum: ['pending', 'paid', 'refunded', 'failed'], default: 'pending' },
    stripePaymentIntentId: String,
    stripeChargeId:        String,
    method:          String,
    paidAt:          Date
  },

  // Reservation status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
    default: 'pending'
  },

  // Internal notes
  adminNotes: String,
  cancelledAt: Date,
  cancelReason: String

}, { timestamps: true });

// Computed totals before save
reservationSchema.pre('save', function (next) {
  if (this.nights && this.room && this.room.pricePerNight) {
    this.subtotal    = this.nights * this.room.pricePerNight;
    this.taxes       = Math.round(this.subtotal * 0.15);
    this.totalAmount = this.subtotal + this.taxes;
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);