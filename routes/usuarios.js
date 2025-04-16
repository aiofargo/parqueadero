const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');

// Rutas para usuarios
router.get('/', usuariosController.obtenerUsuarios);
router.get('/crear', usuariosController.mostrarFormularioCreacion);
router.post('/crear', usuariosController.crearUsuario);
router.get('/editar/:id', usuariosController.mostrarFormularioEdicion);
router.post('/editar/:id', usuariosController.actualizarUsuario);
router.post('/inhabilitar/:id', usuariosController.inhabilitarUsuario);
router.post('/asignar-contrasena/:id', usuariosController.asignarNuevaContrasena);
router.get('/ver/:id', usuariosController.mostrarDetallesUsuario);

module.exports = router; 