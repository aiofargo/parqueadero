const express = require('express');
const router = express.Router();
const vehiculosExentosController = require('../controllers/vehiculosExentosController');

// Rutas para vehículos exentos
router.get('/', vehiculosExentosController.obtenerVehiculosExentos);
router.get('/crear', vehiculosExentosController.mostrarFormularioCreacion);
router.post('/crear', vehiculosExentosController.crearVehiculoExento);
router.get('/editar/:id', vehiculosExentosController.mostrarFormularioEdicion);
router.post('/editar/:id', vehiculosExentosController.actualizarVehiculoExento);
router.get('/ver/:id', vehiculosExentosController.mostrarDetallesVehiculoExento);

module.exports = router; 