const { connection } = require('../config/database');
const bcrypt = require('bcrypt');

// Controlador para gestionar usuarios
const usuariosController = {
    // Obtener todos los usuarios con filtro
    obtenerUsuarios: async (req, res) => {
        try {
            const { estado } = req.query;
            let query = `
                SELECT u.*, r.nombre as rol_nombre 
                FROM usuarios u 
                LEFT JOIN roles r ON u.rol_id = r.id
            `;
            const params = [];

            if (estado) {
                query += ' WHERE u.estado = ?';
                params.push(estado);
            }

            const [resultados] = await connection.execute(query, params);
            res.render('usuarios/lista', { usuarios: resultados });
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            return res.status(500).json({ error: 'Error al obtener usuarios' });
        }
    },

    // Mostrar formulario de creación
    mostrarFormularioCreacion: async (req, res) => {
        try {
            const [roles] = await connection.execute('SELECT * FROM roles WHERE estado = 1');
            res.render('usuarios/crear', { roles });
        } catch (error) {
            console.error('Error al obtener roles:', error);
            return res.status(500).json({ error: 'Error al obtener roles' });
        }
    },

    // Crear nuevo usuario
    crearUsuario: async (req, res) => {
        try {
            const { nombres, apellidos, documento, correo, celular, rol_id, password } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);
            const query = 'INSERT INTO usuarios (nombres, apellidos, documento, correo, celular, rol_id, password, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 1)';
            
            await connection.execute(query, [nombres, apellidos, documento, correo, celular, rol_id, hashedPassword]);
            res.redirect('/usuarios');
        } catch (error) {
            console.error('Error al crear usuario:', error);
            return res.status(500).json({ error: 'Error al crear usuario' });
        }
    },

    // Mostrar formulario de edición
    mostrarFormularioEdicion: async (req, res) => {
        try {
            const { id } = req.params;
            const [roles] = await connection.execute('SELECT * FROM roles WHERE estado = 1');
            const [usuarios] = await connection.execute('SELECT * FROM usuarios WHERE id = ?', [id]);
            
            if (usuarios.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            
            res.render('usuarios/editar', { 
                usuario: usuarios[0],
                roles: roles
            });
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            return res.status(500).json({ error: 'Error al obtener usuario' });
        }
    },

    // Actualizar usuario
    actualizarUsuario: async (req, res) => {
        try {
            const { id } = req.params;
            const { nombres, apellidos, documento, correo, celular, rol_id, password, estado } = req.body;
            const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
            
            let query, params;
            if (hashedPassword) {
                query = 'UPDATE usuarios SET nombres = ?, apellidos = ?, documento = ?, correo = ?, celular = ?, rol_id = ?, password = ?, estado = ? WHERE id = ?';
                params = [nombres, apellidos, documento, correo, celular, rol_id, hashedPassword, estado, id];
            } else {
                query = 'UPDATE usuarios SET nombres = ?, apellidos = ?, documento = ?, correo = ?, celular = ?, rol_id = ?, estado = ? WHERE id = ?';
                params = [nombres, apellidos, documento, correo, celular, rol_id, estado, id];
            }
            
            await connection.execute(query, params);
            res.redirect('/usuarios');
        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            return res.status(500).json({ error: 'Error al actualizar usuario' });
        }
    },

    // Inhabilitar usuario (eliminación lógica)
    inhabilitarUsuario: async (req, res) => {
        try {
            const { id } = req.params;
            const query = 'UPDATE usuarios SET estado = 0 WHERE id = ?';
            
            await connection.execute(query, [id]);
            res.redirect('/usuarios');
        } catch (error) {
            console.error('Error al inhabilitar usuario:', error);
            return res.status(500).json({ error: 'Error al inhabilitar usuario' });
        }
    },

    // Asignar nueva contraseña
    asignarNuevaContrasena: async (req, res) => {
        try {
            const { id } = req.params;
            const nuevaContrasena = 'nueva_contrasena'; // Generar una nueva contraseña aleatoria o recibirla desde el frontend
            const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
            const query = 'UPDATE usuarios SET password = ? WHERE id = ?';
            
            await connection.execute(query, [hashedPassword, id]);
            res.redirect('/usuarios');
        } catch (error) {
            console.error('Error al asignar nueva contraseña:', error);
            return res.status(500).json({ error: 'Error al asignar nueva contraseña' });
        }
    },

    // Mostrar detalles del usuario
    mostrarDetallesUsuario: async (req, res) => {
        try {
            const { id } = req.params;
            const query = `
                SELECT u.*, r.nombre as rol_nombre 
                FROM usuarios u 
                LEFT JOIN roles r ON u.rol_id = r.id 
                WHERE u.id = ?
            `;
            
            const [resultados] = await connection.execute(query, [id]);
            if (resultados.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            res.render('usuarios/ver', { usuario: resultados[0] });
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            return res.status(500).json({ error: 'Error al obtener usuario' });
        }
    }
};

module.exports = usuariosController; 