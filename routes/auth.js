const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { poolPromise } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', username)
            .query('SELECT * FROM usuarios WHERE username = @username AND activo = 1');

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: 'Credenciales incorrectas' });
        }

        const user = result.recordset[0];

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Credenciales incorrectas' });
        }

        // Crear token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                brigada_id: user.brigada_id
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Registro (solo accesible para administradores en una implementación real)
router.post('/register', async (req, res) => {
    const { username, password, role, brigada_id } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Datos incompletos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await poolPromise;

        const result = await pool.request()
            .input('username', username)
            .input('password', hashedPassword)
            .input('role', role)
            .input('brigada_id', brigada_id)
            .query(`
        INSERT INTO usuarios (username, password, role, brigada_id) 
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.brigada_id
        VALUES (@username, @password, @role, @brigada_id)
      `);

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: result.recordset[0]
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        if (error.number === 2627) { // Violación de índice único
            return res.status(400).json({ message: 'El nombre de usuario ya existe' });
        }
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;