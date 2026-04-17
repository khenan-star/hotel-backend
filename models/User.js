const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName:  { type: String, required: true, trim: true },
  lastName:   { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, minlength: 6 },
  phone:      { type: String, trim: true },
  nationality:{ type: String, trim: true },
  role:       { type: String, enum: ['guest', 'admin'], default: 'guest' },
  isVerified: { type: Boolean, default: false },
  preferences: {
    roomType:   String,
    floorLevel: String,
    pillowType: String,
    dietary:    String,
    notes:      String
  },
  loyaltyPoints: { type: Number, default: 0 },
  resetPasswordToken:   String,
  resetPasswordExpires: Date
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
