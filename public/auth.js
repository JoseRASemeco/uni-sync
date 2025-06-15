// auth.js (Este es el archivo de frontend)

// URL base de tu backend. Ahora es relativa porque el backend sirve el frontend.
const BACKEND_URL = ''; // Vacío para rutas relativas al mismo origen

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm'); // Obtener el formulario de recuperación
    const messageBox = document.getElementById('messageBox');
    const logoutButton = document.getElementById('logoutButton');

    // Función para mostrar mensajes en el cuadro de mensaje
    function showMessage(element, message, type, duration = 5000) {
        element.textContent = message;
        // Ahora usa las clases de estilo del nuevo tema
        element.className = `mt-4 p-3 text-sm text-center rounded-lg ${type === 'success' ? 'message-success' : 'message-error'}`;
        element.classList.remove('hidden');
        if (duration > 0) {
            setTimeout(() => {
                element.classList.add('hidden');
            }, duration);
        }
    }

    // --- Manejar el registro ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                showMessage(messageBox, 'Las contraseñas no coinciden.', 'error');
                return;
            }

            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(messageBox, data.message, 'success');
                    setTimeout(() => {
                        window.location.href = 'login.html'; // Redirigir al login después del registro exitoso
                    }, 2000);
                } else {
                    showMessage(messageBox, data.message || 'Error en el registro.', 'error');
                }
            } catch (error) {
                console.error('Error de red durante el registro:', error);
                showMessage(messageBox, 'Error de conexión al servidor. Inténtalo de nuevo más tarde.', 'error');
            }
        });
    }

    // --- Manejar el inicio de sesión ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('sessionToken', data.sessionToken); // Guarda el token de sesión
                    localStorage.setItem('username', data.user.username); // Guarda el nombre de usuario
                    showMessage(messageBox, data.message, 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html'; // Redirigir al dashboard
                    }, 1000);
                } else {
                    showMessage(messageBox, data.message || 'Credenciales inválidas.', 'error');
                }
            } catch (error) {
                console.error('Error de red durante el inicio de sesión:', error);
                showMessage(messageBox, 'Error de conexión al servidor. Inténtalo de nuevo más tarde.', 'error');
            }
        });
    }

    // --- Manejar el restablecimiento de contraseña (local) ---
    // NOTA: En un entorno local sin un servicio de correo configurado,
    // esta función solo puede simular el envío o indicar al usuario que no es posible.
    // Para un restablecimiento real, necesitarías un backend con un servicio de correo.
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;

            // Aquí, en un escenario real, harías una llamada a tu backend para enviar el correo.
            // fetch(`${BACKEND_URL}/api/auth/reset-password-request`, { ... });

            // Para esta aplicación local, simulamos el éxito o indicamos la limitación.
            showMessage(messageBox, `Si "${email}" está registrado, se simularía el envío de un enlace de restablecimiento. Esta función no envía correos en el entorno local.`, 'success', 10000);
        });
    }


    // --- Manejar el cierre de sesión ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const sessionToken = localStorage.getItem('sessionToken');
                if (!sessionToken) {
                    showMessage(messageBox, 'No hay sesión activa para cerrar.', 'error');
                    return;
                }

                const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionToken}`
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.removeItem('sessionToken'); // Eliminar el token de sesión
                    localStorage.removeItem('username'); // Eliminar el nombre de usuario
                    console.log('Usuario cerró sesión.');
                    window.location.href = 'login.html'; // Redirigir al login
                } else {
                    console.error('Error al cerrar sesión en el backend:', data.message);
                    // Incluso si el backend falla, intentar limpiar el token localmente para permitir reintento
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('username');
                    window.location.href = 'login.html'; // Redirigir al login de todos modos
                }
            } catch (error) {
                console.error('Error de red al cerrar sesión:', error);
                // Si hay un error de red, igual limpiar el token local y redirigir
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            }
        });
    }
});
