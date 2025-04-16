const express = require('express');
const router = express.Router();
const mensualidadesController = require('../controllers/mensualidadesController');

// Rutas para mensualidades
router.get('/', mensualidadesController.obtenerMensualidades);
router.get('/crear', mensualidadesController.mostrarFormularioCreacion);
router.post('/crear', mensualidadesController.crearMensualidad);
router.get('/ver/:id', mensualidadesController.mostrarDetallesMensualidad);
router.get('/renovar/:id', mensualidadesController.verificarRenovacion);

// Rutas para el manejo de tickets y pagos
router.post('/previsualizar-ticket', mensualidadesController.previsualizarTicket);
router.post('/renovar/:id/previsualizar', mensualidadesController.previsualizarTicket);
router.post('/procesar-pago', mensualidadesController.procesarPagoYRenovar);
router.post('/procesar-pago/:id', mensualidadesController.procesarPagoYRenovar);
router.get('/ticket/:id', mensualidadesController.verTicket);

module.exports = router; 