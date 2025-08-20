const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const brigadaRouter = require('./routes/brigadas');
const inventarioRouter = require('./routes/inventario');

const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: 'https://brigadas-front.vercel.app',
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

// Rutas de autenticación solo para encargado
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    try {
        // Solo el encargado necesita login
        if (username === 'encargado' && password === 'password123') {
            const token = jwt.sign(
                { id: 1, username: 'encargado', role: 'encargado' },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            return res.json({
                token,
                user: {
                    id: 1,
                    username: 'encargado',
                    role: 'encargado'
                }
            });
        } else {
            return res.status(400).json({ message: 'Credenciales incorrectas' });
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Rutas públicas de brigadas
app.use('/api/brigadas', brigadaRouter);

// Rutas de inventario - GET público, otras operaciones requieren admin
app.get('/api/inventario', async (req, res) => {
    try {
        // Aquí va tu lógica para obtener el inventario
        const inventario = []; // Esto debería venir de tu base de datos
        res.json(inventario);
    } catch (error) {
        console.error('Error al obtener inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Rutas protegidas de admin para inventario
app.use('/api/admin/inventario', authenticateAdmin, inventarioRouter);

// Ruta protegida para obtener brigadas (solo admin)
app.get('/api/admin/brigadas', authenticateAdmin, async (req, res) => {
    try {
        // Aquí va tu lógica para obtener todas las brigadas
        const brigadas = []; // Esto debería venir de tu base de datos
        res.json(brigadas);
    } catch (error) {
        console.error('Error al obtener brigadas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Ruta protegida para generar PDF (solo admin)
app.get('/api/admin/brigadas/:id/pdf', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Lógica para generar PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=formulario-brigada-${id}.pdf`);
        // res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al generar PDF:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Manejo de errores para rutas no encontradas
app.use('*', (req, res) => {
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