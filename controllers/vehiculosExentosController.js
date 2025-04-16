const { connection } = require('../config/database');

const vehiculosExentosController = {
    // Obtener todos los vehículos exentos
    obtenerVehiculosExentos: async (req, res) => {
        try {
            const { estado } = req.query;
            let query = `
                SELECT 
                    ve.*,
                    tv.nombre as tipo_vehiculo,
                    u.nombres as usuario_nombre
                FROM vehiculos_exentos ve
                JOIN tipos_vehiculos tv ON ve.tipo_vehiculo_id = tv.id
                JOIN usuarios u ON ve.usuario_id = u.id
            `;
            const params = [];

            if (estado) {
                query += ' WHERE ve.estado = ?';
                params.push(estado);
            }

            query += ' ORDER BY ve.fecha_creacion DESC';

            const [vehiculos] = await connection.query(query, params);
            
            res.render('vehiculos_exentos/lista', { 
                vehiculos,
                estado: estado || '',
                success: req.flash('success'),
                error: req.flash('error')
            });
        } catch (error) {
            console.error('Error al obtener vehículos exentos:', error);
            req.flash('error', 'Error al obtener vehículos exentos');
            res.redirect('/dashboard');
        }
    },

    // Mostrar formulario de creación
    mostrarFormularioCreacion: async (req, res) => {
        try {
            const [tiposVehiculos] = await connection.query('SELECT * FROM tipos_vehiculos WHERE estado = 1');
            res.render('vehiculos_exentos/formulario', { tiposVehiculos });
        } catch (error) {
            console.error('Error al cargar formulario:', error);
            res.status(500).send('Error al cargar formulario');
        }
    },

    // Crear nuevo vehículo exento
    crearVehiculoExento: async (req, res) => {
        try {
            const {
                placa,
                nombre_propietario,
                documento_propietario,
                tipo_vehiculo_id,
                motivo,
                fecha_inicio,
                fecha_fin
            } = req.body;

            // Validar fechas
            if (new Date(fecha_inicio) > new Date(fecha_fin)) {
                req.flash('error', 'La fecha de fin no puede ser anterior a la fecha de inicio');
                return res.redirect('/vehiculos_exentos/crear');
            }

            // Validar que el tipo de vehículo existe y está activo
            const [tipoVehiculo] = await connection.query(
                'SELECT id FROM tipos_vehiculos WHERE id = ? AND estado = 1',
                [tipo_vehiculo_id]
            );

            if (tipoVehiculo.length === 0) {
                req.flash('error', 'El tipo de vehículo seleccionado no existe o está inactivo');
                return res.redirect('/vehiculos_exentos/crear');
            }

            // Validar que la placa no esté duplicada
            const [vehiculoExistente] = await connection.query(
                'SELECT id FROM vehiculos_exentos WHERE placa = ? AND estado = 1',
                [placa.toUpperCase()]
            );

            if (vehiculoExistente.length > 0) {
                req.flash('error', 'Ya existe un vehículo exento activo con esta placa');
                return res.redirect('/vehiculos_exentos/crear');
            }

            await connection.query(
                `INSERT INTO vehiculos_exentos (
                    placa, nombre_propietario, documento_propietario,
                    tipo_vehiculo_id, motivo, fecha_inicio, fecha_fin,
                    usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    placa.toUpperCase(),
                    nombre_propietario,
                    documento_propietario,
                    tipo_vehiculo_id,
                    motivo,
                    fecha_inicio,
                    fecha_fin,
                    req.session.usuario.id
                ]
            );

            req.flash('success', 'Vehículo exento creado exitosamente');
            res.redirect('/vehiculos_exentos');
        } catch (error) {
            console.error('Error al crear vehículo exento:', error);
            req.flash('error', 'Error al crear vehículo exento');
            res.redirect('/vehiculos_exentos/crear');
        }
    },

    // Mostrar formulario de edición
    mostrarFormularioEdicion: async (req, res) => {
        try {
            const [tiposVehiculos] = await connection.query('SELECT * FROM tipos_vehiculos WHERE estado = 1');
            const [vehiculos] = await connection.query(
                'SELECT * FROM vehiculos_exentos WHERE id = ?',
                [req.params.id]
            );

            if (vehiculos.length === 0) {
                return res.status(404).send('Vehículo exento no encontrado');
            }

            res.render('vehiculos_exentos/formulario', {
                vehiculo: vehiculos[0],
                tiposVehiculos
            });
        } catch (error) {
            console.error('Error al obtener vehículo exento:', error);
            res.status(500).send('Error al obtener vehículo exento');
        }
    },

    // Actualizar vehículo exento
    actualizarVehiculoExento: async (req, res) => {
        try {
            const {
                placa,
                nombre_propietario,
                documento_propietario,
                tipo_vehiculo_id,
                motivo,
                fecha_inicio,
                fecha_fin,
                estado
            } = req.body;

            await connection.query(
                `UPDATE vehiculos_exentos SET 
                    placa = ?, nombre_propietario = ?, documento_propietario = ?,
                    tipo_vehiculo_id = ?, motivo = ?, fecha_inicio = ?,
                    fecha_fin = ?, estado = ?
                WHERE id = ?`,
                [
                    placa.toUpperCase(),
                    nombre_propietario,
                    documento_propietario,
                    tipo_vehiculo_id,
                    motivo,
                    fecha_inicio,
                    fecha_fin,
                    estado,
                    req.params.id
                ]
            );

            res.redirect('/vehiculos_exentos');
        } catch (error) {
            console.error('Error al actualizar vehículo exento:', error);
            res.status(500).send('Error al actualizar vehículo exento');
        }
    },

    // Mostrar detalles del vehículo exento
    mostrarDetallesVehiculoExento: async (req, res) => {
        try {
            const [vehiculos] = await connection.query(`
                SELECT 
                    ve.*,
                    tv.nombre as tipo_vehiculo,
                    u.nombres as usuario_nombre
                FROM vehiculos_exentos ve
                JOIN tipos_vehiculos tv ON ve.tipo_vehiculo_id = tv.id
                JOIN usuarios u ON ve.usuario_id = u.id
                WHERE ve.id = ?
            `, [req.params.id]);

            if (vehiculos.length === 0) {
                return res.status(404).send('Vehículo exento no encontrado');
            }

            res.render('vehiculos_exentos/ver', { vehiculo: vehiculos[0] });
        } catch (error) {
            console.error('Error al obtener vehículo exento:', error);
            res.status(500).send('Error al obtener vehículo exento');
        }
    }
};

module.exports = vehiculosExentosController; 