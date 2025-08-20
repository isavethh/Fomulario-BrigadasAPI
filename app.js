const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const brigadaRouter = require('./routes/brigadas');
const inventarioRouter = require('./routes/inventario');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: 'https://brigadas-front.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Rutas públicas
app.use('/api/auth', authRouter);

// Middleware de autenticación para todas las rutas /api
app.use('/api', authenticateToken);

// Rutas protegidas
app.use('/api', brigadaRouter);
app.use('/api', inventarioRouter);

app.listen(3002, () => {
    console.log('✅ API escuchando en http://localhost:3002');
});