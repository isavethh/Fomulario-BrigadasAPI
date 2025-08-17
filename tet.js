// test-connection.js
const sql = require('mssql/msnodesqlv8');

const config = {
    server: 'LAPTOP-OJ9FMTNJ\\SQLEXPRESS',
    database: 'BRIGADAS',
    driver: 'msnodesqlv8',
    options: {
        trustedConnection: true
    }
};

sql.connect(config)
    .then(() => {
        console.log('✅ Conexión exitosa');
    })
    .catch(err => {
        console.error('❌ Conexión fallida:');
        console.dir(err, { depth: null }); // <-- imprime todo el objeto
    });

