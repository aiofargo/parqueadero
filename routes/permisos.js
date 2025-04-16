const express = require('express');
const router = express.Router();
const { verificarAutenticacion } = require('../middlewares/auth');
const {
    obtenerModulos,
    crearModulo,
    gestionarPermisos,
    actualizarPermisos,
    obtenerModuloParaEditar,
    actualizarModulo
} = require('../controllers/permisosController');

// Middleware de autenticación para todas las rutas
router.use(verificarAutenticacion);

// Rutas para gestión de módulos
router.get('/modulos', obtenerModulos);
router.get('/modulos/crear', (req, res) => res.render('permisos/crear-modulo'));
router.post('/modulos/crear', crearModulo);
router.get('/modulos/editar/:id', obtenerModuloParaEditar);
router.post('/modulos/editar/:id', actualizarModulo);

// Rutas para gestión de permisos
router.get('/gestionar', gestionarPermisos);
router.post('/actualizar', actualizarPermisos);

module.exports = router; 