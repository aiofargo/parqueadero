const { executeQuery } = require('../database/connection');

// Obtener todos los módulos
const obtenerModulos = async (req, res) => {
    try {
        const modulos = await executeQuery('SELECT * FROM modulos WHERE estado = 1 ORDER BY nombre');
        
        res.render('permisos/modulos', {
            modulos: modulos
        });
    } catch (error) {
        console.error('Error al obtener módulos:', error);
        req.flash('error', 'Error al obtener los módulos');
        res.redirect('/');
    }
};

// Crear nuevo módulo
const crearModulo = async (req, res) => {
    if (req.method === 'GET') {
        res.render('permisos/crear-modulo');
    } else {
        try {
            const { nombre, descripcion, icono, ruta } = req.body;
            
            await executeQuery(
                'INSERT INTO modulos (nombre, descripcion, icono, ruta) VALUES (?, ?, ?, ?)',
                [nombre, descripcion, icono, ruta]
            );

            req.flash('success', 'Módulo creado exitosamente');
            res.redirect('/permisos/modulos');
        } catch (error) {
            console.error('Error al crear módulo:', error);
            req.flash('error', 'Error al crear el módulo');
            res.redirect('/permisos/modulos');
        }
    }
};

// Gestionar permisos por rol
const gestionarPermisos = async (req, res) => {
    try {
        // Obtener todos los roles activos
        const roles = await executeQuery('SELECT * FROM roles WHERE estado = 1 ORDER BY nombre');
        
        // Obtener todos los módulos activos
        const modulos = await executeQuery('SELECT * FROM modulos WHERE estado = 1 ORDER BY nombre');
        
        // Obtener todas las acciones
        const acciones = await executeQuery('SELECT * FROM acciones ORDER BY id');
        
        // Si se especifica un rol, obtener sus permisos activos
        let permisosActuales = [];
        const rolSeleccionado = req.query.rol_id ? parseInt(req.query.rol_id) : null;
        
        if (rolSeleccionado) {
            permisosActuales = await executeQuery(`
                SELECT pr.* 
                FROM permisos_roles pr
                INNER JOIN modulos m ON pr.modulo_id = m.id
                WHERE pr.rol_id = ? 
                AND pr.estado = 1
                AND m.estado = 1
            `, [rolSeleccionado]);
        }
        
        res.render('permisos/gestionar', {
            roles: roles,
            modulos: modulos,
            acciones: acciones,
            permisosActuales,
            rolSeleccionado
        });
    } catch (error) {
        console.error('Error al gestionar permisos:', error);
        req.flash('error', 'Error al cargar la gestión de permisos');
        res.redirect('/');
    }
};

// Actualizar permisos de un rol
const actualizarPermisos = async (req, res) => {
    const connection = await require('../database/connection').getConnection();
    
    try {
        await connection.beginTransaction();
        
        const rol_id = parseInt(req.body.rol_id);
        const permisos = Array.isArray(req.body.permisos) ? req.body.permisos : [req.body.permisos].filter(Boolean);

        // Desactivar todos los permisos existentes del rol
        await connection.execute(
            'UPDATE permisos_roles SET estado = 0 WHERE rol_id = ?',
            [rol_id]
        );

        // Procesar los nuevos permisos
        if (permisos && permisos.length > 0) {
            for (const permiso of permisos) {
                const [modulo_id, accion_id] = permiso.split('-').map(Number);
                
                // Verificar si el permiso ya existe
                const [permisoExistente] = await connection.execute(
                    'SELECT id FROM permisos_roles WHERE rol_id = ? AND modulo_id = ? AND accion_id = ?',
                    [rol_id, modulo_id, accion_id]
                );

                if (permisoExistente.length > 0) {
                    // Actualizar el permiso existente
                    await connection.execute(
                        'UPDATE permisos_roles SET estado = 1 WHERE rol_id = ? AND modulo_id = ? AND accion_id = ?',
                        [rol_id, modulo_id, accion_id]
                    );
                } else {
                    // Crear nuevo permiso
                    await connection.execute(
                        'INSERT INTO permisos_roles (rol_id, modulo_id, accion_id, estado) VALUES (?, ?, ?, 1)',
                        [rol_id, modulo_id, accion_id]
                    );
                }
            }
        }

        // Actualizar los permisos en la sesión del usuario actual si corresponde
        if (req.session.usuario && req.session.usuario.rol_id === rol_id) {
            const [nuevosPermisos] = await connection.execute(`
                SELECT DISTINCT m.nombre as modulo, m.ruta, m.icono
                FROM permisos_roles pr
                INNER JOIN modulos m ON pr.modulo_id = m.id
                WHERE pr.rol_id = ?
                AND pr.estado = 1 
                AND m.estado = 1
                ORDER BY m.orden
            `, [rol_id]);

            req.session.permisos = nuevosPermisos;
            res.locals.permisos = nuevosPermisos;
        }

        await connection.commit();
        req.flash('success', 'Permisos actualizados exitosamente');
        res.redirect('/permisos/gestionar?rol_id=' + rol_id);
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar permisos:', error);
        req.flash('error', 'Error al actualizar los permisos');
        res.redirect('/permisos/gestionar');
    } finally {
        connection.release();
    }
};

// Obtener módulo para editar
const obtenerModuloParaEditar = async (req, res) => {
    try {
        const modulo_id = parseInt(req.params.id);
        const [modulo] = await executeQuery(
            'SELECT * FROM modulos WHERE id = ?',
            [modulo_id]
        );

        if (!modulo) {
            req.flash('error', 'Módulo no encontrado');
            return res.redirect('/permisos/modulos');
        }

        res.render('permisos/editar-modulo', {
            modulo: modulo
        });
    } catch (error) {
        console.error('Error al obtener módulo:', error);
        req.flash('error', 'Error al obtener el módulo');
        res.redirect('/permisos/modulos');
    }
};

// Actualizar módulo
const actualizarModulo = async (req, res) => {
    try {
        const modulo_id = parseInt(req.params.id);
        const { nombre, descripcion, icono, ruta } = req.body;

        await executeQuery(
            'UPDATE modulos SET nombre = ?, descripcion = ?, icono = ?, ruta = ? WHERE id = ?',
            [nombre, descripcion, icono, ruta, modulo_id]
        );

        req.flash('success', 'Módulo actualizado exitosamente');
        res.redirect('/permisos/modulos');
    } catch (error) {
        console.error('Error al actualizar módulo:', error);
        req.flash('error', 'Error al actualizar el módulo');
        res.redirect('/permisos/modulos');
    }
};

module.exports = {
    obtenerModulos,
    crearModulo,
    gestionarPermisos,
    actualizarPermisos,
    obtenerModuloParaEditar,
    actualizarModulo
}; 