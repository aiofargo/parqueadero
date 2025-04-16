const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');

// Rutas para roles
router.get('/', rolesController.obtenerRoles);
router.get('/crear', rolesController.mostrarFormularioCreacion);
router.post('/crear', rolesController.crearRol);
router.get('/editar/:id', rolesController.mostrarFormularioEdicion);
router.post('/editar/:id', rolesController.actualizarRol);
router.get('/ver/:id', rolesController.mostrarDetallesRol);

module.exports = router; 