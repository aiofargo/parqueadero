const { connection } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Asegurarse de que el directorio existe
const uploadDir = 'public/uploads/icons';
if (!fsSync.existsSync(uploadDir)){
    fsSync.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de multer para la carga de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Asegurarse de que el directorio existe antes de cada carga
        if (!fsSync.existsSync(uploadDir)){
            fsSync.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'icon-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|svg/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten archivos de imagen (jpg, jpeg, png, svg)'));
    }
}).single('icono');

const tiposVehiculosController = {
    // Obtener todos los tipos de vehículos
    obtenerTiposVehiculos: async (req, res) => {
        try {
            console.log('Accediendo a obtenerTiposVehiculos');
            const { estado } = req.query;
            let query = 'SELECT * FROM tipos_vehiculos';
            const params = [];

            if (estado) {
                query += ' WHERE estado = ?';
                params.push(estado);
            }

            console.log('Ejecutando query:', query);
            console.log('Parámetros:', params);
            
            const [tipos] = await connection.query(query, params);
            console.log('Tipos de vehículos obtenidos:', tipos);
            
            res.render('tipos_vehiculos/lista', { tipos });
        } catch (error) {
            console.error('Error al obtener tipos de vehículos:', error);
            res.status(500).send('Error al obtener tipos de vehículos');
        }
    },

    // Mostrar formulario de creación
    mostrarFormularioCreacion: (req, res) => {
        res.render('tipos_vehiculos/formulario');
    },

    // Crear nuevo tipo de vehículo
    crearTipoVehiculo: async (req, res) => {
        upload(req, res, async function (err) {
            if (err) {
                console.error('Error al subir archivo:', err);
                return res.status(500).send('Error al subir el archivo: ' + err.message);
            }

            try {
                const { 
                    nombre, 
                    descripcion, 
                    tarifa_minuto,
                    tarifa_plena,
                    tarifa_24_horas,
                    tarifa_mensual,
                    porcentaje_iva,
                    estado 
                } = req.body;

                const icono = req.file ? req.file.filename : null;

                const [resultado] = await connection.query(
                    'INSERT INTO tipos_vehiculos (nombre, descripcion, icono, tarifa_minuto, tarifa_plena, tarifa_24_horas, tarifa_mensual, porcentaje_iva, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [nombre, descripcion, icono, tarifa_minuto, tarifa_plena, tarifa_24_horas, tarifa_mensual, porcentaje_iva, estado]
                );

                res.redirect('/tipos_vehiculos');
            } catch (error) {
                console.error('Error al crear tipo de vehículo:', error);
                res.status(500).send('Error al crear tipo de vehículo');
            }
        });
    },

    // Mostrar formulario de edición
    mostrarFormularioEdicion: async (req, res) => {
        try {
            const [tipos] = await connection.query('SELECT * FROM tipos_vehiculos WHERE id = ?', [req.params.id]);
            if (tipos.length > 0) {
                console.log('Tipo de vehículo encontrado:', tipos[0]);
                // Verificar si existe el archivo del ícono
                const tipo = tipos[0];
                if (tipo.icono) {
                    const iconPath = path.join(uploadDir, tipo.icono);
                    tipo.iconoExiste = fsSync.existsSync(iconPath);
                    console.log('Ruta del ícono:', iconPath);
                    console.log('¿El ícono existe?:', tipo.iconoExiste);
                }
                res.render('tipos_vehiculos/formulario', { tipo });
            } else {
                res.status(404).send('Tipo de vehículo no encontrado');
            }
        } catch (error) {
            console.error('Error al obtener tipo de vehículo:', error);
            res.status(500).send('Error al obtener tipo de vehículo');
        }
    },

    // Actualizar tipo de vehículo
    actualizarTipoVehiculo: async (req, res) => {
        upload(req, res, async function (err) {
            if (err) {
                console.error('Error al subir archivo:', err);
                return res.status(500).send('Error al subir el archivo: ' + err.message);
            }

            try {
                // Primero, obtener el registro actual para mantener los valores existentes
                const [tipoActual] = await connection.query(
                    'SELECT * FROM tipos_vehiculos WHERE id = ?',
                    [req.params.id]
                );

                if (tipoActual.length === 0) {
                    return res.status(404).send('Tipo de vehículo no encontrado');
                }

                const tipo = tipoActual[0];

                // Combinar los valores existentes con los nuevos
                const { 
                    nombre = tipo.nombre, 
                    descripcion = tipo.descripcion, 
                    tarifa_minuto = tipo.tarifa_minuto,
                    tarifa_plena = tipo.tarifa_plena,
                    tarifa_24_horas = tipo.tarifa_24_horas,
                    tarifa_mensual = tipo.tarifa_mensual,
                    porcentaje_iva = tipo.porcentaje_iva,
                    estado = tipo.estado 
                } = req.body;

                let icono = tipo.icono; // Mantener el ícono existente por defecto

                // Si se subió un nuevo archivo
                if (req.file) {
                    // Eliminar el archivo anterior si existe
                    if (tipo.icono) {
                        try {
                            await fs.unlink(path.join('public/uploads/icons/', tipo.icono));
                        } catch (error) {
                            console.error('Error al eliminar icono anterior:', error);
                        }
                    }
                    icono = req.file.filename;
                }

                await connection.query(
                    'UPDATE tipos_vehiculos SET nombre = ?, descripcion = ?, icono = ?, tarifa_minuto = ?, tarifa_plena = ?, tarifa_24_horas = ?, tarifa_mensual = ?, porcentaje_iva = ?, estado = ? WHERE id = ?',
                    [nombre, descripcion, icono, tarifa_minuto, tarifa_plena, tarifa_24_horas, tarifa_mensual, porcentaje_iva, estado, req.params.id]
                );

                res.redirect('/tipos_vehiculos');
            } catch (error) {
                console.error('Error al actualizar tipo de vehículo:', error);
                res.status(500).send('Error al actualizar tipo de vehículo');
            }
        });
    },

    // Mostrar detalles del tipo de vehículo
    mostrarDetallesTipoVehiculo: async (req, res) => {
        try {
            const { id } = req.params;
            const [tipos] = await connection.query('SELECT * FROM tipos_vehiculos WHERE id = ?', [id]);
            
            if (tipos.length === 0) {
                return res.status(404).json({ error: 'Tipo de vehículo no encontrado' });
            }
            
            res.render('tipos_vehiculos/ver', { tipo: tipos[0] });
        } catch (error) {
            console.error('Error al obtener tipo de vehículo:', error);
            return res.status(500).json({ error: 'Error al obtener tipo de vehículo' });
        }
    }
};

module.exports = tiposVehiculosController; 