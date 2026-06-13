const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('<h1>Welcome to My E-Commerce Store 🛒 - v3</h1>'));
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
