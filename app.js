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

        // 1) Consultas base: Ejecutar todas las consultas en paralelo para mayor eficiencia
        const [
            brigadaResult,
            eppRopaResult,
            botasResult,
            guantesResult,
            eppEquipoResult,
            herramientasResult,
            logisticaRepuestosResult,
            alimentacionResult,
            logisticaCampoResult,
            limpiezaPersonalResult,
            limpiezaGeneralResult,
            medicamentosResult,
            rescateAnimalResult
        ] = await Promise.all([
            pool.request().input('id', id).query('SELECT * FROM brigada WHERE id = @id'),
            pool.request().input('brigadaid', id).query('SELECT * FROM epp_ropa WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT TOP 1 * FROM botas WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT TOP 1 * FROM guantes WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM epp_equipo WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM herramientas WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM logistica_repuestos WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM alimentacion WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM logistica_campo WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM limpieza_personal WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM limpieza_general WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM medicamentos WHERE brigadaid = @brigadaid'),
            pool.request().input('brigadaid', id).query('SELECT * FROM rescate_animal WHERE brigadaid = @brigadaid')
        ]);

        const brigada = brigadaResult.recordset[0];
        if (!brigada) {
            return res.status(404).json({ message: 'Brigada no encontrada' });
        }

        // Extraer los datos de los resultados
        const eppRopa = eppRopaResult.recordset;
        const botas = botasResult.recordset[0] || {};
        const guantes = guantesResult.recordset[0] || {};
        const eppEquipo = eppEquipoResult.recordset;
        const herramientas = herramientasResult.recordset;
        const logisticaRepuestos = logisticaRepuestosResult.recordset;
        const alimentacion = alimentacionResult.recordset;
        const logisticaCampo = logisticaCampoResult.recordset;
        const limpiezaPersonal = limpiezaPersonalResult.recordset;
        const limpiezaGeneral = limpiezaGeneralResult.recordset;
        const medicamentos = medicamentosResult.recordset;
        const rescateAnimal = rescateAnimalResult.recordset;

        // 2) Generar PDF en streaming con estilo minimalista (blanco/negro)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=formulario-brigada-${id}.pdf`);

        const doc = new PDFDocument({ size: 'A4', margin: 36 });
        doc.pipe(res);

        // Helpers de layout (BN, sin bordes redondeados)
        const pageWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const drawDivider = () => {
            doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#000').lineWidth(0.5).stroke();
            doc.moveDown(0.6);
        };
        const ensureSpace = (needed = 40) => {
            const bottom = doc.page.height - doc.page.margins.bottom;
            if (doc.y + needed > bottom) {
                doc.addPage();
            }
        };
        const sectionTitle = (text) => {
            ensureSpace(28);
            doc.save();
            doc.rect(doc.page.margins.left, doc.y, pageWidth(), 22).fill('#000');
            doc.fillColor('#FFF').fontSize(11).text(text.toUpperCase(), doc.page.margins.left + 8, doc.y + 6, { width: pageWidth() - 16, align: 'left' });
            doc.restore();
            doc.moveDown(1.2);
        };
        const krow = (label, value) => {
            ensureSpace(18);
            doc.fillColor('#666').fontSize(9).text(label.toUpperCase(), { continued: false });
            doc.fillColor('#000').fontSize(11).text(String(value || ''), { indent: 0 });
            doc.moveDown(0.2);
        };
        const drawTable = (headers, rows) => {
            const colCount = headers.length;
            const w = pageWidth();
            const colW = w / colCount;
            const startX = doc.page.margins.left;
            const cellPadX = 6;
            const rowHeight = 18;
            const drawRow = (cells, isHeader = false) => {
                ensureSpace(rowHeight + 8);
                const baseY = doc.y;
                for (let i = 0; i < colCount; i++) {
                    const x = startX + i * colW;
                    if (isHeader) {
                        doc.rect(x, baseY, colW, rowHeight).fill('#000');
                        doc.fillColor('#FFF').fontSize(9).text(String(cells[i] ?? ''), x + cellPadX, baseY + 5, { width: colW - cellPadX * 2 });
                        doc.fillColor('#000');
                    } else {
                        doc.rect(x, baseY, colW, rowHeight).strokeColor('#000').lineWidth(0.5).stroke();
                        doc.fillColor('#000').fontSize(9).text(String(cells[i] ?? ''), x + cellPadX, baseY + 5, { width: colW - cellPadX * 2 });
                    }
                }
                doc.y = baseY + rowHeight;
            };
            drawRow(headers, true);
            if (!rows || rows.length === 0) {
                drawRow(['Sin registros'].concat(Array(colCount - 1).fill('')));
                return;
            }
            rows.forEach((r) => drawRow(r));
            doc.moveDown(0.6);
        };

        // Encabezado principal negro
        doc.save();
        doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth(), 40).fill('#000');
        doc.fillColor('#FFF').fontSize(14).text('FORMULARIO DE NECESIDADES - BRIGADA', doc.page.margins.left + 12, doc.page.margins.top + 10, { width: pageWidth() - 24, align: 'left' });
        doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: 'left' });
        doc.restore();
        doc.moveDown(2);

        // Información
        sectionTitle('1. Información de la Brigada');
        krow('Nombre', brigada.nombre);
        krow('Bomberos activos', brigada.cantidadactivos);
        krow('Comandante', brigada.nombrecomandante);
        krow('Celular comandante', brigada.celularcomandante);
        krow('Encargado logística', brigada.encargadologistica);
        krow('Celular logística', brigada.celularlogistica);
        krow('Números emergencia', brigada.numerosemergencia);
        drawDivider();

        // Tablas por sección
        sectionTitle('2. EPP - Ropa');
        drawTable(['Prenda', 'XS', 'S', 'M', 'L', 'XL', 'Obs'], eppRopa.map(r => [r.item, r.xs, r.s, r.m, r.l, r.xl, r.observaciones || '']));

        sectionTitle('3. EPP - Botas');
        drawTable(['37','38','39','40','41','42','43','Otra','Obs'], [[botas.talla37||0, botas.talla38||0, botas.talla39||0, botas.talla40||0, botas.talla41||0, botas.talla42||0, botas.talla43||0, botas.otratalla||'', botas.observaciones||'']]);

        sectionTitle('4. EPP - Guantes');
        drawTable(['XS','S','M','L','XL','XXL','Otra'], [[guantes.xs||0, guantes.s||0, guantes.m||0, guantes.l||0, guantes.xl||0, guantes.xxl||0, guantes.otratalla||'']]);

        sectionTitle('5. EPP - Equipo');
        drawTable(['Item','Cantidad','Obs'], eppEquipo.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('6. Herramientas');
        drawTable(['Item','Cantidad','Obs'], herramientas.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('7. Logística Repuestos');
        drawTable(['Item','Costo','Obs'], logisticaRepuestos.map(r => [r.item, r.costo||0, r.observaciones||'']));

        sectionTitle('8. Alimentación');
        drawTable(['Item','Cantidad','Obs'], alimentacion.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('9. Logística Campo');
        drawTable(['Item','Cantidad','Obs'], logisticaCampo.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('10. Limpieza Personal');
        drawTable(['Item','Cantidad','Obs'], limpiezaPersonal.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('11. Limpieza General');
        drawTable(['Item','Cantidad','Obs'], limpiezaGeneral.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('12. Medicamentos');
        drawTable(['Item','Cantidad','Obs'], medicamentos.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

        sectionTitle('13. Rescate Animal');
        drawTable(['Item','Cantidad','Obs'], rescateAnimal.map(r => [r.item, r.cantidad||0, r.observaciones||'']));

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
