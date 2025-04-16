const mysql = require('mysql2');
require('dotenv').config();

// Configuración de la conexión a la base de datos
const connection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'afdev',
    password: process.env.DB_PASSWORD || '@ioF4rg0#D3v',
    database: process.env.DB_NAME || 'parqueadero',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Función para conectar a la base de datos
const conectarDB = () => {
    connection.getConnection((err, conn) => {
        if (err) {
            console.error('Error al conectar a la base de datos:', err);
            return;
        }
        console.log('Conexión exitosa a la base de datos MySQL');
        conn.release();
    });
};

// Convertir callbacks a promesas
const promisePool = connection.promise();

module.exports = {
    connection: promisePool,
    conectarDB
}; 
