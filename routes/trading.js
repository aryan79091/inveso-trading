const express = require('express');
const { pool } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ── Equity ───────────────────────────────────────────────────────────────────

router.get('/balance', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT current_balance, initial_balance FROM users WHERE user_id = ?', [req.user.userId]);
  res.json({ success: true, data: rows[0] });
});

router.get('/portfolio', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM portfolio WHERE user_id = ? ORDER BY updated_at DESC', [req.user.userId]);
  res.json({ success: true, data: rows });
});

router.get('/orders', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [req.user.userId]);
  res.json({ success: true, data: rows });
});

router.post('/order', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { symbol, companyName, transactionType, orderType, quantity, price, productType } = req.body;
    if (!symbol || !transactionType || !quantity || !price)
      return res.status(400).json({ success: false, message: 'Missing required fields' });

    const qty = parseInt(quantity), px = parseFloat(price), total = qty * px;
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT current_balance FROM users WHERE user_id = ? FOR UPDATE', [req.user.userId]);

    if (transactionType === 'BUY') {
      if (parseFloat(user.current_balance) < total) throw new Error('Insufficient balance');

      await conn.query('UPDATE users SET current_balance = current_balance - ? WHERE user_id = ?', [total, req.user.userId]);

      const [[existing]] = await conn.query('SELECT * FROM portfolio WHERE user_id = ? AND symbol = ?', [req.user.userId, symbol]);
      if (existing) {
        const newQty = existing.quantity + qty;
        const newAvg = (existing.quantity * existing.avg_price + total) / newQty;
        await conn.query('UPDATE portfolio SET quantity=?, avg_price=? WHERE portfolio_id=?', [newQty, newAvg, existing.portfolio_id]);
      } else {
        await conn.query('INSERT INTO portfolio (user_id, symbol, company_name, quantity, avg_price) VALUES (?,?,?,?,?)',
          [req.user.userId, symbol, companyName||symbol, qty, px]);
      }
    } else {
      const [[holding]] = await conn.query('SELECT * FROM portfolio WHERE user_id = ? AND symbol = ? FOR UPDATE', [req.user.userId, symbol]);
      if (!holding || holding.quantity < qty) throw new Error('Insufficient holdings to sell');

      await conn.query('UPDATE users SET current_balance = current_balance + ? WHERE user_id = ?', [total, req.user.userId]);

      const newQty = holding.quantity - qty;
      if (newQty === 0) {
        await conn.query('DELETE FROM portfolio WHERE portfolio_id = ?', [holding.portfolio_id]);
      } else {
        await conn.query('UPDATE portfolio SET quantity = ? WHERE portfolio_id = ?', [newQty, holding.portfolio_id]);
      }
    }

    const [result] = await conn.query(
      'INSERT INTO orders (user_id, symbol, company_name, transaction_type, order_type, quantity, price, total_value, product_type) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.userId, symbol, companyName||symbol, transactionType, orderType||'MARKET', qty, px, total, productType||'CNC']
    );

    await conn.commit();
    res.json({ success: true, message: `${transactionType} order executed`, orderId: result.insertId, totalValue: total });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message || 'Order failed' });
  } finally {
    conn.release();
  }
});

// ── Options ──────────────────────────────────────────────────────────────────

router.get('/options/portfolio', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM options_portfolio WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);
  res.json({ success: true, data: rows });
});

router.get('/options/orders', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM options_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [req.user.userId]);
  res.json({ success: true, data: rows });
});

router.post('/options/order', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { symbol, optionType, strikePrice, expiryDate, lotSize, transactionType, quantity, price } = req.body;
    if (!symbol || !optionType || !strikePrice || !expiryDate || !transactionType || !quantity || !price)
      return res.status(400).json({ success: false, message: 'Missing required fields' });

    const lots = parseInt(quantity), px = parseFloat(price), ls = parseInt(lotSize)||1, total = lots*ls*px;
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT current_balance FROM users WHERE user_id = ? FOR UPDATE', [req.user.userId]);

    if (transactionType === 'BUY') {
      if (parseFloat(user.current_balance) < total) throw new Error('Insufficient balance');
      await conn.query('UPDATE users SET current_balance = current_balance - ? WHERE user_id = ?', [total, req.user.userId]);
      await conn.query('INSERT INTO options_portfolio (user_id, symbol, option_type, strike_price, expiry_date, lot_size, quantity, avg_price) VALUES (?,?,?,?,?,?,?,?)',
        [req.user.userId, symbol, optionType, strikePrice, expiryDate, ls, lots, px]);
    } else {
      const [[holding]] = await conn.query(
        'SELECT * FROM options_portfolio WHERE user_id=? AND symbol=? AND option_type=? AND strike_price=? AND expiry_date=? FOR UPDATE',
        [req.user.userId, symbol, optionType, strikePrice, expiryDate]);
      if (!holding || holding.quantity < lots) throw new Error('Insufficient options holdings');
      await conn.query('UPDATE users SET current_balance = current_balance + ? WHERE user_id = ?', [total, req.user.userId]);
      const newQty = holding.quantity - lots;
      if (newQty === 0) {
        await conn.query('DELETE FROM options_portfolio WHERE id = ?', [holding.id]);
      } else {
        await conn.query('UPDATE options_portfolio SET quantity = ? WHERE id = ?', [newQty, holding.id]);
      }
    }

    const [result] = await conn.query(
      'INSERT INTO options_orders (user_id, symbol, option_type, strike_price, expiry_date, lot_size, transaction_type, quantity, price, total_value) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.user.userId, symbol, optionType, strikePrice, expiryDate, ls, transactionType, lots, px, total]);

    await conn.commit();
    res.json({ success: true, message: 'Options order executed', orderId: result.insertId, totalValue: total });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message || 'Options order failed' });
  } finally {
    conn.release();
  }
});

module.exports = router;
