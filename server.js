require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/stocks',    require('./routes/stocks'));
app.use('/api/trading',   require('./routes/trading'));
app.use('/api/analytics', require('./routes/analytics'));

app.get('/api/health', (_, res) => res.json({ success: true, ts: new Date() }));

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log('');
      console.log('========================================');
      console.log('  INVESO v2  -  Server Ready!');
      console.log('========================================');
      console.log('  API  ->  http://localhost:' + PORT + '/api');
      console.log('========================================');
      console.log('');
    });
  } catch(err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}
start();
