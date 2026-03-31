/**
 * INVESO ANALYTICS API
 * Demonstrates SQL skills relevant to data analyst roles:
 *  - Window functions  (SUM OVER, ROW_NUMBER)
 *  - CTEs             (WITH clause)
 *  - Subqueries
 *  - Date functions   (DATE_FORMAT, DATEDIFF)
 *  - Aggregations     (GROUP BY, HAVING)
 *  - JOINs
 */

const express = require('express');
const { pool } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// ── 1. Cumulative P&L Over Time (Window Function) ────────────────────────────
// Shows running total of realised profit/loss per trading day.
router.get('/pnl-timeline', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        trade_date,
        daily_pnl,
        SUM(daily_pnl) OVER (ORDER BY trade_date
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
          AS cumulative_pnl
      FROM (
        SELECT
          DATE(created_at)  AS trade_date,
          SUM(
            CASE transaction_type
              WHEN 'SELL' THEN  total_value
              WHEN 'BUY'  THEN -total_value
            END
          ) AS daily_pnl
        FROM orders
        WHERE user_id = ?
        GROUP BY DATE(created_at)
      ) AS daily_summary
      ORDER BY trade_date
    `, [req.user.userId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('pnl-timeline error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 2. Top Traded Stocks (GROUP BY + aggregation) ───────────────────────────
router.get('/top-stocks', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        symbol,
        MAX(company_name)                                                  AS company_name,
        COUNT(*)                                                           AS trade_count,
        SUM(quantity)                                                      AS total_shares,
        ROUND(SUM(total_value), 2)                                         AS total_value,
        ROUND(SUM(CASE WHEN transaction_type='BUY'  THEN total_value ELSE 0 END), 2) AS buy_value,
        ROUND(SUM(CASE WHEN transaction_type='SELL' THEN total_value ELSE 0 END), 2) AS sell_value,
        COUNT(DISTINCT DATE(created_at))                                   AS active_days
      FROM orders
      WHERE user_id = ?
      GROUP BY symbol
      ORDER BY trade_count DESC
      LIMIT 10
    `, [req.user.userId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 3. Win / Loss Rate Per Stock (CTE) ──────────────────────────────────────
// Compares average buy price vs average sell price for each fully-traded stock.
router.get('/win-rate', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      WITH buys AS (
        SELECT
          symbol,
          SUM(quantity * price) / SUM(quantity) AS avg_buy_price,
          SUM(quantity)                          AS buy_qty
        FROM orders
        WHERE user_id = ? AND transaction_type = 'BUY'
        GROUP BY symbol
      ),
      sells AS (
        SELECT
          symbol,
          SUM(quantity * price) / SUM(quantity) AS avg_sell_price,
          SUM(quantity)                          AS sell_qty
        FROM orders
        WHERE user_id = ? AND transaction_type = 'SELL'
        GROUP BY symbol
      )
      SELECT
        b.symbol,
        ROUND(b.avg_buy_price,  2) AS avg_buy_price,
        ROUND(s.avg_sell_price, 2) AS avg_sell_price,
        ROUND(((s.avg_sell_price - b.avg_buy_price) / b.avg_buy_price) * 100, 2) AS return_pct,
        ROUND((s.avg_sell_price - b.avg_buy_price) * s.sell_qty, 2)               AS realised_pnl,
        IF(s.avg_sell_price > b.avg_buy_price, 'WIN', 'LOSS')                     AS result
      FROM buys b
      INNER JOIN sells s ON b.symbol = s.symbol
      ORDER BY realised_pnl DESC
    `, [req.user.userId, req.user.userId]);

    const wins   = rows.filter(r => r.result === 'WIN').length;
    const losses = rows.filter(r => r.result === 'LOSS').length;

    res.json({
      success: true,
      data: {
        trades: rows,
        summary: {
          total:    rows.length,
          wins,
          losses,
          winRate:  rows.length ? +((wins / rows.length) * 100).toFixed(1) : 0,
          totalPnl: rows.reduce((s, r) => s + parseFloat(r.realised_pnl || 0), 0).toFixed(2)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 4. Monthly Trading Volume (DATE_FORMAT + GROUP BY) ───────────────────────
router.get('/monthly-volume', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m')              AS month,
        COUNT(*)                                      AS order_count,
        ROUND(SUM(total_value), 2)                    AS total_volume,
        ROUND(SUM(CASE WHEN transaction_type='BUY'  THEN total_value ELSE 0 END), 2) AS buy_volume,
        ROUND(SUM(CASE WHEN transaction_type='SELL' THEN total_value ELSE 0 END), 2) AS sell_volume,
        COUNT(DISTINCT symbol)                        AS unique_stocks
      FROM orders
      WHERE user_id = ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
      LIMIT 12
    `, [req.user.userId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 5. Portfolio Summary (Subquery + calculated fields) ──────────────────────
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT current_balance, initial_balance FROM users WHERE user_id = ?',
      [req.user.userId]
    );

    const [[equity]] = await pool.query(`
      SELECT
        COUNT(*)                       AS holding_count,
        ROUND(SUM(quantity*avg_price),2) AS invested_value
      FROM portfolio
      WHERE user_id = ?
    `, [req.user.userId]);

    const [[opts]] = await pool.query(`
      SELECT
        COUNT(*)                             AS options_count,
        ROUND(SUM(quantity*lot_size*avg_price),2) AS options_invested
      FROM options_portfolio
      WHERE user_id = ?
    `, [req.user.userId]);

    const [[activity]] = await pool.query(`
      SELECT
        COUNT(*)                               AS total_orders,
        COUNT(DISTINCT symbol)                 AS unique_stocks_traded,
        MIN(created_at)                        AS first_trade,
        MAX(created_at)                        AS last_trade,
        DATEDIFF(MAX(created_at), MIN(created_at)) AS trading_days_span
      FROM orders
      WHERE user_id = ?
    `, [req.user.userId]);

    const balance = parseFloat(user.current_balance);
    const initial = parseFloat(user.initial_balance);
    const invested = parseFloat(equity.invested_value || 0) + parseFloat(opts.options_invested || 0);

    res.json({
      success: true,
      data: {
        currentBalance:      balance,
        initialBalance:      initial,
        investedValue:       invested,
        availableCash:       balance,
        totalPortfolioValue: balance + invested,
        overallPnl:          +(balance + invested - initial).toFixed(2),
        overallPnlPct:       +(((balance + invested - initial) / initial) * 100).toFixed(2),
        holdingCount:        equity.holding_count,
        optionsCount:        opts.options_count,
        totalOrders:         activity.total_orders || 0,
        uniqueStocksTraded:  activity.unique_stocks_traded || 0,
        firstTrade:          activity.first_trade,
        lastTrade:           activity.last_trade,
        tradingDaysSpan:     activity.trading_days_span || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 6. Daily Activity Heatmap (orders by day-of-week and hour) ────────────────
router.get('/activity-heatmap', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DAYNAME(created_at)    AS day_name,
        DAYOFWEEK(created_at)  AS day_num,
        HOUR(created_at)       AS hour,
        COUNT(*)               AS order_count,
        ROUND(SUM(total_value),2) AS volume
      FROM orders
      WHERE user_id = ?
      GROUP BY DAYOFWEEK(created_at), DAYNAME(created_at), HOUR(created_at)
      ORDER BY day_num, hour
    `, [req.user.userId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
