const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const brigadaRouter = require('./routes/brigadas');
const inventarioRouter = require('./routes/inventario');
const authRouter = require('./routes/auth');
const { poolPromise } = require('./db');

const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://brigadas-front.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// Middleware de autenticación solo para rutas de admin
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token de acceso requerido' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err || user.role !== 'encargado') {
            return res.status(403).json({ message: 'Acceso no autorizado' });
        }
        req.user = user;
        next();
    });
};

// Rutas de autenticación (usa base de datos con fallback)
app.use('/api/auth', authRouter);

// Rutas públicas de brigadas (monta el router refactorizado)
app.use('/api/brigadas', brigadaRouter);

// Inventario: GET público en /api/inventario y CRUD admin en /api/admin/inventario
app.use('/api/inventario', inventarioRouter);
app.use('/api/admin/inventario', authenticateAdmin, inventarioRouter);

// Ruta protegida para obtener brigadas (solo admin) - reutiliza router de brigadas si es necesario más adelante
app.get('/api/admin/brigadas', authenticateAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM brigada ORDER BY nombre');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener brigadas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Ruta protegida para generar PDF (solo admin)
app.get('/api/admin/brigadas/:id/pdf', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Placeholder: aún no generamos PDF real → devolver 204 para que el cliente no falle
        return res.status(204).end();
        // res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al generar PDF:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Manejo de errores para rutas no encontradas (Express 5: no usar '*')
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(3002, () => {
    console.log('✅ API escuchando en http://localhost:3002');
});