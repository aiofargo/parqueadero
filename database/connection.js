const mysql = require('mysql2/promise');

// Configuración de la conexión
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '@ioF4rg0#D3v',
    database: 'parqueadero',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para obtener una conexión del pool
const getConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Conexión exitosa a la base de datos');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        throw error;
    }
};

// Función para conectar inicialmente a la base de datos
const conectarDB = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Conexión inicial exitosa a la base de datos');
        connection.release();
    } catch (error) {
        console.error('Error al conectar inicialmente a la base de datos:', error);
        throw error;
    }
};

// Función para ejecutar consultas
const executeQuery = async (query, params = []) => {
    try {
        const [rows] = await pool.execute(query, params);
        return rows;
    } catch (error) {
        console.error('Error al ejecutar la consulta:', error);
        throw error;
    }
};

module.exports = {
    getConnection,
    conectarDB,
    executeQuery,
    pool
}; 
