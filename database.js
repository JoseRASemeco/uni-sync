// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // Para asegurar que el directorio exista

// Ruta al archivo de la base de datos SQLite
// Se guarda en una carpeta 'data' dentro del directorio del servidor para portabilidad
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'uni-sync.db');

let db;

// Función para inicializar la base de datos y crear tablas si no existen
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Asegurarse de que el directorio 'data' exista
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }

        db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error al abrir/crear la base de datos SQLite:', err.message);
                reject(err);
            } else {
                console.log('Conectado a la base de datos SQLite:', DB_PATH);
                // Crear tablas si no existen, con tu esquema
                db.serialize(() => {
                    // Tabla Usuarios (CRÍTICO: id TEXT PRIMARY KEY para UID de Firebase o ID de sesión)
                    // Se añade un campo para la contraseña hasheada
                    db.run(`CREATE TABLE IF NOT EXISTS Usuarios (
                        id TEXT PRIMARY KEY, -- Usaremos un ID de sesión/UID autogenerado
                        nombre_usuario TEXT NOT NULL UNIQUE,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL, -- Nuevo campo para la contraseña hasheada
                        fecha_registro INTEGER NOT NULL, -- Almacenar como timestamp
                        estado TEXT
                    )`, (err) => {
                        if (err) {
                            console.error('Error al crear tabla Usuarios:', err.message);
                            reject(err);
                        } else {
                            console.log('Tabla Usuarios verificada/creada.');
                        }
                    });

                    // Tabla Archivos (id_usuario_propietario TEXT)
                    db.run(`CREATE TABLE IF NOT EXISTS Archivos (
                        id TEXT PRIMARY KEY,
                        nombre_archivo TEXT NOT NULL,
                        ruta_almacenamiento TEXT NOT NULL, -- Nombre en el disco
                        tipo_mime TEXT NOT NULL,
                        tamaño INTEGER NOT NULL,
                        id_usuario_propietario TEXT NOT NULL,
                        fecha_subida INTEGER NOT NULL,
                        descripcion TEXT,
                        url TEXT NOT NULL, -- URL para acceder al archivo
                        FOREIGN KEY (id_usuario_propietario) REFERENCES Usuarios(id) ON DELETE CASCADE
                    )`, (err) => {
                        if (err) {
                            console.error('Error al crear tabla Archivos:', err.message);
                            reject(err);
                        } else {
                            console.log('Tabla Archivos verificada/creada.');
                        }
                    });

                    // Tabla Compartidos (si la necesitas)
                    db.run(`CREATE TABLE IF NOT EXISTS Compartidos (
                        id TEXT PRIMARY KEY,
                        id_archivo TEXT NOT NULL,
                        id_usuario_compartido_con TEXT NOT NULL,
                        fecha_compartido INTEGER NOT NULL,
                        permisos TEXT,
                        FOREIGN KEY (id_archivo) REFERENCES Archivos(id) ON DELETE CASCADE,
                        FOREIGN KEY (id_usuario_compartido_con) REFERENCES Usuarios(id) ON DELETE CASCADE
                    )`, (err) => {
                        if (err) {
                            console.error('Error al crear tabla Compartidos:', err.message);
                            reject(err);
                        } else {
                            console.log('Tabla Compartidos verificada/creada.');
                        }
                    });

                    // Tabla Events (userId TEXT)
                    db.run(`CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        userId TEXT NOT NULL,
                        title TEXT NOT NULL,
                        date TEXT NOT NULL, -- Almacenar como 'YYYY-MM-DD'
                        description TEXT,
                        createdAt INTEGER,
                        updatedAt INTEGER,
                        FOREIGN KEY (userId) REFERENCES Usuarios(id) ON DELETE CASCADE
                    )`, (err) => {
                        if (err) {
                            console.error('Error al crear tabla events:', err.message);
                            reject(err);
                        } else {
                            console.log('Tabla events verificada/creada.');
                            resolve(db);
                        }
                    });
                });
            }
        });
    });
}

// Exportar la función de inicialización y la instancia de la base de datos
module.exports = {
    initializeDatabase,
    getDb: () => db
};
