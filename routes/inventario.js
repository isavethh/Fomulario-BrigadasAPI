// routes/brigadas.js
const express = require('express');
const { requireRole } = require('../middleware/auth');
const { poolPromise } = require('../db');

const router = express.Router();

// Solo encargados pueden ver todas las brigadas
router.get('/brigadas', requireRole('encargado'), async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT * FROM brigadas ORDER BY nombre
    `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener brigadas:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Las brigadas solo pueden ver su propia información
router.get('/brigadas/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', req.params.id)
            .query('SELECT * FROM brigadas WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Brigada no encontrada' });
        }

        // Verificar que el usuario tenga acceso a esta brigada
        if (req.user.role === 'brigada' && req.user.brigada_id !== parseInt(req.params.id)) {
            return res.status(403).json({ message: 'No tienes permisos para acceder a esta brigada' });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Error al obtener brigada:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});