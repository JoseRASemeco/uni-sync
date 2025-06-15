// server.js

// Importar módulos necesarios
require('dotenv').config(); // Carga variables de entorno desde .env
const express = require('express');
const cors = require('cors'); // Middleware para habilitar Cross-Origin Resource Sharing (CORS)
const path = require('path'); // Módulo path para manejar rutas de archivos
const { initializeDatabase, getDb } = require('./database'); // Importar funciones de SQLite
const { v4: uuidv4 } = require('uuid'); // Para generar tokens de sesión simples si es necesario

// Inicializar la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000; // Puerto del servidor

// Directorio para guardar los archivos subidos
const UPLOADS_DIR = path.join(__dirname, 'uploads');
// Directorio para servir los archivos estáticos del frontend
// ¡IMPORTANTE! Asegúrate de que esta ruta sea CORRECTA para tu carpeta 'public'.
// __dirname apunta al directorio actual de server.js
const FRONTEND_DIR = path.join(__dirname, 'public');

// --- Middlewares ---
app.use(cors()); // Habilitar CORS para permitir solicitudes desde el frontend
app.use(express.json()); // Habilitar el parsing de JSON en las solicitudes

// Servir archivos estáticos del frontend desde la carpeta 'public'
// Esto hace que los archivos dentro de 'public' sean accesibles directamente por el navegador.
// Por ejemplo, 'public/index.htm' se vuelve 'http://localhost:3000/index.htm'
app.use(express.static(FRONTEND_DIR));
// Servir archivos subidos por los usuarios desde la carpeta 'uploads'
app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware de autenticación personalizado
// Este middleware verifica un 'sessionToken' simple guardado en localStorage del cliente.
// En un entorno de producción, esto sería reemplazado por JWTs o tokens más robustos y seguros.
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: 'No se proporcionó token de autenticación.' });
    }

    const sqliteDb = getDb();
    if (!sqliteDb) {
        console.error('Base de datos no inicializada en authenticateToken.');
        return res.status(500).json({ message: 'Error interno del servidor: base de datos no disponible.' });
    }

    try {
        // En esta implementación local, el 'token' ES el userId.
        // En una app real, desencriptarías un JWT y verificarías su firma.
        const userId = token;

        // Verificar si el userId existe en la base de datos de usuarios
        const user = await new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT id FROM Usuarios WHERE id = ?`, [userId], (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row);
            });
        });

        if (!user) {
            return res.status(403).json({ message: 'Token inválido o usuario no encontrado.' });
        }

        req.user = { uid: userId }; // Adjuntar el ID del usuario a la solicitud
        next();
    } catch (error) {
        console.error('Error en el middleware de autenticación:', error);
        return res.status(403).json({ message: 'Token de autenticación inválido o expirado.', error: error.message });
    }
};

// --- Inicialización de la Base de Datos y Rutas ---
async function startServer() {
    try {
        const sqliteDb = await initializeDatabase();

        // 2. Importar y asignar las rutas de la API, pasando la instancia de la base de datos
        const authRoutes = require('./routes/auth')(sqliteDb, authenticateToken);
        const fileRoutes = require('./routes/files')(sqliteDb, authenticateToken, UPLOADS_DIR);
        const eventRoutes = require('./routes/events')(sqliteDb, authenticateToken);

        // 3. Asignar las rutas a sus prefijos de API
        app.use('/api/auth', authRoutes);
        app.use('/api/files', fileRoutes);
        app.use('/api/events', eventRoutes);

        // Ruta de prueba para verificar que el backend está funcionando
        app.get('/api/status', (req, res) => {
            res.status(200).json({ message: 'UniSync Backend está funcionando con almacenamiento local y SQLite!' });
        });

        // Manejador de errores global para capturar cualquier error no manejado en las rutas
        app.use((err, req, res, next) => {
            console.error(err.stack); // Imprimir el stack trace del error en la consola del servidor
            res.status(500).send('Algo salió mal en el servidor!'); // Enviar una respuesta de error genérica al cliente
        });

        // 4. Iniciar el servidor Express
        app.listen(PORT, () => {
            console.log(`Servidor backend de UniSync corriendo en http://localhost:${PORT}`);
            console.log(`Frontend disponible en http://localhost:${PORT}/index.htm`); // Informar la URL del frontend
        });

    } catch (error) {
        console.error('Error FATAL al iniciar el servidor o la base de datos:', error);
        process.exit(1); // Salir de la aplicación con un código de error
    }
}

startServer();
