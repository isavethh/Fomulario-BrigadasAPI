// routes/brigada.js
const express = require('express');
const router = express.Router();
const { poolPromise, sql} = require('../db');

// Helper function to handle database errors
const handleDbError = (res, error, entity) => {
    console.error(`❌ Error en operación de ${entity}:`, error);
    res.status(500).json({ error: `Error al procesar la solicitud de ${entity}` });
};

// ====================
// BRIGADA ENDPOINTS
// ====================

// Crear nueva brigada
router.post('/brigada', async (req, res) => {
    console.log('Solicitud POST recibida en /api/brigada');
    console.log('Datos recibidos:', req.body);
    
    try {
        const { nombre, cantidadactivos, nombrecomandante, celularcomandante, encargadologistica, celularlogistica, numerosemergencia } = req.body;

        // Solo validar numéricos
        if (cantidadactivos == null || isNaN(Number(cantidadactivos)) || Number(cantidadactivos) < 0) {
            return res.status(400).json({ success: false, message: 'cantidadactivos debe ser un número entero >= 0' });
        }
        
        console.log('Conectando a la base de datos...');
        const pool = await poolPromise;
        
        console.log('Ejecutando consulta SQL...');
        const result = await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('cantidadactivos', sql.Int, parseInt(cantidadactivos) || 0)
            .input('nombrecomandante', sql.VarChar, nombrecomandante)
            .input('celularcomandante', sql.VarChar, celularcomandante)
            .input('encargadologistica', sql.VarChar, encargadologistica || '')
            .input('celularlogistica', sql.VarChar, celularlogistica || '')
            .input('numerosemergencia', sql.VarChar, numerosemergencia || '')
            .query(`
                INSERT INTO brigada (
                    nombre, 
                    cantidadactivos, 
                    nombrecomandante, 
                    celularcomandante, 
                    encargadologistica, 
                    celularlogistica, 
                    numerosemergencia
                )
                OUTPUT INSERTED.id
                VALUES (
                    @nombre, 
                    @cantidadactivos, 
                    @nombrecomandante, 
                    @celularcomandante, 
                    @encargadologistica, 
                    @celularlogistica, 
                    @numerosemergencia
                )
            `);
            
        console.log('Brigada creada exitosamente. ID:', result.recordset[0].id);
        res.status(201).json({ 
            success: true,
            message: 'Brigada creada exitosamente', 
            brigadaId: result.recordset[0].id 
        });
    } catch (error) {
        console.error('Error al crear brigada:', error);
        if (error.originalError) {
            console.error('Error de SQL:', error.originalError.message);
        }
        res.status(500).json({ 
            success: false,
            message: 'Error al crear la brigada',
            error: error.message,
            details: error.originalError?.message || ''
        });
    }
});

// Obtener brigada por ID
router.get('/brigada/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', req.params.id)
            .query('SELECT * FROM brigada WHERE id = @id');
            
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Brigada no encontrada' });
        }
        
        res.json(result.recordset[0]);
    } catch (error) {
        handleDbError(res, error, 'obtención de brigada');
    }
});

// Actualizar brigada
router.put('/brigada/:id', async (req, res) => {
    try {
        const { nombre, cantidadactivos, nombrecomandante, celularcomandante, encargadologistica, celularlogistica, numerosemergencia } = req.body;
        
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.id)
            .input('nombre', nombre)
            .input('cantidadactivos', cantidadactivos)
            .input('nombrecomandante', nombrecomandante)
            .input('celularcomandante', celularcomandante)
            .input('encargadologistica', encargadologistica)
            .input('celularlogistica', celularlogistica)
            .input('numerosemergencia', numerosemergencia)
            .query(`
                UPDATE brigada 
                SET nombre = @nombre, 
                    cantidadactivos = @cantidadactivos,
                    nombrecomandante = @nombrecomandante,
                    celularcomandante = @celularcomandante,
                    encargadologistica = @encargadologistica,
                    celularlogistica = @celularlogistica,
                    numerosemergencia = @numerosemergencia
                WHERE id = @id
            `);
            
        res.json({ message: 'Brigada actualizada exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'actualización de brigada');
    }
});

// ====================
// EPP ROPA ENDPOINTS
// ====================

// Agregar/Actualizar EPP Ropa
router.post('/brigada/:id/epp-ropa', async (req, res) => {
    console.log('Solicitud POST recibida en /api/brigada/:id/epp-ropa');
    console.log('Datos recibidos:', req.body);
    
    try {
        const { tipo, talla, cantidad, observaciones } = req.body;
        const brigadaId = req.params.id;
        
        if (!tipo || !talla || cantidad === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: tipo, talla, cantidad',
                required: ['tipo', 'talla', 'cantidad']
            });
        }
        if (isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        
        const pool = await poolPromise;
        
        // Convertir el formato del frontend al formato de la base de datos
        const updateData = {
            xs: talla === 'xs' ? parseInt(cantidad) || 0 : 0,
            s: talla === 's' ? parseInt(cantidad) || 0 : 0,
            m: talla === 'm' ? parseInt(cantidad) || 0 : 0,
            l: talla === 'l' ? parseInt(cantidad) || 0 : 0,
            xl: talla === 'xl' ? parseInt(cantidad) || 0 : 0,
            observaciones: observaciones || null
        };
        
        // Verificar si ya existe un registro para este ítem
        const checkResult = await pool.request()
            .input('brigadaid', sql.Int, brigadaId)
            .input('item', sql.VarChar, tipo)
            .query('SELECT id FROM epp_ropa WHERE brigadaid = @brigadaid AND item = @item');
        
        if (checkResult.recordset.length > 0) {
            // Actualizar registro existente
            await pool.request()
                .input('brigadaid', sql.Int, brigadaId)
                .input('item', sql.VarChar, tipo)
                .input('xs', sql.Int, updateData.xs)
                .input('s', sql.Int, updateData.s)
                .input('m', sql.Int, updateData.m)
                .input('l', sql.Int, updateData.l)
                .input('xl', sql.Int, updateData.xl)
                .input('observaciones', sql.VarChar, updateData.observaciones)
                .query(`
                    UPDATE epp_ropa 
                    SET xs = @xs, s = @s, m = @m, l = @l, xl = @xl, 
                        observaciones = @observaciones
                    WHERE brigadaid = @brigadaid AND item = @item
                `);
        } else {
            // Insertar nuevo registro
            await pool.request()
                .input('brigadaid', sql.Int, brigadaId)
                .input('item', sql.VarChar, tipo)
                .input('xs', sql.Int, updateData.xs)
                .input('s', sql.Int, updateData.s)
                .input('m', sql.Int, updateData.m)
                .input('l', sql.Int, updateData.l)
                .input('xl', sql.Int, updateData.xl)
                .input('observaciones', sql.VarChar, updateData.observaciones)
                .query(`
                    INSERT INTO epp_ropa 
                    (brigadaid, item, xs, s, m, l, xl, observaciones)
                    VALUES 
                    (@brigadaid, @item, @xs, @s, @m, @l, @xl, @observaciones)
                `);
        }
        
        console.log('EPP Ropa actualizado exitosamente');
        res.status(201).json({ 
            success: true,
            message: 'EPP Ropa actualizado exitosamente' 
        });
    } catch (error) {
        console.error('Error al actualizar EPP Ropa:', error);
        if (error.originalError) {
            console.error('Error de SQL:', error.originalError.message);
        }
        res.status(500).json({ 
            success: false,
            message: 'Error al actualizar EPP Ropa',
            error: error.message,
            details: error.originalError?.message || ''
        });
    }
});

// Obtener EPP Ropa de una brigada
router.get('/brigada/:id/epp-ropa', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM epp_ropa WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de EPP Ropa');
    }
});

// Eliminar ítem de EPP Ropa
router.delete('/brigada/:id/epp-ropa/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM epp_ropa WHERE id = @id');
            
        res.json({ message: 'Ítem de EPP Ropa eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de EPP Ropa');
    }
});

// ====================
// BOTAS ENDPOINTS
// ====================

// Agregar/Actualizar Botas
router.post('/brigada/:id/botas', async (req, res) => {
    console.log('Solicitud POST recibida en /api/brigada/:id/botas');
    console.log('Datos recibidos:', req.body);
    
    try {
        const { tipo, talla, cantidad, observaciones, otratalla } = req.body;
        const brigadaId = req.params.id;
        
        if (!tipo || !talla || cantidad === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos: tipo, talla, cantidad',
                required: ['tipo', 'talla', 'cantidad']
            });
        }
        
        const pool = await poolPromise;
        if (isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        
        // Convertir el formato del frontend al formato de la base de datos
        const updateData = {
            talla37: talla === '37' ? parseInt(cantidad) || 0 : 0,
            talla38: talla === '38' ? parseInt(cantidad) || 0 : 0,
            talla39: talla === '39' ? parseInt(cantidad) || 0 : 0,
            talla40: talla === '40' ? parseInt(cantidad) || 0 : 0,
            talla41: talla === '41' ? parseInt(cantidad) || 0 : 0,
            talla42: talla === '42' ? parseInt(cantidad) || 0 : 0,
            talla43: talla === '43' ? parseInt(cantidad) || 0 : 0,
            otratalla: talla === 'otra' ? (otratalla || '') : '',
            observaciones: observaciones || null
        };
        
        // Verificar si ya existe un registro para esta brigada
        const checkResult = await pool.request()
            .input('brigadaid', sql.Int, brigadaId)
            .query('SELECT id FROM botas WHERE brigadaid = @brigadaid');
        
        if (checkResult.recordset.length > 0) {
            // Actualizar registro existente
            await pool.request()
                .input('brigadaid', sql.Int, brigadaId)
                .input('talla37', sql.Int, updateData.talla37)
                .input('talla38', sql.Int, updateData.talla38)
                .input('talla39', sql.Int, updateData.talla39)
                .input('talla40', sql.Int, updateData.talla40)
                .input('talla41', sql.Int, updateData.talla41)
                .input('talla42', sql.Int, updateData.talla42)
                .input('talla43', sql.Int, updateData.talla43)
                .input('otratalla', sql.VarChar, updateData.otratalla)
                .input('observaciones', sql.VarChar, updateData.observaciones)
                .query(`
                    UPDATE botas 
                    SET talla37 = talla37 + @talla37,
                        talla38 = talla38 + @talla38,
                        talla39 = talla39 + @talla39,
                        talla40 = talla40 + @talla40,
                        talla41 = talla41 + @talla41,
                        talla42 = talla42 + @talla42,
                        talla43 = talla43 + @talla43,
                        otratalla = CASE WHEN @otratalla != '' THEN @otratalla ELSE otratalla END,
                        observaciones = @observaciones
                    WHERE brigadaid = @brigadaid
                `);
        } else {
            // Insertar nuevo registro
            await pool.request()
                .input('brigadaid', sql.Int, brigadaId)
                .input('talla37', sql.Int, updateData.talla37)
                .input('talla38', sql.Int, updateData.talla38)
                .input('talla39', sql.Int, updateData.talla39)
                .input('talla40', sql.Int, updateData.talla40)
                .input('talla41', sql.Int, updateData.talla41)
                .input('talla42', sql.Int, updateData.talla42)
                .input('talla43', sql.Int, updateData.talla43)
                .input('otratalla', sql.VarChar, updateData.otratalla)
                .input('observaciones', sql.VarChar, updateData.observaciones)
                .query(`
                    INSERT INTO botas 
                    (brigadaid, talla37, talla38, talla39, talla40, talla41, talla42, talla43, otratalla, observaciones)
                    VALUES 
                    (@brigadaid, @talla37, @talla38, @talla39, @talla40, @talla41, @talla42, @talla43, @otratalla, @observaciones)
                `);
        }
            
        res.status(201).json({ message: 'Datos de botas actualizados exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'actualización de botas');
    }
});

// Obtener Botas de una brigada
router.get('/brigada/:id/botas', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM botas WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset[0] || {});
    } catch (error) {
        handleDbError(res, error, 'obtención de botas');
    }
});

// ====================
// GUANTES ENDPOINTS
// ====================

// Agregar/Actualizar Guantes
router.post('/brigada/:id/guantes', async (req, res) => {
    try {
        const { xs, s, m, l, xl, xxl, otratalla } = req.body;
        const nums = { xs, s, m, l, xl, xxl };
        for (const [k, v] of Object.entries(nums)) {
            if (v == null || isNaN(Number(v)) || Number(v) < 0) {
                return res.status(400).json({ success: false, message: `${k} debe ser un número entero >= 0` });
            }
        }
        const pool = await poolPromise;
        
        // Verificar si ya existe un registro para esta brigada
        const checkResult = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT id FROM guantes WHERE brigadaid = @brigadaid');
        
        if (checkResult.recordset.length > 0) {
            // Actualizar registro existente
            await pool.request()
                .input('brigadaid', req.params.id)
                .input('xs', xs || 0)
                .input('s', s || 0)
                .input('m', m || 0)
                .input('l', l || 0)
                .input('xl', xl || 0)
                .input('xxl', xxl || 0)
                .input('otratalla', otratalla || null)
                .query(`
                    UPDATE guantes 
                    SET xs = @xs, s = @s, m = @m, l = @l, xl = @xl, xxl = @xxl, otratalla = @otratalla
                    WHERE brigadaid = @brigadaid
                `);
        } else {
            // Crear nuevo registro
            await pool.request()
                .input('brigadaid', req.params.id)
                .input('xs', xs || 0)
                .input('s', s || 0)
                .input('m', m || 0)
                .input('l', l || 0)
                .input('xl', xl || 0)
                .input('xxl', xxl || 0)
                .input('otratalla', otratalla || null)
                .query(`
                    INSERT INTO guantes (brigadaid, xs, s, m, l, xl, xxl, otratalla)
                    VALUES (@brigadaid, @xs, @s, @m, @l, @xl, @xxl, @otratalla)
                `);
        }
            
        res.status(201).json({ message: 'Datos de guantes actualizados exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'actualización de guantes');
    }
});

// Obtener Guantes de una brigada
router.get('/brigada/:id/guantes', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM guantes WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset[0] || {});
    } catch (error) {
        handleDbError(res, error, 'obtención de guantes');
    }
});

// ====================
// EPP EQUIPO ENDPOINTS
// ====================

// Agregar ítem de EPP Equipo
router.post('/brigada/:id/epp-equipo', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO epp_equipo (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de EPP Equipo agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de EPP Equipo');
    }
});

// Obtener EPP Equipo de una brigada
router.get('/brigada/:id/epp-equipo', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM epp_equipo WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de EPP Equipo');
    }
});

// Eliminar ítem de EPP Equipo
router.delete('/brigada/:id/epp-equipo/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM epp_equipo WHERE id = @id');
            
        res.json({ message: 'Ítem de EPP Equipo eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de EPP Equipo');
    }
});

// ====================
// HERRAMIENTAS ENDPOINTS
// ====================

// Agregar ítem de Herramientas
router.post('/brigada/:id/herramientas', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO herramientas (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Herramientas agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Herramientas');
    }
});

// Obtener Herramientas de una brigada
router.get('/brigada/:id/herramientas', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM herramientas WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Herramientas');
    }
});

// Eliminar ítem de Herramientas
router.delete('/brigada/:id/herramientas/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM herramientas WHERE id = @id');
            
        res.json({ message: 'Ítem de Herramientas eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Herramientas');
    }
});

// ====================
// LOGÍSTICA REPUESTOS ENDPOINTS
// ====================

// Agregar ítem de Logística Repuestos
router.post('/brigada/:id/logistica-repuestos', async (req, res) => {
    try {
        const { item, costo, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (costo == null || isNaN(Number(costo)) || Number(costo) < 0) {
            return res.status(400).json({ success: false, message: 'costo debe ser un número >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('costo', costo || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO logistica_repuestos (brigadaid, item, costo, observaciones)
                VALUES (@brigadaid, @item, @costo, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Logística Repuestos agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Logística Repuestos');
    }
});

// Obtener Logística Repuestos de una brigada
router.get('/brigada/:id/logistica-repuestos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM logistica_repuestos WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Logística Repuestos');
    }
});

// Eliminar ítem de Logística Repuestos
router.delete('/brigada/:id/logistica-repuestos/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM logistica_repuestos WHERE id = @id');
            
        res.json({ message: 'Ítem de Logística Repuestos eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Logística Repuestos');
    }
});

// ====================
// ALIMENTACIÓN ENDPOINTS
// ====================

// Agregar ítem de Alimentación
router.post('/brigada/:id/alimentacion', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO alimentacion (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Alimentación agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Alimentación');
    }
});

// Obtener Alimentación de una brigada
router.get('/brigada/:id/alimentacion', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM alimentacion WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Alimentación');
    }
});

// Eliminar ítem de Alimentación
router.delete('/brigada/:id/alimentacion/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM alimentacion WHERE id = @id');
            
        res.json({ message: 'Ítem de Alimentación eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Alimentación');
    }
});

// ====================
// LOGÍSTICA CAMPO ENDPOINTS
// ====================

// Agregar ítem de Logística Campo
router.post('/brigada/:id/logistica-campo', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO logistica_campo (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Logística Campo agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Logística Campo');
    }
});

// Obtener Logística Campo de una brigada
router.get('/brigada/:id/logistica-campo', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM logistica_campo WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Logística Campo');
    }
});

// Eliminar ítem de Logística Campo
router.delete('/brigada/:id/logistica-campo/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM logistica_campo WHERE id = @id');
            
        res.json({ message: 'Ítem de Logística Campo eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Logística Campo');
    }
});

// ====================
// LIMPIEZA PERSONAL ENDPOINTS
// ====================

// Agregar ítem de Limpieza Personal
router.post('/brigada/:id/limpieza-personal', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO limpieza_personal (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Limpieza Personal agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Limpieza Personal');
    }
});

// Obtener Limpieza Personal de una brigada
router.get('/brigada/:id/limpieza-personal', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM limpieza_personal WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Limpieza Personal');
    }
});

// Eliminar ítem de Limpieza Personal
router.delete('/brigada/:id/limpieza-personal/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM limpieza_personal WHERE id = @id');
            
        res.json({ message: 'Ítem de Limpieza Personal eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Limpieza Personal');
    }
});

// ====================
// LIMPIEZA GENERAL ENDPOINTS
// ====================

// Agregar ítem de Limpieza General
router.post('/brigada/:id/limpieza-general', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO limpieza_general (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Limpieza General agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Limpieza General');
    }
});

// Obtener Limpieza General de una brigada
router.get('/brigada/:id/limpieza-general', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM limpieza_general WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Limpieza General');
    }
});

// Eliminar ítem de Limpieza General
router.delete('/brigada/:id/limpieza-general/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM limpieza_general WHERE id = @id');
            
        res.json({ message: 'Ítem de Limpieza General eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Limpieza General');
    }
});

// ====================
// MEDICAMENTOS ENDPOINTS
// ====================

// Agregar ítem de Medicamentos
router.post('/brigada/:id/medicamentos', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO medicamentos (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Medicamentos agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Medicamentos');
    }
});

// Obtener Medicamentos de una brigada
router.get('/brigada/:id/medicamentos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM medicamentos WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Medicamentos');
    }
});

// Eliminar ítem de Medicamentos
router.delete('/brigada/:id/medicamentos/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM medicamentos WHERE id = @id');
            
        res.json({ message: 'Ítem de Medicamentos eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Medicamentos');
    }
});

// ====================
// RESCATE ANIMAL ENDPOINTS
// ====================

// Agregar ítem de Rescate Animal
router.post('/brigada/:id/rescate-animal', async (req, res) => {
    try {
        const { item, cantidad, observaciones } = req.body;
        if (!item) return res.status(400).json({ success: false, message: 'item es requerido' });
        if (cantidad == null || isNaN(Number(cantidad)) || Number(cantidad) < 0) {
            return res.status(400).json({ success: false, message: 'cantidad debe ser un número entero >= 0' });
        }
        const pool = await poolPromise;
        
        await pool.request()
            .input('brigadaid', req.params.id)
            .input('item', item)
            .input('cantidad', cantidad || 0)
            .input('observaciones', observaciones || null)
            .query(`
                INSERT INTO rescate_animal (brigadaid, item, cantidad, observaciones)
                VALUES (@brigadaid, @item, @cantidad, @observaciones)
            `);
            
        res.status(201).json({ message: 'Ítem de Rescate Animal agregado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'agregar ítem de Rescate Animal');
    }
});

// Obtener Rescate Animal de una brigada
router.get('/brigada/:id/rescate-animal', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('brigadaid', req.params.id)
            .query('SELECT * FROM rescate_animal WHERE brigadaid = @brigadaid');
            
        res.json(result.recordset);
    } catch (error) {
        handleDbError(res, error, 'obtención de Rescate Animal');
    }
});

// Eliminar ítem de Rescate Animal
router.delete('/brigada/:id/rescate-animal/:itemId', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', req.params.itemId)
            .query('DELETE FROM rescate_animal WHERE id = @id');
            
        res.json({ message: 'Ítem de Rescate Animal eliminado exitosamente' });
    } catch (error) {
        handleDbError(res, error, 'eliminación de ítem de Rescate Animal');
    }
});

// ====================
// GET /brigada (Obtener todas las brigadas)
// ====================
router.get('/brigada', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM brigada');
        res.status(200).json(result.recordset);
    } catch (err) {
        handleDbError(res, err, 'obtención de brigadas');
    }
});

module.exports = router;
