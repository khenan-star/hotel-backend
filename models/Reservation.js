const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  bookingRef: {
    type: String,
    unique: true,
    default: () => 'AGH-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  },
  guest: {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    firstName:   { type: String, required: true },
    lastName:    { type: String, required: true },
    email:       { type: String, required: true },
    phone:       String,
    nationality: String
  },
  roomName:      { type: String, required: true },
  roomType:      { type: String },
  roomId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  pricePerNight: { type: Number, required: true },
  checkIn:       { type: Date, required: true },
  checkOut:      { type: Date, required: true },
  nights:        { type: Number, required: true },
  guests:        { type: String, required: true },
  specialRequests: String,
  subtotal:    Number,
  taxes:       Number,
  totalAmount: Number,
  payment: {
    status:                { type: String, enum: ['pending', 'paid', 'refunded', 'failed'], default: 'pending' },
    stripePaymentIntentId: String,
    stripeChargeId:        String,
    method:                String,
    paidAt:                Date
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
    default: 'pending'
  },
  adminNotes:   String,
  cancelledAt:  Date,
  cancelReason: String
}, { timestamps: true });

reservationSchema.pre('save', function (next) {
  if (this.nights && this.pricePerNight) {
    this.subtotal    = this.nights * this.pricePerNight;
    this.taxes       = Math.round(this.subtotal * 0.15);
    this.totalAmount = this.subtotal + this.taxes;
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);