// scripts/initDB.js
const { poolPromise } = require('../db');
const bcrypt = require('bcryptjs');

const initDatabase = async () => {
    try {
        const pool = await poolPromise;

        // Crear usuario encargado por defecto
        const hashedPassword = await bcrypt.hash('encargado123', 10);
        await pool.request()
            .input('username', 'encargado')
            .input('password', hashedPassword)
            .input('role', 'encargado')
            .query(`
        IF NOT EXISTS (SELECT * FROM usuarios WHERE username = @username)
        INSERT INTO usuarios (username, password, role) 
        VALUES (@username, @password, @role)
      `);

        console.log('Base de datos inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    }
};

initDatabase();