// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Para hashear contraseñas
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos de sesión

// Recibe la instancia de la base de datos SQLite y el middleware de autenticación
module.exports = (sqliteDb, authenticateToken) => {

    // Ruta de registro de usuario
    router.post('/register', async (req, res) => {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Nombre de usuario, correo electrónico y contraseña son requeridos.' });
        }

        try {
            // Verificar si el email o username ya existen
            const existingUser = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT id FROM Usuarios WHERE email = ? OR nombre_usuario = ?`, [email, username], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (existingUser) {
                return res.status(409).json({ message: 'El correo electrónico o nombre de usuario ya está registrado.' });
            }

            const passwordHash = await bcrypt.hash(password, 10); // Hashear la contraseña
            const userId = uuidv4(); // Generar un ID único para el usuario
            const fechaRegistro = Date.now();
            const estado = 'activo';

            await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `INSERT INTO Usuarios (id, nombre_usuario, email, password_hash, fecha_registro, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, username, email, passwordHash, fechaRegistro, estado],
                    function(err) {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
            res.status(201).json({ message: 'Usuario registrado exitosamente.' });

        } catch (error) {
            console.error('Error al registrar usuario:', error);
            res.status(500).json({ message: 'Error en el servidor al registrar usuario.', error: error.message });
        }
    });

    // Ruta de inicio de sesión
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Correo electrónico y contraseña son requeridos.' });
        }

        try {
            const user = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT id, nombre_usuario, email, password_hash FROM Usuarios WHERE email = ?`, [email], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!user) {
                return res.status(401).json({ message: 'Credenciales inválidas: correo electrónico no encontrado.' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ message: 'Credenciales inválidas: contraseña incorrecta.' });
            }

            // En un entorno de producción, generarías un JWT aquí.
            // Para esta simulación local, el sessionToken será el propio userId.
            // Esto es *inseguro* para producción, pero funciona para el propósito local.
            const sessionToken = user.id;

            res.status(200).json({
                message: 'Inicio de sesión exitoso.',
                sessionToken: sessionToken,
                user: {
                    uid: user.id,
                    username: user.nombre_usuario,
                    email: user.email
                }
            });

        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            res.status(500).json({ message: 'Error en el servidor al iniciar sesión.', error: error.message });
        }
    });

    // Ruta para obtener perfil de usuario (protegida)
    router.get('/profile', authenticateToken, async (req, res) => {
        const userId = req.user.uid;

        try {
            const user = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT nombre_usuario, email FROM Usuarios WHERE id = ?`, [userId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!user) {
                return res.status(404).json({ message: 'Perfil de usuario no encontrado.' });
            }

            res.status(200).json({ profile: user });

        } catch (error) {
            console.error('Error al obtener perfil de usuario:', error);
            res.status(500).json({ message: 'Error en el servidor al obtener perfil.', error: error.message });
        }
    });

    // Ruta para actualizar perfil de usuario (protegida)
    router.put('/profile', authenticateToken, async (req, res) => {
        const userId = req.user.uid;
        const { username, email } = req.body;

        if (!username || !email) {
            return res.status(400).json({ message: 'Nombre de usuario y correo electrónico son requeridos.' });
        }

        try {
            // Verificar si el nuevo email o username ya existen en otro usuario
            const existingUser = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT id FROM Usuarios WHERE (email = ? OR nombre_usuario = ?) AND id != ?`, [email, username, userId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (existingUser) {
                return res.status(409).json({ message: 'El nuevo correo electrónico o nombre de usuario ya está en uso por otra cuenta.' });
            }

            const result = await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `UPDATE Usuarios SET nombre_usuario = ?, email = ? WHERE id = ?`,
                    [username, email, userId],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this);
                    }
                );
            });

            if (result.changes === 0) {
                // Podría significar que no se encontró el usuario o no hubo cambios
                return res.status(200).json({ message: 'Perfil de usuario actualizado exitosamente, o no se detectaron cambios.' });
            }

            res.status(200).json({ message: 'Perfil de usuario actualizado exitosamente.' });

        } catch (error) {
            console.error('Error al actualizar perfil de usuario:', error);
            res.status(500).json({ message: 'Error en el servidor al actualizar perfil.', error: error.message });
        }
    });

    // Ruta para cambiar contraseña (protegida)
    router.post('/change-password', authenticateToken, async (req, res) => {
        const userId = req.user.uid;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Contraseña actual y nueva contraseña son requeridas.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'La nueva contraseña no puede ser igual a la actual.' });
        }

        try {
            const user = await new Promise((resolve, reject) => {
                sqliteDb.get(`SELECT password_hash FROM Usuarios WHERE id = ?`, [userId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ message: 'La contraseña actual es incorrecta.' });
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 10);

            const result = await new Promise((resolve, reject) => {
                sqliteDb.run(
                    `UPDATE Usuarios SET password_hash = ? WHERE id = ?`,
                    [newPasswordHash, userId],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this);
                    }
                );
            });

            if (result.changes === 0) {
                return res.status(500).json({ message: 'No se pudo actualizar la contraseña.' });
            }

            res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });

        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.status(500).json({ message: 'Error en el servidor al cambiar contraseña.', error: error.message });
        }
    });

    // Ruta de cierre de sesión (simple, ya que la sesión es gestionada principalmente por el cliente)
    router.post('/logout', authenticateToken, (req, res) => {
        // En esta implementación local, el cierre de sesión principal es la eliminación del token en el cliente.
        // Aquí solo confirmamos que la solicitud fue procesada.
        res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
    });

    return router;
};
