// dashboard.js (Frontend - Completamente offline)

// URL base de tu backend. Es relativa porque el backend sirve el frontend.
const BACKEND_URL = ''; // Vacío para rutas relativas al mismo origen

document.addEventListener('DOMContentLoaded', () => {
    // Elementos de la interfaz general
    const userNameDisplay = document.getElementById('userNameDisplay');
    const logoutButton = document.getElementById('logoutButton');
    const messageBox = document.getElementById('messageBox'); // Mensaje general de la página

    // Elementos de las pestañas
    const filesTab = document.getElementById('filesTab');
    const calendarTab = document.getElementById('calendarTab');
    const filesContent = document.getElementById('filesContent');
    const calendarContent = document.getElementById('calendarContent');

    // Elementos de la sección de Archivos
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const fileList = document.getElementById('fileList');
    const uploadStatus = document.getElementById('uploadStatus');

    // Elementos del modal de Archivo
    const fileModal = document.getElementById('fileModal');
    const fileModalTitle = document.getElementById('fileModalTitle');
    const fileModalContent = document.getElementById('fileModalContent');
    const editFileForm = document.getElementById('editFileForm');
    const editFileNameInput = document.getElementById('editFileName');
    const editFileDescriptionInput = document.getElementById('editFileDescription');
    const viewFileButton = document.getElementById('viewFileButton');
    const editMetadataButton = document.getElementById('editMetadataButton');
    const deleteFileButton = document.getElementById('deleteFileButton');
    const closeFileModalButton = document.getElementById('closeFileModalButton');
    const fileModalMessageBox = document.getElementById('fileModalMessageBox');

    // Elementos de la sección de Calendario
    const currentMonthYear = document.getElementById('currentMonthYear');
    const prevMonthButton = document.getElementById('prevMonth');
    const nextMonthButton = document.getElementById('nextMonth');
    const calendarDays = document.getElementById('calendarDays');
    const eventList = document.getElementById('eventList');
    const addEventButton = document.getElementById('addEventButton');

    // Elementos del modal de Evento
    const eventModal = document.getElementById('eventModal');
    const eventModalTitle = document.getElementById('eventModalTitle');
    const eventForm = document.getElementById('eventForm');
    const eventTitleInput = document.getElementById('eventTitle');
    const eventDateInput = document.getElementById('eventDate');
    const eventDescriptionInput = document.getElementById('eventDescription');
    const saveEventButton = document.getElementById('saveEventButton');
    const cancelEventButton = document.getElementById('cancelEventButton');
    const eventModalMessageBox = document.getElementById('eventModalMessageBox');

    // Modal de Confirmación Genérico
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmYesButton = document.getElementById('confirmYes');
    const confirmNoButton = document.getElementById('confirmNo');

    // Variables de estado
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let selectedDate = null; // Fecha seleccionada en el calendario (YYYY-MM-DD)
    let selectedEventId = null; // ID del evento que se está editando
    let selectedFileId = null; // ID del archivo que se está gestionando en el modal

    // --- Funciones Auxiliares ---

    // Función para mostrar mensajes en un elemento específico
    function showMessage(element, message, type, duration = 5000) {
        element.textContent = message;
        element.className = `mt-4 p-3 text-sm text-center rounded-lg ${type === 'success' ? 'message-success' : 'message-error'}`;
        element.classList.remove('hidden');
        if (duration > 0) {
            setTimeout(() => {
                element.classList.add('hidden');
            }, duration);
        }
    }

    // Función para mostrar el modal de confirmación genérico
    function showConfirmationModal(message) {
        return new Promise((resolve) => {
            confirmationMessage.textContent = message;
            confirmationModal.classList.remove('hidden');

            const handleYes = () => {
                confirmationModal.classList.add('hidden');
                confirmYesButton.removeEventListener('click', handleYes);
                confirmNoButton.removeEventListener('click', handleNo);
                resolve(true);
            };

            const handleNo = () => {
                confirmationModal.classList.add('hidden');
                confirmYesButton.removeEventListener('click', handleYes);
                confirmNoButton.removeEventListener('click', handleNo);
                resolve(false);
            };

            confirmYesButton.addEventListener('click', handleYes);
            confirmNoButton.addEventListener('click', handleNo);
        });
    }

    // --- Gestión de Autenticación Local ---
    const sessionToken = localStorage.getItem('sessionToken');
    const currentUsername = localStorage.getItem('username');

    // Verificar si hay un token de sesión. Si no, redirigir al login.
    if (!sessionToken) {
        window.location.href = 'login.html';
        return; // Detener la ejecución del script si no hay sesión
    } else {
        if (userNameDisplay && currentUsername) {
            userNameDisplay.textContent = `¡Hola, ${currentUsername}!`;
        }
        // Inicializar la interfaz después de verificar la sesión
        initializeTabs();
        loadFiles(); // Cargar archivos al inicio
        renderCalendar(); // Renderizar calendario al inicio
        loadEvents(null); // Cargar todos los eventos para marcar días
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

                const data = await response.json();

                if (response.ok) {
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('username');
                    window.location.href = 'login.html';
                } else {
                    console.error('Error al cerrar sesión en el backend:', data.message);
                    showMessage(messageBox, data.message || 'ERROR AL CERRAR SESIÓN.', 'error');
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('username');
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error('Error de red al cerrar sesión:', error);
                showMessage(messageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL CERRAR SESIÓN.', 'error');
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            }
        });
    }

    // --- Lógica de Pestañas ---
    function initializeTabs() {
        filesTab.addEventListener('click', () => {
            filesTab.classList.add('active');
            calendarTab.classList.remove('active');
            filesContent.classList.add('active');
            calendarContent.classList.remove('active');
            loadFiles(); // Recargar archivos cada vez que se selecciona la pestaña
        });

        calendarTab.addEventListener('click', () => {
            calendarTab.classList.add('active');
            filesTab.classList.remove('active');
            calendarContent.classList.add('active');
            filesContent.classList.remove('active');
            renderCalendar(); // Asegurar que el calendario se renderice/actualice
            loadEvents(selectedDate); // Cargar eventos para la fecha seleccionada o todos
        });
    }

    // --- Funciones de Gestión de Archivos ---

    // Función para cargar y mostrar archivos
    async function loadFiles() {
        fileList.innerHTML = '<div class="file-item p-4 rounded-lg text-gray-400 text-center">CARGANDO ARCHIVOS...</div>';
        try {
            const response = await fetch(`${BACKEND_URL}/api/files`, {
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                }
            });
            const data = await response.json();

            if (response.ok) {
                fileList.innerHTML = ''; // Limpiar lista actual
                if (data.files && data.files.length > 0) {
                    data.files.forEach(file => {
                        const listItem = document.createElement('div'); // Usar div en lugar de li para mejor control de estilo
                        listItem.className = 'file-item p-4 rounded-lg cursor-pointer';
                        listItem.dataset.fileId = file.id; // Almacena el ID del archivo
                        listItem.innerHTML = `
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="font-semibold text-white">${file.name}</h4>
                                    <p class="text-sm text-gray-400">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                                <div class="text-green-400">📄</div>
                            </div>
                        `;
                        // Añadir listener para abrir el modal al hacer clic en el archivo
                        listItem.addEventListener('click', () => showFileModal(file.id));
                        fileList.appendChild(listItem);
                    });
                } else {
                    fileList.innerHTML = '<div class="file-item p-4 rounded-lg text-gray-400 text-center">NO HAY ARCHIVOS SUBIDOS.</div>';
                }
            } else {
                console.error('Error al cargar archivos:', data.message);
                showMessage(uploadStatus, data.message || 'ERROR AL CARGAR LOS ARCHIVOS.', 'error');
            }
        } catch (error) {
            console.error('Error de red al cargar archivos:', error);
            showMessage(uploadStatus, 'ERROR DE CONEXIÓN AL SERVIDOR AL CARGAR ARCHIVOS.', 'error');
        }
    }

    // Manejar la subida de archivos
    uploadButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            showMessage(uploadStatus, 'POR FAVOR, SELECCIONA UN ARCHIVO PARA SUBIR.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        showMessage(uploadStatus, 'SUBIENDO ARCHIVO...', 'success', 0); // Mostrar mensaje de carga indefinidamente

        try {
            const response = await fetch(`${BACKEND_URL}/api/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(uploadStatus, data.message, 'success');
                fileInput.value = ''; // Limpiar el input de archivo
                loadFiles(); // Recargar la lista de archivos
            } else {
                console.error('Error al subir archivo:', data.message);
                showMessage(uploadStatus, data.message || 'ERROR AL SUBIR EL ARCHIVO.', 'error');
            }
        } catch (error) {
            console.error('Error de red al subir archivo:', error);
            showMessage(uploadStatus, 'ERROR DE CONEXIÓN AL SERVIDOR AL SUBIR ARCHIVO.', 'error');
        }
    });

    // Función para mostrar el modal de archivo (centraliza ver/editar/eliminar)
    async function showFileModal(fileId) {
        fileModal.classList.remove('hidden');
        fileModalMessageBox.classList.add('hidden'); // Ocultar mensajes previos
        editFileForm.classList.add('hidden'); // Ocultar formulario de edición por defecto
        fileModalContent.classList.remove('hidden'); // Mostrar contenido de previsualización

        selectedFileId = fileId; // Guarda el ID para el modal

        try {
            const response = await fetch(`${BACKEND_URL}/api/files/${fileId}`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            const data = await response.json();

            if (response.ok) {
                const file = data.file;
                fileModalTitle.textContent = `DETALLES DE: ${file.name.toUpperCase()}`;
                editFileNameInput.value = file.name;
                editFileDescriptionInput.value = file.description || '';

                fileModalContent.innerHTML = `
                    <div class="space-y-2 text-sm">
                        <p><span class="font-bold text-green-400">NOMBRE:</span> <span class="font-normal text-gray-300">${file.name}</span></p>
                        <p><span class="font-bold text-green-400">TIPO:</span> <span class="font-normal text-gray-300">${file.type}</span></p>
                        <p><span class="font-bold text-green-400">TAMAÑO:</span> <span class="font-normal text-gray-300">${(file.size / (1024 * 1024)).toFixed(2)} MB</span></p>
                        <p><span class="font-bold text-green-400">SUBIDO:</span> <span class="font-normal text-gray-300">${new Date(file.uploadedAt).toLocaleDateString()}</span></p>
                        <p><span class="font-bold text-green-400">DESCRIPCIÓN:</span> <span class="font-normal text-gray-300">${file.description || 'N/A'}</span></p>
                    </div>
                `;
            } else {
                fileModalTitle.textContent = 'ERROR AL CARGAR ARCHIVO';
                fileModalContent.textContent = data.message || 'NO SE PUDO CARGAR LOS DETALLES DEL ARCHIVO.';
                showMessage(fileModalMessageBox, data.message || 'ERROR AL CARGAR EL ARCHIVO.', 'error');
            }
        } catch (error) {
            console.error('Error de red al cargar detalles del archivo:', error);
            fileModalTitle.textContent = 'ERROR DE CONEXIÓN';
            fileModalContent.textContent = 'ERROR DE CONEXIÓN AL SERVIDOR AL CARGAR LOS DETALLES DEL ARCHIVO.';
            showMessage(fileModalMessageBox, 'ERROR DE CONEXIÓN AL SERVIDOR.', 'error');
        }
    }

    // Botones del modal de archivo
    viewFileButton.addEventListener('click', async () => {
        if (!selectedFileId) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/files/${selectedFileId}/download`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            const data = await response.json();

            if (response.ok && data.downloadUrl) {
                window.open(data.downloadUrl, '_blank');
            } else {
                showMessage(fileModalMessageBox, data.message || 'ERROR AL OBTENER URL DEL ARCHIVO.', 'error');
            }
        } catch (error) {
            console.error('Error de red al ver archivo:', error);
            showMessage(fileModalMessageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL VER ARCHIVO.', 'error');
        }
    });

    editMetadataButton.addEventListener('click', () => {
        fileModalContent.classList.add('hidden'); // Ocultar el contenido de previsualización
        editFileForm.classList.remove('hidden'); // Mostrar el formulario de edición
        fileModalMessageBox.classList.add('hidden'); // Ocultar mensajes previos del modal
    });

    deleteFileButton.addEventListener('click', async () => {
        const confirmed = await showConfirmationModal('¿ESTÁS SEGURO DE QUE QUIERES ELIMINAR ESTE ARCHIVO PERMANENTEMENTE?');
        if (confirmed && selectedFileId) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/files/${selectedFileId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${sessionToken}` }
                });

                const data = await response.json();
                if (response.ok) {
                    showMessage(messageBox, data.message, 'success'); // Mensaje en el dashboard principal
                    fileModal.classList.add('hidden'); // Cerrar modal
                    selectedFileId = null; // Limpiar ID seleccionado
                    loadFiles(); // Recargar la lista de archivos
                } else {
                    showMessage(fileModalMessageBox, data.message || 'ERROR AL ELIMINAR ARCHIVO.', 'error');
                }
            } catch (error) {
                console.error('Error de red al eliminar archivo:', error);
                showMessage(fileModalMessageBox, 'ERROR DE CONEXIÓN AL ELIMINAR ARCHIVO.', 'error');
            }
        }
    });

    closeFileModalButton.addEventListener('click', () => {
        fileModal.classList.add('hidden');
        selectedFileId = null;
    });

    // Manejar el envío del formulario de edición de metadatos
    editFileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFileId) return;

        const newFileName = editFileNameInput.value;
        const newFileDescription = editFileDescriptionInput.value;

        try {
            const response = await fetch(`${BACKEND_URL}/api/files/${selectedFileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ name: newFileName, description: newFileDescription })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(fileModalMessageBox, data.message, 'success');
                editFileForm.classList.add('hidden'); // Ocultar formulario
                fileModalContent.classList.remove('hidden'); // Mostrar contenido
                loadFiles(); // Recargar la lista de archivos para ver el cambio
                // Re-mostrar los detalles actualizados en el modal
                await showFileModal(selectedFileId);
            } else {
                showMessage(fileModalMessageBox, data.message || 'ERROR AL ACTUALIZAR METADATOS.', 'error');
            }
        } catch (error) {
            console.error('Error de red al actualizar metadatos:', error);
            showMessage(fileModalMessageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL ACTUALIZAR METADATOS.', 'error');
        }
    });

    // --- Funciones de Calendario y Eventos ---

    // Función para renderizar el calendario
    function renderCalendar() {
        calendarDays.innerHTML = ''; // Limpiar días anteriores
        const date = new Date(currentYear, currentMonth);
        currentMonthYear.textContent = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Domingo, 1 = Lunes...
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Rellenar días del mes anterior (celdas vacías)
        for (let i = 0; i < firstDayOfMonth; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day other-month';
            calendarDays.appendChild(dayElement);
        }

        // Rellenar días del mes actual
        for (let i = 1; i <= daysInMonth; i++) {
            const dayElement = document.createElement('div');
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            dayElement.textContent = i;
            dayElement.dataset.fullDate = dateStr;

            const today = new Date();
            const isToday = (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());
            
            // Determina las clases iniciales
            let classes = 'calendar-day current-month';
            if (isToday) {
                classes += ' today';
                if (!selectedDate) { // Seleccionar hoy por defecto si no hay fecha seleccionada
                    selectedDate = dateStr;
                }
            }
            if (selectedDate === dateStr) {
                classes += ' selected';
            }

            dayElement.className = classes;

            dayElement.addEventListener('click', () => {
                // Eliminar selección previa
                document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
                dayElement.classList.add('selected');
                selectedDate = dateStr; // Actualizar la fecha seleccionada
                loadEvents(selectedDate); // Cargar eventos para el día seleccionado
            });
            calendarDays.appendChild(dayElement);
        }

        // Rellenar días del mes siguiente (celdas vacías para completar la cuadrícula)
        const totalDaysRendered = firstDayOfMonth + daysInMonth;
        const daysToFill = (7 - (totalDaysRendered % 7)) % 7; // Días para completar la última fila de la semana

        for (let i = 1; i <= daysToFill; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day other-month';
            calendarDays.appendChild(dayElement);
        }

        // Después de renderizar los días, cargar eventos para marcar días con eventos
        loadEvents(selectedDate);
    }

    // Funciones para cambiar de mes
    prevMonthButton.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        selectedDate = null; // Reiniciar la selección al cambiar de mes
        renderCalendar();
    });

    nextMonthButton.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        selectedDate = null; // Reiniciar la selección al cambiar de mes
        renderCalendar();
    });

    // Función para cargar y mostrar eventos para una fecha específica o todos
    async function loadEvents(date = null) {
        eventList.innerHTML = '<p class="text-gray-400 text-center py-8">CARGANDO EVENTOS...</p>';
        try {
            const response = await fetch(`${BACKEND_URL}/api/events`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            const data = await response.json();

            if (response.ok) {
                const allEvents = data.events;
                eventList.innerHTML = ''; // Limpiar lista
                
                let eventsToShow = allEvents;
                if (date) {
                    eventsToShow = allEvents.filter(event => event.date === date);
                }

                if (eventsToShow.length > 0) {
                    eventsToShow.forEach(event => {
                        const listItem = document.createElement('div'); // Usar div en lugar de li
                        listItem.className = 'event-item p-4 rounded-lg flex justify-between items-start text-gray-300';
                        listItem.innerHTML = `
                            <div>
                                <h4 class="font-semibold text-white">${event.title}</h4>
                                <p class="text-sm text-gray-400 mt-1">${event.description || 'Sin descripción'}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button data-event-id="${event.id}" data-action="edit" class="text-yellow-400 hover:text-yellow-200 text-xs font-bold">✏️</button>
                                <button data-event-id="${event.id}" data-action="delete" class="text-red-400 hover:text-red-200 text-xs font-bold">🗑️</button>
                            </div>
                        `;
                        eventList.appendChild(listItem);
                    });
                } else {
                    eventList.innerHTML = '<p class="text-gray-400 text-center py-8">No hay eventos para este día.</p>';
                }

                // Marcar días con eventos en el calendario actual
                document.querySelectorAll('.calendar-day.current-month').forEach(dayElement => {
                    dayElement.classList.remove('has-event'); // Limpiar marcas previas
                    const dayDate = dayElement.dataset.fullDate;
                    if (allEvents.some(event => event.date === dayDate)) {
                        dayElement.classList.add('has-event');
                    }
                });

            } else {
                console.error('Error al cargar eventos:', data.message);
                eventList.innerHTML = `<p class="text-red-500 text-center py-8">${data.message || 'ERROR AL CARGAR EVENTOS.'}</p>`;
            }
        } catch (error) {
            console.error('Error de red al cargar eventos:', error);
            eventList.innerHTML = '<p class="text-red-500 text-center py-8">ERROR DE CONEXIÓN AL SERVIDOR AL CARGAR EVENTOS.</p>';
        }
    }

    // Delegación de eventos para botones de evento (editar/eliminar)
    eventList.addEventListener('click', async (e) => {
        const target = e.target;
        const eventId = target.dataset.eventId;
        const action = target.dataset.action;

        if (!eventId || !action) return;

        if (action === 'edit') {
            selectedEventId = eventId;
            await showEventModal(eventId);
        } else if (action === 'delete') {
            const confirmed = await showConfirmationModal('¿ESTÁS SEGURO DE QUE QUIERES ELIMINAR ESTE EVENTO?');
            if (confirmed) {
                // Pasa el elemento HTML para poder eliminarlo de la UI directamente
                await deleteEvent(eventId, target.closest('.event-item'));
            }
        }
    });

    // Abrir modal de añadir evento
    addEventButton.addEventListener('click', () => {
        selectedEventId = null; // Reiniciar para añadir nuevo evento
        eventModalTitle.textContent = 'AÑADIR NUEVO EVENTO';
        eventForm.reset();
        eventModalMessageBox.classList.add('hidden');
        eventModal.classList.remove('hidden');
        // Pre-rellenar la fecha si hay un día seleccionado en el calendario
        if (selectedDate) {
            eventDateInput.value = selectedDate;
        } else {
            // Si no hay día seleccionado, pre-rellenar con la fecha actual del calendario
            const today = new Date(currentYear, currentMonth, new Date().getDate());
            const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            eventDateInput.value = formattedDate;
        }
    });

    // Función para mostrar/pre-rellenar el modal de evento (para editar)
    async function showEventModal(eventId) {
        eventModalTitle.textContent = 'EDITAR EVENTO';
        eventModalMessageBox.classList.add('hidden');
        eventForm.reset(); // Limpiar formulario

        try {
            const response = await fetch(`${BACKEND_URL}/api/events`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            const data = await response.json();

            if (response.ok) {
                const eventToEdit = data.events.find(e => e.id === eventId);
                if (eventToEdit) {
                    eventTitleInput.value = eventToEdit.title;
                    eventDateInput.value = eventToEdit.date;
                    eventDescriptionInput.value = eventToEdit.description || '';
                    eventModal.classList.remove('hidden');
                } else {
                    showMessage(messageBox, 'EVENTO NO ENCONTRADO PARA EDITAR.', 'error');
                }
            } else {
                showMessage(messageBox, data.message || 'ERROR AL CARGAR EVENTOS PARA EDITAR.', 'error');
            }
        } catch (error) {
            console.error('Error de red al cargar evento para editar:', error);
            showMessage(messageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL CARGAR EVENTO PARA EDITAR.', 'error');
        }
    }

    // Cerrar modal de evento
    cancelEventButton.addEventListener('click', () => {
        eventModal.classList.add('hidden');
        selectedEventId = null;
    });

    // Manejar el envío del formulario de evento (añadir/editar)
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = eventTitleInput.value;
        const date = eventDateInput.value;
        const description = eventDescriptionInput.value;

        const method = selectedEventId ? 'PUT' : 'POST';
        const url = selectedEventId ? `${BACKEND_URL}/api/events/${selectedEventId}` : `${BACKEND_URL}/api/events`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ title, date, description })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(eventModalMessageBox, data.message, 'success');
                eventModal.classList.add('hidden');
                selectedEventId = null; // Resetear
                loadEvents(selectedDate); // Recargar eventos para el día seleccionado
                renderCalendar(); // Volver a renderizar el calendario para actualizar marcas
            } else {
                console.error('Error al guardar evento:', data.message);
                showMessage(eventModalMessageBox, data.message || 'ERROR AL GUARDAR EL EVENTO.', 'error');
            }
        } catch (error) {
            console.error('Error de red al guardar evento:', error);
            showMessage(eventModalMessageBox, 'ERROR DE CONEXIÓN AL SERVIDOR AL GUARDAR EVENTO.', 'error');
        }
    });

    // Función para eliminar evento
    async function deleteEvent(eventId, listItemElement) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/events/${eventId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`
                }
            });

            const data = await response.json();
            if (response.ok) {
                if (listItemElement) listItemElement.remove(); // Eliminar de la UI
                showMessage(messageBox, data.message, 'success');
                loadEvents(selectedDate); // Recargar eventos para el día seleccionado
                renderCalendar(); // Volver a renderizar el calendario para actualizar marcas
            } else {
                console.error('Error al eliminar evento:', data.message);
                showMessage(messageBox, data.message || 'ERROR AL ELIMINAR EVENTO.', 'error');
            }
        } catch (error) {
            console.error('Error de red al eliminar evento:', error);
            showMessage(messageBox, 'ERROR DE CONEXIÓN AL ELIMINAR EVENTO.', 'error');
        }
    }
});
