const express = require("express");
const router = express.Router();

const db = require("../config/db.js");

// Send OTP
router.post("/send-otp", (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone number required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);

  const sql = `
    INSERT INTO users (phone, otp)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE otp = ?
  `;

  db.query(sql, [phone, otp, otp], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Error generating OTP" });
    }

    console.log("Generated OTP:", otp);
    res.json({ message: "OTP sent successfully", otp });
  });
});

// Verify OTP
router.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: "Phone and OTP required" });
  }

  const sql = "SELECT * FROM users WHERE phone = ? AND otp = ?";

  db.query(sql, [phone, otp], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Error verifying OTP" });
    }

    if (result.length === 0) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    res.json({ message: "Login successful", user: result[0] });
  });
});

module.exports = router;