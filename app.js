const express = require('express');
const cors = require('cors');
const brigadaRouter = require('./routes/brigadas');

const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: 'http://localhost:3000', // Allow only the frontend origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use('/api', brigadaRouter);

app.listen(3002, () => {
    console.log('✅ API escuchando en http://localhost:3002');
});
