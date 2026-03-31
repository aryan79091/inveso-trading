const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const router  = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, mobile } = req.body;
    if (!email || !password || !fullName)
      return res.status(400).json({ success: false, message: 'Email, password and full name are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const [rows] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(409).json({ success: false, message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password, full_name, mobile) VALUES (?, ?, ?, ?)',
      [email, hashed, fullName, mobile || null]
    );
    res.status(201).json({ success: true, message: 'Account created! Starting balance: Rs.10,00,000', userId: result.insertId });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    const user = rows[0];
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );
    res.json({ success: true, token, user: { userId: user.user_id, email: user.email, fullName: user.full_name, currentBalance: parseFloat(user.current_balance), initialBalance: parseFloat(user.initial_balance) } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT user_id, email, full_name, mobile, current_balance, initial_balance, created_at FROM users WHERE user_id = ?', [req.user.userId]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: rows[0] });
});

module.exports = router;
