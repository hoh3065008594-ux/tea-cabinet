require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { connect } = require('./mqtt-client');
const apiRoutes = require('./routes/api');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

getDb();

connect((topic, data) => {
  console.log(`[MQTT] ${topic}:`, JSON.stringify(data).slice(0, 80));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
