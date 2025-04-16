const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const parqueaderoController = require('../controllers/parqueaderoController');

// Ruta principal del parqueadero
router.get('/', isAuthenticated, (req, res) => {
    res.render('parqueadero/index');
});

// Rutas para registro de entrada
router.get('/entrada', isAuthenticated, parqueaderoController.mostrarFormularioEntrada);
router.post('/entrada', isAuthenticated, parqueaderoController.procesarEntrada);

// Ruta para verificar placa
router.get('/verificar-placa', isAuthenticated, parqueaderoController.verificarPlaca);

// Rutas para registro de salida
router.get('/salida', isAuthenticated, parqueaderoController.mostrarFormularioSalida);
router.get('/verificar-salida', isAuthenticated, parqueaderoController.verificarVehiculoSalida);
router.post('/procesar-salida', isAuthenticated, parqueaderoController.procesarSalida);

// Ruta para obtener estadísticas
router.get('/estadisticas', isAuthenticated, parqueaderoController.obtenerEstadisticas);

module.exports = router; 