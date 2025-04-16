const formatNumber = (value) => {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

module.exports = {
    formatNumber
}; 