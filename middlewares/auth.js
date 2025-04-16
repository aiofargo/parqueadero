const { executeQuery } = require('../database/connection');

// Middleware para verificar si el usuario está autenticado
const verificarAutenticacion = (req, res, next) => {
    if (!req.session.usuario) {
        req.flash('error', 'Por favor inicie sesión para continuar');
        return res.redirect('/login');
    }
    next();
};

// Middleware para verificar si el usuario tiene acceso al módulo
const verificarAccesoModulo = (modulo) => {
    return async (req, res, next) => {
        if (!req.session.usuario) {
            req.flash('error', 'Por favor inicie sesión para continuar');
            return res.redirect('/login');
        }

        try {
            const permisos = await executeQuery(`
                SELECT 1
                FROM permisos_roles pr
                INNER JOIN modulos m ON pr.modulo_id = m.id
                WHERE pr.rol_id = ?
                AND m.nombre = ?
                AND pr.estado = 1
                AND m.estado = 1
            `, [req.session.usuario.rol_id, modulo]);

            if (permisos.length === 0) {
                req.flash('error', 'No tienes acceso a este módulo');
                return res.redirect('/dashboard');
            }

            next();
        } catch (error) {
            console.error('Error verificando acceso al módulo:', error);
            req.flash('error', 'Error al verificar permisos');
            res.redirect('/dashboard');
        }
    };
};

// Middleware para verificar permisos específicos
const verificarPermiso = (modulo, accion) => {
    return async (req, res, next) => {
        if (!req.session.usuario) {
            req.flash('error', 'Por favor inicie sesión para continuar');
            return res.redirect('/login');
        }

        try {
            const permisos = await executeQuery(`
                SELECT 1
                FROM permisos_roles pr
                INNER JOIN modulos m ON pr.modulo_id = m.id
                INNER JOIN acciones a ON pr.accion_id = a.id
                WHERE pr.rol_id = ?
                AND m.nombre = ?
                AND a.codigo = ?
                AND pr.estado = 1
                AND m.estado = 1
            `, [req.session.usuario.rol_id, modulo, accion]);

            if (permisos.length === 0) {
                req.flash('error', 'No tienes permisos para realizar esta acción');
                return res.redirect('/dashboard');
            }

            next();
        } catch (error) {
            console.error('Error verificando permisos:', error);
            req.flash('error', 'Error al verificar permisos');
            res.redirect('/dashboard');
        }
    };
};

// Cargar permisos del usuario
const cargarPermisosUsuario = async (req, res, next) => {
    if (!req.session.usuario) {
        return next();
    }

    try {
        // Obtener solo los módulos a los que el usuario tiene acceso
        const permisos = await executeQuery(`
            SELECT DISTINCT m.nombre as modulo, m.ruta, m.icono
            FROM permisos_roles pr
            INNER JOIN modulos m ON pr.modulo_id = m.id
            WHERE pr.rol_id = ?
            AND pr.estado = 1 
            AND m.estado = 1
            ORDER BY m.nombre
        `, [req.session.usuario.rol_id]);
        
        req.session.permisos = permisos;
        res.locals.permisos = permisos;
        res.locals.usuario = req.session.usuario;
        next();
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        next(error);
    }
};

module.exports = {
    verificarAutenticacion,
    verificarAccesoModulo,
    verificarPermiso,
    cargarPermisosUsuario
}; 