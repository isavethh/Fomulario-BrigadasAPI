// db.js
const sql = require('mssql');

const config = {
    user: 'isa',               // tu usuario
    password: 'gato',           // tu contraseña
    server: 'localhost\\\\SQLEXPRESS',
    port: 1433, // o 'localhost\\SQLEXPRESS' si usas instancia nombrada
    database: 'BRIGADA',
    options: {
        encrypt: false,           // false para conexión local sin TLS
        trustServerCertificate: true // necesario si no usas certificado SSL
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('🟢 Conectado a SQL Server con usuario y contraseña');
        return pool;
    })
    .catch(err => {
        console.error('❌ Error al conectar a SQL Server:');
        if (err?.message) console.error('Mensaje:', err);
        else console.error(err);
    });

module.exports = {
    sql,
    poolPromise
};
