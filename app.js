const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const brigadaRouter = require('./routes/brigadas');
const inventarioRouter = require('./routes/inventario');
const authRouter = require('./routes/auth');
const { poolPromise } = require('./db');
const PDFDocument = require('pdfkit');

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
        const pool = await poolPromise;

        // 1) Consultas base: brigada y secciones (usa nombres de tablas actuales)
        const brigada = (await pool.request().input('id', id).query('SELECT * FROM brigada WHERE id = @id')).recordset[0];
        if (!brigada) {
            return res.status(404).json({ message: 'Brigada no encontrada' });
        }
        const eppRopa = (await pool.request().input('brigadaid', id).query('SELECT * FROM epp_ropa WHERE brigadaid = @brigadaid')).recordset;
        const botas = (await pool.request().input('brigadaid', id).query('SELECT TOP 1 * FROM botas WHERE brigadaid = @brigadaid')).recordset[0] || {};
        const guantes = (await pool.request().input('brigadaid', id).query('SELECT TOP 1 * FROM guantes WHERE brigadaid = @brigadaid')).recordset[0] || {};
        const eppEquipo = (await pool.request().input('brigadaid', id).query('SELECT * FROM epp_equipo WHERE brigadaid = @brigadaid')).recordset;
        const herramientas = (await pool.request().input('brigadaid', id).query('SELECT * FROM herramientas WHERE brigadaid = @brigadaid')).recordset;
        const logisticaRepuestos = (await pool.request().input('brigadaid', id).query('SELECT * FROM logistica_repuestos WHERE brigadaid = @brigadaid')).recordset;
        const alimentacion = (await pool.request().input('brigadaid', id).query('SELECT * FROM alimentacion WHERE brigadaid = @brigadaid')).recordset;
        const logisticaCampo = (await pool.request().input('brigadaid', id).query('SELECT * FROM logistica_campo WHERE brigadaid = @brigadaid')).recordset;
        const limpiezaPersonal = (await pool.request().input('brigadaid', id).query('SELECT * FROM limpieza_personal WHERE brigadaid = @brigadaid')).recordset;
        const limpiezaGeneral = (await pool.request().input('brigadaid', id).query('SELECT * FROM limpieza_general WHERE brigadaid = @brigadaid')).recordset;
        const medicamentos = (await pool.request().input('brigadaid', id).query('SELECT * FROM medicamentos WHERE brigadaid = @brigadaid')).recordset;
        const rescateAnimal = (await pool.request().input('brigadaid', id).query('SELECT * FROM rescate_animal WHERE brigadaid = @brigadaid')).recordset;

        // 2) Generar PDF en streaming
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=formulario-brigada-${id}.pdf`);

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        // Título
        doc.fontSize(18).text('Formulario de Necesidades - Brigada', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Sección: Información
        doc.fontSize(14).text('1. Información de la Brigada', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12)
            .text(`Nombre: ${brigada.nombre || ''}`)
            .text(`Bomberos activos: ${brigada.cantidadactivos ?? ''}`)
            .text(`Comandante: ${brigada.nombrecomandante || ''}`)
            .text(`Celular comandante: ${brigada.celularcomandante || ''}`)
            .text(`Encargado logística: ${brigada.encargadologistica || ''}`)
            .text(`Celular logística: ${brigada.celularlogistica || ''}`)
            .text(`Números emergencia: ${brigada.numerosemergencia || ''}`);
        doc.moveDown();

        const addTable = (title, headers, rows) => {
            doc.fontSize(14).text(title, { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(11).text(headers.join(' | '));
            doc.moveDown(0.2);
            doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
            doc.moveDown(0.2);
            if (!rows || rows.length === 0) {
                doc.fontSize(10).text('Sin registros');
            } else {
                rows.forEach((r) => {
                    doc.fontSize(10).text(r.join(' | '));
                });
            }
            doc.moveDown();
        };

        // 3) EPP Ropa
        addTable(
            '2. EPP - Ropa',
            ['Prenda', 'XS', 'S', 'M', 'L', 'XL', 'Obs'],
            eppRopa.map(r => [r.item, r.xs, r.s, r.m, r.l, r.xl, r.observaciones || ''])
        );

        // 4) Botas
        addTable(
            '3. EPP - Botas',
            ['37','38','39','40','41','42','43','Otra','Obs'],
            [[botas.talla37||0, botas.talla38||0, botas.talla39||0, botas.talla40||0, botas.talla41||0, botas.talla42||0, botas.talla43||0, botas.otratalla||'', botas.observaciones||'']]
        );

        // 5) Guantes
        addTable(
            '4. EPP - Guantes',
            ['XS','S','M','L','XL','XXL','Otra'],
            [[guantes.xs||0, guantes.s||0, guantes.m||0, guantes.l||0, guantes.xl||0, guantes.xxl||0, guantes.otratalla||'']]
        );

        // 6) EPP Equipo
        addTable(
            '5. EPP - Equipo',
            ['Item','Cantidad','Obs'],
            eppEquipo.map(r => [r.item, r.cantidad||0, r.observaciones||''])
        );

        // 7) Herramientas
        addTable('6. Herramientas', ['Item','Cantidad','Obs'], herramientas.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        // 8) Logística Repuestos
        addTable('7. Logística Repuestos', ['Item','Costo','Obs'], logisticaRepuestos.map(r => [r.item, r.costo||0, r.observaciones||'']));

        // 9) Alimentación
        addTable('8. Alimentación', ['Item','Cantidad','Obs'], alimentacion.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        // 10) Logística Campo
        addTable('9. Logística Campo', ['Item','Cantidad','Obs'], logisticaCampo.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        // 11) Limpieza Personal
        addTable('10. Limpieza Personal', ['Item','Cantidad','Obs'], limpiezaPersonal.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        // 12) Limpieza General
        addTable('11. Limpieza General', ['Item','Cantidad','Obs'], limpiezaGeneral.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        // 13) Medicamentos
        addTable('12. Medicamentos', ['Item','Cantidad','Obs'], medicamentos.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        // 14) Rescate Animal
        addTable('13. Rescate Animal', ['Item','Cantidad','Obs'], rescateAnimal.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        doc.end();
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

// Inicialización de BD (idempotente) al arrancar
// initDatabase().catch((e) => console.error('Init DB error:', e));