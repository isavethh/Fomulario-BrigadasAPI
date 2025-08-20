// routes/inventario.js
const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { poolPromise, sql } = require('../db');

const router = express.Router();

// GET público: inventario visible para todos (puedes ajustar la query a tus tablas reales)
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT TOP 200 * FROM inventario ORDER BY id DESC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// A partir de aquí, rutas protegidas para admin
router.use(authenticateToken, requireRole('encargado'));

// Obtener categorías (admin)
router.get('/categorias', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT DISTINCT categoria FROM inventario
        `);
        res.json(result.recordset.map(r => r.categoria));
    } catch (error) {
        console.error('Error al obtener categorías de inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Crear ítem (admin)
router.post('/', async (req, res) => {
    try {
        const { nombre, categoria, cantidad, observaciones } = req.body;
        if (!nombre || !categoria) {
            return res.status(400).json({ message: 'nombre y categoria son requeridos' });
        }
        if (cantidad != null && (isNaN(Number(cantidad)) || Number(cantidad) < 0)) {
            return res.status(400).json({ message: 'cantidad debe ser un número entero >= 0' });
        }

        const pool = await poolPromise;
        const result = await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('categoria', sql.VarChar, categoria)
            .input('cantidad', sql.Int, parseInt(cantidad) || 0)
            .input('observaciones', sql.VarChar, observaciones || null)
            .query(`
                INSERT INTO inventario (nombre, categoria, cantidad, observaciones)
                OUTPUT INSERTED.*
                VALUES (@nombre, @categoria, @cantidad, @observaciones)
            `);
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error al crear ítem de inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Actualizar ítem (admin)
router.put('/:id', async (req, res) => {
    try {
        const { nombre, categoria, cantidad, observaciones } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.VarChar, nombre)
            .input('categoria', sql.VarChar, categoria)
            .input('cantidad', sql.Int, parseInt(cantidad) || 0)
            .input('observaciones', sql.VarChar, observaciones || null)
            .query(`
                UPDATE inventario
                SET nombre = @nombre,
                    categoria = @categoria,
                    cantidad = @cantidad,
                    observaciones = @observaciones
                WHERE id = @id
            `);
        res.json({ success: true });
    } catch (error) {
        console.error('Error al actualizar ítem de inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Borrar ítem (admin)
router.delete('/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM inventario WHERE id = @id');
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar ítem de inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router;