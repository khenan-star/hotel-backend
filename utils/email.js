const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── Base HTML wrapper ────────────────────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Georgia, serif; background: #FAF7F2; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #1A1714; padding: 32px 40px; text-align: center; border-bottom: 2px solid #C9A84C; }
    .header h1 { color: #E8D5A3; font-size: 26px; font-weight: 300; margin: 0; letter-spacing: 2px; }
    .header p { color: rgba(255,255,255,0.4); font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin: 6px 0 0; font-family: sans-serif; }
    .body { padding: 40px; color: #2C2820; line-height: 1.8; }
    .gold-line { width: 40px; height: 1px; background: #C9A84C; margin: 20px 0; }
    .ref-box { background: #1A1714; color: #E8D5A3; text-align: center; padding: 16px; font-size: 22px; letter-spacing: 4px; margin: 24px 0; font-family: Georgia; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-family: sans-serif; font-size: 14px; }
    .detail-table td { padding: 10px 0; border-bottom: 1px solid #f0ece4; color: #555; }
    .detail-table td:first-child { color: #C9A84C; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; width: 40%; }
    .total-row td { border-top: 2px solid #C9A84C !important; border-bottom: none !important; font-weight: bold; color: #1A1714 !important; font-size: 16px; padding-top: 16px !important; }
    .btn { display: inline-block; background: #C9A84C; color: #1A1714; padding: 12px 32px; text-decoration: none; font-family: sans-serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 16px; }
    .footer { background: #1A1714; padding: 24px 40px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.3); font-size: 11px; font-family: sans-serif; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Aura Grand Hotel</h1>
      <p>Where Luxury Meets Eternity</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>King Fahd Road, Olaya District, Riyadh 12271, KSA</p>
      <p>+966 11 250 0000 · reservations@auragrand.com</p>
      <p style="margin-top:12px">© ${new Date().getFullYear()} Aura Grand Hotel. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate  = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMoney = (n) => 'SAR ' + Number(n).toLocaleString();

// ─── Email: Reservation Confirmation ─────────────────────────────────────────
exports.sendReservationConfirmation = async (reservation) => {
  const { guest, room, checkIn, checkOut, nights, guests, bookingRef, subtotal, taxes, totalAmount } = reservation;

  const html = baseTemplate(`
    <p style="font-size:18px; color:#1A1714;">Dear ${guest.firstName},</p>
    <div class="gold-line"></div>
    <p>Your reservation at <strong>Aura Grand Hotel</strong> has been confirmed. We look forward to welcoming you.</p>

    <div class="ref-box">${bookingRef}</div>

    <table class="detail-table">
      <tr><td>Room</td><td>${room.name}</td></tr>
      <tr><td>Check-In</td><td>${fmtDate(checkIn)}</td></tr>
      <tr><td>Check-Out</td><td>${fmtDate(checkOut)}</td></tr>
      <tr><td>Duration</td><td>${nights} night${nights > 1 ? 's' : ''}</td></tr>
      <tr><td>Guests</td><td>${guests}</td></tr>
      <tr><td>Room Rate</td><td>${fmtMoney(room.pricePerNight)} / night</td></tr>
      <tr><td>Subtotal</td><td>${fmtMoney(subtotal)}</td></tr>
      <tr><td>VAT (15%)</td><td>${fmtMoney(taxes)}</td></tr>
      <tr class="total-row"><td>Total</td><td>${fmtMoney(totalAmount)}</td></tr>
    </table>

    <p style="font-size:13px; color:#888; font-family:sans-serif;">Our guest relations team will reach out within 2 hours to confirm any special requests. For immediate assistance, please contact us at <strong>+966 11 250 0000</strong>.</p>
  `);

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      guest.email,
    subject: `Reservation Confirmed — ${bookingRef} | Aura Grand Hotel`,
    html
  });
};

// ─── Email: Payment Receipt ───────────────────────────────────────────────────
exports.sendPaymentReceipt = async (reservation) => {
  const { guest, room, bookingRef, totalAmount, payment } = reservation;

  const html = baseTemplate(`
    <p style="font-size:18px; color:#1A1714;">Dear ${guest.firstName},</p>
    <div class="gold-line"></div>
    <p>Payment for your reservation has been successfully processed.</p>

    <div class="ref-box">${bookingRef}</div>

    <table class="detail-table">
      <tr><td>Room</td><td>${room.name}</td></tr>
      <tr><td>Amount Paid</td><td>${fmtMoney(totalAmount)}</td></tr>
      <tr><td>Payment Method</td><td>${payment.method || 'Card'}</td></tr>
      <tr><td>Paid On</td><td>${fmtDate(payment.paidAt || new Date())}</td></tr>
    </table>

    <p style="font-size:13px;color:#888;font-family:sans-serif;">Please keep your booking reference for check-in. We look forward to seeing you soon.</p>
  `);

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      guest.email,
    subject: `Payment Receipt — ${bookingRef} | Aura Grand Hotel`,
    html
  });
};

// ─── Email: Cancellation ──────────────────────────────────────────────────────
exports.sendCancellationEmail = async (reservation) => {
  const { guest, room, bookingRef, checkIn, checkOut, cancelReason } = reservation;

  const html = baseTemplate(`
    <p style="font-size:18px; color:#1A1714;">Dear ${guest.firstName},</p>
    <div class="gold-line"></div>
    <p>Your reservation has been cancelled as requested.</p>

    <div class="ref-box" style="background:#3D3830;">${bookingRef}</div>

    <table class="detail-table">
      <tr><td>Room</td><td>${room.name}</td></tr>
      <tr><td>Original Check-In</td><td>${fmtDate(checkIn)}</td></tr>
      <tr><td>Original Check-Out</td><td>${fmtDate(checkOut)}</td></tr>
      ${cancelReason ? `<tr><td>Reason</td><td>${cancelReason}</td></tr>` : ''}
    </table>

    <p>We hope to welcome you to Aura Grand Hotel in the future. To make a new reservation, visit our website or contact us directly.</p>
  `);

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      guest.email,
    subject: `Reservation Cancelled — ${bookingRef} | Aura Grand Hotel`,
    html
  });
};

// ─── Email: Welcome (after registration) ─────────────────────────────────────
exports.sendWelcomeEmail = async (user) => {
  const html = baseTemplate(`
    <p style="font-size:18px; color:#1A1714;">Welcome, ${user.firstName}.</p>
    <div class="gold-line"></div>
    <p>Your Aura Grand Hotel account has been created. You are now part of an exclusive community of discerning travelers who have discovered the very finest in luxury hospitality.</p>
    <p>With your account you can:</p>
    <ul style="font-family:sans-serif;font-size:14px;color:#555;line-height:2.2;">
      <li>Manage and view all your reservations</li>
      <li>Save your room preferences for future stays</li>
      <li>Earn and redeem loyalty points</li>
      <li>Access exclusive member rates</li>
    </ul>
    <br>
    <a href="${process.env.FRONTEND_URL}" class="btn">Explore & Book</a>
  `);

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      user.email,
    subject: 'Welcome to Aura Grand Hotel',
    html
  });
};

// ─── Email: Admin new booking alert ──────────────────────────────────────────
exports.sendAdminNewBookingAlert = async (reservation) => {
  if (!process.env.EMAIL_USER) return;
  const { guest, room, checkIn, checkOut, nights, totalAmount, bookingRef } = reservation;

  const html = baseTemplate(`
    <p><strong>New Reservation Received</strong></p>
    <div class="gold-line"></div>
    <table class="detail-table">
      <tr><td>Ref</td><td>${bookingRef}</td></tr>
      <tr><td>Guest</td><td>${guest.firstName} ${guest.lastName} (${guest.email})</td></tr>
      <tr><td>Room</td><td>${room.name}</td></tr>
      <tr><td>Check-In</td><td>${fmtDate(checkIn)}</td></tr>
      <tr><td>Check-Out</td><td>${fmtDate(checkOut)}</td></tr>
      <tr><td>Nights</td><td>${nights}</td></tr>
      <tr class="total-row"><td>Total</td><td>${fmtMoney(totalAmount)}</td></tr>
    </table>
  `);

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_USER,
    subject: `[NEW BOOKING] ${bookingRef} — ${guest.firstName} ${guest.lastName}`,
    html
  });
};
