const { connection } = require('../config/database');

const rolesController = {
    // Obtener todos los roles con filtro
    obtenerRoles: async (req, res) => {
        try {
            console.log('Accediendo a obtenerRoles');
            const { estado } = req.query;
            let query = 'SELECT * FROM roles';
            const params = [];

            if (estado) {
                query += ' WHERE estado = ?';
                params.push(estado);
            }

            console.log('Ejecutando query:', query);
            const [resultados] = await connection.execute(query, params);
            console.log('Roles obtenidos:', resultados);
            res.render('roles/lista', { roles: resultados });
        } catch (error) {
            console.error('Error al obtener roles:', error);
            res.status(500).json({ error: 'Error al obtener roles' });
        }
    },

    // Mostrar formulario de creación
    mostrarFormularioCreacion: (req, res) => {
        res.render('roles/crear');
    },

    // Crear nuevo rol
    crearRol: async (req, res) => {
        try {
            const { nombre, descripcion } = req.body;
            const query = 'INSERT INTO roles (nombre, descripcion, estado) VALUES (?, ?, 1)';
            await connection.execute(query, [nombre, descripcion]);
            res.redirect('/roles');
        } catch (error) {
            console.error('Error al crear rol:', error);
            res.status(500).json({ error: 'Error al crear rol' });
        }
    },

    // Mostrar formulario de edición
    mostrarFormularioEdicion: async (req, res) => {
        try {
            const { id } = req.params;
            const query = 'SELECT * FROM roles WHERE id = ?';
            const [resultados] = await connection.execute(query, [id]);
            
            if (resultados.length === 0) {
                return res.status(404).json({ error: 'Rol no encontrado' });
            }
            res.render('roles/editar', { rol: resultados[0] });
        } catch (error) {
            console.error('Error al obtener rol:', error);
            res.status(500).json({ error: 'Error al obtener rol' });
        }
    },

    // Actualizar rol
    actualizarRol: async (req, res) => {
        try {
            const { id } = req.params;
            const { nombre, descripcion, estado } = req.body;
            const query = 'UPDATE roles SET nombre = ?, descripcion = ?, estado = ? WHERE id = ?';
            await connection.execute(query, [nombre, descripcion, estado, id]);
            res.redirect('/roles');
        } catch (error) {
            console.error('Error al actualizar rol:', error);
            res.status(500).json({ error: 'Error al actualizar rol' });
        }
    },

    // Mostrar detalles del rol
    mostrarDetallesRol: async (req, res) => {
        try {
            const { id } = req.params;
            const query = 'SELECT * FROM roles WHERE id = ?';
            const [resultados] = await connection.execute(query, [id]);
            
            if (resultados.length === 0) {
                return res.status(404).json({ error: 'Rol no encontrado' });
            }
            res.render('roles/ver', { rol: resultados[0] });
        } catch (error) {
            console.error('Error al obtener rol:', error);
            res.status(500).json({ error: 'Error al obtener rol' });
        }
    }
};

module.exports = rolesController; 