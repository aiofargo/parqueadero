const express = require('express');
const router = express.Router();
const tiposVehiculosController = require('../controllers/tiposVehiculosController');

// Rutas para tipos de vehículos
router.get('/', tiposVehiculosController.obtenerTiposVehiculos);
router.get('/crear', tiposVehiculosController.mostrarFormularioCreacion);
router.post('/crear', tiposVehiculosController.crearTipoVehiculo);
router.get('/editar/:id', tiposVehiculosController.mostrarFormularioEdicion);
router.post('/editar/:id', tiposVehiculosController.actualizarTipoVehiculo);
router.get('/ver/:id', tiposVehiculosController.mostrarDetallesTipoVehiculo);

module.exports = router; 