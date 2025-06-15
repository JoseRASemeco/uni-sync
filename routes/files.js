// routes/files.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs/promises'); // Módulo para operaciones de sistema de archivos
const path = require('path'); // Módulo path
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos para archivos

// Modificación de Multer para almacenar en disco
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = req.app.get('uploadDir'); // Obtenemos el directorio de cargas
        fs.mkdir(uploadDir, { recursive: true }) // Asegura que el directorio exista
            .then(() => cb(null, uploadDir))
            .catch(err => cb(err));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // Límite de 50MB por archivo
    }
});

// Ahora el módulo exporta una función que recibe db, authenticateToken y uploadDir
module.exports = (sqliteDb, authenticateToken, uploadDir) => {
    // Añadimos el directorio de uploads a la aplicación Express para que Multer lo pueda acceder
    router.use((req, res, next) => {
        req.app.set('uploadDir', uploadDir);
        next();
    });

    // Ruta para subir archivos
    router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'No se proporcionó ningún archivo.' });
        }

        const userId = req.user.uid;
        const file = req.file;
        const fileId = uuidv4(); // Generar un ID único para el archivo en la DB
        const storageName = file.filename; // Nombre con el que Multer lo guardó en disco

        try {
            // La URL para acceder al archivo será http://localhost:3000/uploads/nombre_del_archivo
            const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
            const fechaSubida = Date.now(); // Timestamp en milisegundos

            // Guardar metadatos del archivo en SQLite
            await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `INSERT INTO Archivos (id, nombre_archivo, ruta_almacenamiento, tipo_mime, tamaño, id_usuario_propietario, fecha_subida, descripcion, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [fileId, file.originalname, storageName, file.mimetype, file.size, userId, fechaSubida, '', fileUrl], // Descripción vacía por defecto
                    function(err) {
                        if (err) {
                            console.error('Error SQLite al insertar archivo:', err.message); // Log más específico
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });

            res.status(201).json({
                message: 'Archivo subido exitosamente.',
                file: {
                    id: fileId,
                    name: file.originalname,
                    size: file.size,
                    url: fileUrl,
                    type: file.mimetype, // Incluir el tipo mime para previsualización
                    uploadedAt: fechaSubida
                }
            });

        } catch (error) {
            console.error('Error al subir archivo y guardar metadatos en SQLite (tabla Archivos):', error);
            // Si falla la DB, intentar eliminar el archivo del disco para evitar huérfanos
            const filePath = path.join(uploadDir, storageName);
            await fs.unlink(filePath).catch(unlinkErr => console.error('Error al limpiar archivo en disco tras fallo de DB:', unlinkErr));
            res.status(500).json({ message: 'Error en el servidor al subir archivo.', error: error.message });
        }
    });

    // Ruta para listar archivos del usuario
    router.get('/', authenticateToken, async (req, res) => {
        const userId = req.user.uid;

        try {
            const files = await new Promise((resolve, reject) => {
                sqliteDb.all(`SELECT id, nombre_archivo AS name, tamaño AS size, url, fecha_subida AS uploadedAt, tipo_mime AS type, descripcion FROM Archivos WHERE id_usuario_propietario = ?`, [userId], (err, rows) => {
                    if (err) {
                        console.error('Error SQLite al listar archivos:', err.message); // Log más específico
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
            res.status(200).json({ files });
        } catch (error) {
            console.error('Error al listar archivos desde SQLite (tabla Archivos):', error);
            res.status(500).json({ message: 'Error en el servidor al listar archivos.', error: error.message });
        }
    });

    // Ruta para eliminar un archivo
    router.delete('/:fileId', authenticateToken, async (req, res) => {
        const { fileId } = req.params;
        const userId = req.user.uid;
        const uploadDir = req.app.get('uploadDir');

        try {
            // Obtener metadatos del archivo de tu tabla 'Archivos' de SQLite
            const fileData = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT ruta_almacenamiento AS storageName FROM Archivos WHERE id = ? AND id_usuario_propietario = ?`, [fileId, userId], (err, row) => {
                    if (err) {
                        console.error('Error SQLite al buscar archivo para eliminar:', err.message); // Log más específico
                        reject(err);
                    } else if (!row) {
                        resolve(null); // Archivo no encontrado o no pertenece al usuario
                    } else {
                        resolve(row);
                    }
                });
            });

            if (!fileData) {
                return res.status(404).json({ message: 'Archivo no encontrado o no tienes permiso para eliminarlo.' });
            }

            // Eliminar el archivo del disco
            const filePath = path.join(uploadDir, fileData.storageName);
            await fs.unlink(filePath).catch(err => {
                if (err.code === 'ENOENT') {
                    console.warn(`Archivo en disco no encontrado para eliminar: ${filePath}`);
                } else {
                    throw err; // Re-lanzar otros errores de eliminación de archivo
                }
            });

            // Eliminar los metadatos del archivo de tu tabla 'Archivos' de SQLite
            await new Promise((resolve, reject) => {
                sqliteDb.run(`DELETE FROM Archivos WHERE id = ?`, [fileId], function(err) {
                    if (err) {
                        console.error('Error SQLite al eliminar archivo de DB:', err.message); // Log más específico
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('No se pudo eliminar el archivo de la base de datos.'));
                    } else {
                        resolve();
                    }
                });
            });

            res.status(200).json({ message: 'Archivo eliminado exitosamente.' });

        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            res.status(500).json({ message: 'Error en el servidor al eliminar archivo.', error: error.message });
        }
    });

    // Ruta para descargar un archivo (simplemente retorna la URL local)
    router.get('/:fileId/download', authenticateToken, async (req, res) => {
        const { fileId } = req.params;
        const userId = req.user.uid;

        try {
            const fileData = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT url FROM Archivos WHERE id = ? AND id_usuario_propietario = ?`, [fileId, userId], (err, row) => {
                    if (err) {
                        console.error('Error SQLite al buscar URL de descarga:', err.message); // Log más específico
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });

            if (!fileData) {
                return res.status(404).json({ message: 'Archivo no encontrado o no tienes permiso para descargarlo.' });
            }

            res.status(200).json({ downloadUrl: fileData.url });

        } catch (error) {
            console.error('Error al generar URL de descarga desde SQLite (tabla Archivos):', error);
            res.status(500).json({ message: 'Error en el servidor al generar URL de descarga.', error: error.message });
        }
    });

    // NUEVA RUTA: Actualizar metadatos del archivo (ej. nombre, descripción)
    router.put('/:fileId', authenticateToken, async (req, res) => {
        const { fileId } = req.params;
        const { name, description } = req.body; // Campos que se pueden actualizar
        const userId = req.user.uid;

        if (!name) {
            return res.status(400).json({ message: 'El nombre del archivo es requerido.' });
        }

        try {
            const result = await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `UPDATE Archivos SET nombre_archivo = ?, descripcion = ? WHERE id = ? AND id_usuario_propietario = ?`,
                    [name, description || '', fileId, userId],
                    function(err) {
                        if (err) {
                            console.error('ERROR SQLite al actualizar archivo:', err.message);
                            reject(err);
                        } else {
                            resolve(this);
                        }
                    }
                );
            });

            if (result.changes === 0) {
                return res.status(404).json({ message: 'Archivo no encontrado o no tienes permiso para actualizarlo.' });
            }

            res.status(200).json({ message: 'Metadatos del archivo actualizados exitosamente.' });

        } catch (error) {
            console.error('Error al actualizar metadatos del archivo:', error);
            res.status(500).json({ message: 'Error en el servidor al actualizar metadatos del archivo.', error: error.message });
        }
    });

    return router;
};
