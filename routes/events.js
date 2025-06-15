// routes/events.js

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos para eventos

// Recibe la instancia de la base de datos SQLite y el middleware de autenticación
module.exports = (sqliteDb, authenticateToken) => { // <--- Ya no recibe 'admin'

    // Ruta para añadir un nuevo evento
    router.post('/', authenticateToken, async (req, res) => {
        const { title, date, description } = req.body;
        const userId = req.user.uid; // ID del usuario autenticado

        if (!title || !date) {
            return res.status(400).json({ message: 'Título y fecha del evento son requeridos.' });
        }

        const eventId = uuidv4(); // Generar un ID único para el evento
        const createdAt = Date.now(); // Timestamp de creación
        const updatedAt = Date.now(); // Timestamp de actualización inicial

        try {
            // Guardar en SQLite
            await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `INSERT INTO events (id, userId, title, date, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [eventId, userId, title, date, description || null, createdAt, updatedAt], // description puede ser null
                    function(err) {
                        if (err) {
                            console.error('Error SQLite al insertar evento:', err.message); // Log más específico
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
            res.status(201).json({ message: 'Evento añadido exitosamente.', event: { id: eventId, title, date, description, createdAt, updatedAt } });
        } catch (error) {
            console.error('Error al añadir evento en SQLite:', error);
            res.status(500).json({ message: 'Error en el servidor al añadir evento.', error: error.message });
        }
    });

    // Ruta para obtener todos los eventos de un usuario
    router.get('/', authenticateToken, async (req, res) => {
        const userId = req.user.uid;

        try {
            const events = await new Promise((resolve, reject) => {
                sqliteDb.all(`SELECT id, title, date, description, createdAt, updatedAt FROM events WHERE userId = ? ORDER BY date ASC`, [userId], (err, rows) => {
                    if (err) {
                        console.error('Error SQLite al listar eventos:', err.message); // Log más específico
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
            res.status(200).json({ events });
        }
        catch (error) {
            console.error('Error al obtener eventos desde SQLite:', error);
            res.status(500).json({ message: 'Error en el servidor al obtener eventos.', error: error.message });
        }
    });

    // Ruta para actualizar un evento
    router.put('/:eventId', authenticateToken, async (req, res) => {
        const { eventId } = req.params;
        const { title, date, description } = req.body;
        const userId = req.user.uid;
        const updatedAt = Date.now(); // Timestamp de actualización

        if (!title || !date) {
            return res.status(400).json({ message: 'Título y fecha del evento son requeridos.' });
        }

        try {
            const result = await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `UPDATE events SET title = ?, date = ?, description = ?, updatedAt = ? WHERE id = ? AND userId = ?`,
                    [title, date, description || null, updatedAt, eventId, userId],
                    function(err) {
                        if (err) {
                            console.error('Error SQLite al actualizar evento:', err.message); // Log más específico
                            reject(err);
                        } else {
                            resolve(this); // 'this' contiene info sobre la operación (ej. this.changes)
                        }
                    }
                );
            });

            if (result.changes === 0) {
                return res.status(404).json({ message: 'Evento no encontrado o no tienes permiso para actualizarlo.' });
            }

            res.status(200).json({ message: 'Evento actualizado exitosamente.' });
        } catch (error) {
            console.error('Error al actualizar evento en SQLite:', error);
            res.status(500).json({ message: 'Error en el servidor al actualizar evento.', error: error.message });
        }
    });

    // Ruta para eliminar un evento
    router.delete('/:eventId', authenticateToken, async (req, res) => {
        const { eventId } = req.params;
        const userId = req.user.uid;

        try {
            const result = await new Promise((resolve, reject) => {
                sqliteDb.run(`DELETE FROM events WHERE id = ? AND userId = ?`, [eventId, userId], function(err) {
                    if (err) {
                        console.error('Error SQLite al eliminar evento:', err.message); // Log más específico
                        reject(err);
                    } else {
                        resolve(this); // 'this' contiene info sobre la operación (ej. this.changes)
                    }
                });
            });

            if (result.changes === 0) {
                return res.status(404).json({ message: 'Evento no encontrado o no tienes permiso para eliminarlo.' });
            }

            res.status(200).json({ message: 'Evento eliminado exitosamente.' });
        } catch (error) {
            console.error('Error al eliminar evento de SQLite:', error);
            res.status(500).json({ message: 'Error en el servidor al eliminar evento.', error: error.message });
        }
    });

    return router;
};
