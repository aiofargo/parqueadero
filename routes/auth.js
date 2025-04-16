const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Rutas de autenticación
router.get('/login', authController.mostrarLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router; 