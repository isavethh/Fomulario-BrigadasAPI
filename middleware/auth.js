const jwt = require('jsonwebtoken');
const { poolPromise } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', decoded.id)
            .query('SELECT id, username, role, brigada_id FROM usuarios WHERE id = @id AND activo = 1');

        if (result.recordset.length === 0) {
            return res.sendStatus(403);
        }

        req.user = result.recordset[0];
        next();
    } catch (error) {
        console.error('Error en autenticación:', error);
        return res.sendStatus(403);
    }
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ message: 'Acceso denegado. Permisos insuficientes.' });
        }
        next();
    };
};

module.exports = { authenticateToken, requireRole };