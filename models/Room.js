const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name:        { type: String, required: true },         // e.g. "Deluxe Suite"
  type:        { type: String, required: true },         // e.g. "deluxe"
  description: { type: String, required: true },
  size:        { type: String },                         // e.g. "58 m²"
  view:        { type: String },                         // e.g. "Skyline View"
  pricePerNight: { type: Number, required: true },       // SAR
  maxGuests:   { type: Number, default: 2 },
  features:    [String],                                 // ["King Bed", "Soaking Tub", ...]
  images:      [String],                                 // URLs
  available:   { type: Boolean, default: true },
  totalRooms:  { type: Number, default: 1 },             // how many of this type exist
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
