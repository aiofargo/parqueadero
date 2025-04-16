// Middleware para verificar si el usuario está autenticado
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.usuario) {
        return next();
    }
    res.redirect('/login');
};

module.exports = {
    isAuthenticated
}; 