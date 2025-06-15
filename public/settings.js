// settings.js (Frontend)

// URL base de tu backend. Es relativa porque el backend sirve el frontend.
const BACKEND_URL = ''; // Vacío para rutas relativas al mismo origen

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profileForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const messageBox = document.getElementById('messageBox');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    const logoutButton = document.getElementById('logoutButton');

    const changePasswordForm = document.getElementById('changePasswordForm');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const passwordResetMessageBox = document.getElementById('passwordResetMessage'); // Usado para mensajes de cambio de contraseña

    // Función para mostrar mensajes
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

    // --- Gestión de Autenticación Local ---
    let sessionToken = localStorage.getItem('sessionToken');
    let currentUsername = localStorage.getItem('username'); // Podrías almacenar más datos si es necesario

    // Verificar si hay un token de sesión. Si no, redirigir al login.
    if (!sessionToken) {
        window.location.href = 'login.html';
        return; // Detener la ejecución del script si no hay sesión
    } else {
        fetchUserProfile(); // Cargar el perfil del usuario
    }

    // Manejar el cierre de sesión
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionToken}`
                    }
                });

                if (response.ok) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('username');
                    window.location.href = 'login.html';
                } else {
                    const data = await response.json();
                    showMessage(messageBox, data.message || 'ERROR AL CERRAR SESIÓN.', 'error');
                }
            } catch (error) {
                console.error('Error de red al cerrar sesión:', error);
                showMessage(messageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL CERRAR SESIÓN.', 'error');
                // Aunque haya error de red, limpiar sesión localmente para evitar bucles
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            }
        });
    }

    // --- Funciones de Perfil de Usuario ---

    // Función para obtener y mostrar el perfil del usuario desde el backend
    async function fetchUserProfile() {
        loadingMessage.classList.remove('hidden');
        profileForm.classList.add('hidden'); // Ocultar hasta que se cargue

        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                usernameInput.value = data.profile.nombre_usuario || '';
                emailInput.value = data.profile.email || '';
                profileForm.classList.remove('hidden'); // Mostrar el formulario
                loadingMessage.classList.add('hidden'); // Ocultar mensaje de carga
                errorMessage.classList.add('hidden'); // Ocultar mensaje de error
            } else {
                console.error('Error al cargar perfil del backend:', data.message);
                showMessage(errorMessage, data.message || 'ERROR AL CARGAR EL PERFIL.', 'error');
                loadingMessage.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error de red al obtener perfil:', error);
            showMessage(errorMessage, 'ERROR DE CONEXIÓN AL SERVIDOR AL CARGAR EL PERFIL.', 'error');
            loadingMessage.classList.add('hidden');
        }
    }

    // Manejar el envío del formulario de actualización de perfil
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newUsername = usernameInput.value;
        const newEmail = emailInput.value;

        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ username: newUsername, email: newEmail })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(messageBox, data.message || 'PERFIL ACTUALIZADO EXITOSAMENTE.', 'success');
                // Actualizar el nombre de usuario almacenado localmente si ha cambiado
                if (currentUsername !== newUsername) {
                    localStorage.setItem('username', newUsername);
                }
                // Recargar el perfil para asegurar que los inputs muestren los últimos datos
                fetchUserProfile();
            } else {
                console.error('Error del backend al actualizar perfil:', data.message);
                showMessage(messageBox, data.message || 'ERROR AL ACTUALIZAR EL PERFIL EN EL SERVIDOR.', 'error');
            }
        } catch (error) {
            console.error('Error de red al actualizar perfil:', error);
            showMessage(messageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL ACTUALIZAR PERFIL.', 'error');
        }
    });

    // --- Funciones de Cambio de Contraseña (Local) ---
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        if (newPassword !== confirmNewPassword) {
            showMessage(passwordResetMessageBox, 'LA NUEVA CONTRASEÑA Y LA CONFIRMACIÓN NO COINCIDEN.', 'error');
            return;
        }

        if (currentPassword === newPassword) {
            showMessage(passwordResetMessageBox, 'LA NUEVA CONTRASEÑA NO PUEDE SER IGUAL A LA ACTUAL.', 'error');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(passwordResetMessageBox, data.message || 'CONTRASEÑA ACTUALIZADA EXITOSAMENTE.', 'success');
                changePasswordForm.reset(); // Limpiar el formulario
            } else {
                console.error('Error al cambiar contraseña:', data.message);
                showMessage(passwordResetMessageBox, data.message || 'ERROR AL CAMBIAR LA CONTRASEÑA.', 'error');
            }
        } catch (error) {
            console.error('Error de red al cambiar contraseña:', error);
            showMessage(passwordResetMessageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL CAMBIAR CONTRASEÑA.', 'error');
        }
    });
});
