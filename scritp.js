// ========================================
// CONFIGURACIÓN INICIAL
// ========================================

// URL base de la API (cambiar según tu configuración)
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://tu-backend-url.herokuapp.com'; // Cambiar por tu URL de backend en producción

// Configuración de Twitch
const TWITCH_CONFIG = {
    clientId: 'q2wff2pvt5waw4440bpwyxapppq5vm',
    redirectUri: 'https://milozanoo22-cpu.github.io/PhanStreamers/callback.html', // ⬅️ Cambiar esto
    scopes: ['user:read:email', 'chat:read', 'channel:read:subscriptions']
};

// ========================================
// VARIABLES GLOBALES
// ========================================

let streamers = [
    {
        name: 'JuanStreamer',
        channel: 'juanstreamer',
        points: 1250,
        supportPercentage: 85,
        hoursAllowed: 4
    },
    {
        name: 'MariaGamer',
        channel: 'mariagamer', 
        points: 980,
        supportPercentage: 72,
        hoursAllowed: 3
    },
    {
        name: 'CarlosArt',
        channel: 'carlosart',
        points: 1450,
        supportPercentage: 91,
        hoursAllowed: 5
    }
];

let currentUser = {
    name: 'TuUsuario',
    channel: 'tucanal',
    points: 750,
    supportPercentage: 65,
    hoursAllowed: 2,
    scheduledHours: []
};

let twitchAuth = {
    accessToken: null,
    isAuthenticated: false,
    userInfo: null
};

let supportSession = {
    active: false,
    streamer: null,
    startTime: null,
    pointsEarned: 0,
    commentsDetected: 0,
    timer: null
};

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

// Sistema de notificaciones
function showNotification(type, title, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<strong>${title}</strong><br>${message}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// ========================================
// NAVEGACIÓN ENTRE TABS
// ========================================

function showTab(tabId) {
    // Ocultar todos los tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Mostrar tab seleccionado
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

// ========================================
// API DE TWITCH - FUNCIONES
// ========================================

class TwitchAPI {
    static async validateChannel(channelName) {
        try {
            console.log(`🔍 Verificando canal: ${channelName}`);
            
            const response = await fetch(`${API_BASE_URL}/api/twitch/validate/${channelName}`);
            const data = await response.json();
            
            return data;
        } catch (error) {
            console.error('Error en validación:', error);
            return {
                success: false,
                data: null,
                message: 'Error de conexión con el servidor. Verifica que el backend esté corriendo.'
            };
        }
    }

    static async getLiveStreams(userLogins = []) {
        try {
            if (userLogins.length === 0) {
                return { success: true, data: [], message: 'No hay streamers registrados' };
            }

            const response = await fetch(`${API_BASE_URL}/api/twitch/streams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userLogins })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo streams:', error);
            return {
                success: false,
                data: [],
                message: 'Error de conexión con el servidor'
            };
        }
    }

    static async getGameInfo(gameId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/twitch/games/${gameId}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo info del juego:', error);
            return null;
        }
    }
}

// ========================================
// REGISTRO DE CANALES
// ========================================

// Inicializar formulario de registro
document.addEventListener('DOMContentLoaded', function() {
    const registroForm = document.getElementById('registroForm');
    if (registroForm) {
        registroForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const channel = document.getElementById('twitchChannel').value.trim().toLowerCase();
            const name = document.getElementById('streamerName').value.trim();
            const category = document.getElementById('streamCategory').value;
            
            if (!channel || !name) {
                showNotification('error', '❌ Error', 'Por favor completa todos los campos obligatorios');
                return;
            }

            // Mostrar estado de verificación
            const verificationDiv = document.getElementById('channelVerification');
            verificationDiv.style.display = 'block';
            verificationDiv.style.background = '#fff3cd';
            verificationDiv.style.border = '1px solid #ffeaa7';
            verificationDiv.innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 10px;">🔍</div>
                    <p><strong>Verificando canal de Twitch...</strong></p>
                    <p>Conectando con la API de Twitch para validar "${channel}"</p>
                </div>
            `;

            // Verificar canal con API de Twitch
            const verification = await TwitchAPI.validateChannel(channel);
            
            if (verification.success) {
                const channelData = verification.data;
                
                // Mostrar información del canal verificado
                verificationDiv.style.background = '#d4edda';
                verificationDiv.style.border = '1px solid #c3e6cb';
                verificationDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img src="${channelData.profile_image_url}" 
                             style="width: 60px; height: 60px; border-radius: 50%;" 
                             alt="Profile">
                        <div style="flex: 1;">
                            <h4 style="margin: 0; color: #155724;">✅ Canal Verificado</h4>
                            <p style="margin: 5px 0;"><strong>Canal:</strong> ${channelData.display_name}</p>
                            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${channelData.broadcaster_type || 'Usuario'}</p>
                            <p style="margin: 5px 0;"><strong>Vistas totales:</strong> ${channelData.view_count.toLocaleString()}</p>
                            <p style="margin: 5px 0; font-size: 12px; opacity: 0.8;">${channelData.description || 'Sin descripción'}</p>
                        </div>
                    </div>
                `;

                // Agregar streamer verificado al sistema
                const newStreamer = {
                    name: name,
                    channel: channel,
                    twitchData: channelData,
                    points: 0,
                    supportPercentage: 0,
                    hoursAllowed: 1,
                    registeredAt: new Date().toISOString(),
                    category: category
                };

                // Verificar si ya existe
                const existingIndex = streamers.findIndex(s => s.channel === channel);
                if (existingIndex !== -1) {
                    streamers[existingIndex] = newStreamer;
                    showNotification('success', '🔄 Actualizado', `Canal ${channelData.display_name} actualizado exitosamente`);
                } else {
                    streamers.push(newStreamer);
                    showNotification('success', '🎉 Registrado', `¡Bienvenido ${channelData.display_name}!`);
                }

                // Actualizar usuario actual si es su canal
                if (channel === currentUser.channel || !currentUser.channel) {
                    currentUser.name = name;
                    currentUser.channel = channel;
                    currentUser.twitchData = channelData;
                }

                // Limpiar formulario
                registroForm.reset();
                
                // Auto-actualizar streamers en vivo
                setTimeout(refreshLiveStreams, 2000);
                
            } else {
                // Mostrar error de verificación
                verificationDiv.style.background = '#f8d7da';
                verificationDiv.style.border = '1px solid #f5c6cb';
                verificationDiv.innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 20px; margin-bottom: 10px;">❌</div>
                        <p><strong>Error al verificar canal</strong></p>
                        <p>${verification.message}</p>
                        <small>Verifica que el canal existe y está escrito correctamente</small>
                    </div>
                `;
                
                showNotification('error', '❌ Verificación fallida', verification.message);
            }
        });
    }
});

// ========================================
// AUTENTICACIÓN CON TWITCH
// ========================================
function authenticateWithTwitch() {
    showNotification('info', '🔗 Abriendo Twitch', 'Iniciando autenticación segura...');
    
    // Abrir ventana de autenticación
    const authWindow = window.open(
        `${API_BASE_URL}/auth/twitch`, 
        'TwitchAuth', 
        'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    // Escuchar mensajes del callback
    const handleAuthMessage = (event) => {
        if (event.data.type === 'TWITCH_AUTH_SUCCESS') {
            window.removeEventListener('message', handleAuthMessage);
            
            const { token, user } = event.data.data;
            
            twitchAuth.isAuthenticated = true;
            twitchAuth.accessToken = token;
            twitchAuth.userInfo = user;
            
            document.getElementById('authIndicator').innerHTML = `✅ Autenticado como ${user.display_name}`;
            showNotification('success', '🎉 ¡Autenticado!', `Bienvenido ${user.display_name}`);
            
            // Actualizar usuario actual si es necesario
            if (!currentUser.channel || currentUser.channel === 'tucanal') {
                currentUser.name = user.display_name;
                currentUser.channel = user.login;
                currentUser.twitchData = user;
            }
            
        } else if (event.data.type === 'TWITCH_AUTH_ERROR') {
            window.removeEventListener('message', handleAuthMessage);
            showNotification('error', '❌ Error de autenticación', event.data.error);
        }
    };
    
    window.addEventListener('message', handleAuthMessage);
    
    // Limpiar listener si la ventana se cierra manualmente
    const checkClosed = setInterval(() => {
        if (authWindow && authWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleAuthMessage);
        }
    }, 1000);
}

// ========================================
// STREAMERS EN VIVO
// ========================================

async function refreshLiveStreams() {
    showNotification('info', '🔄 Actualizando', 'Buscando streamers en vivo...');
    
    const registeredStreamers = streamers.map(s => s.channel);
    const liveData = await TwitchAPI.getLiveStreams(registeredStreamers);
    
    if (liveData.success) {
        displayLiveStreams(liveData.data);
        document.getElementById('liveCount').innerHTML = `🔴 ${liveData.data.length} streamers en vivo`;
        showNotification('success', '📺 Actualizado', `${liveData.data.length} streamers encontrados en vivo`);
    } else {
        showNotification('error', '❌ Error', liveData.message);
    }
}

function displayLiveStreams(liveStreams) {
    const grid = document.getElementById('liveStreamersGrid');
    grid.innerHTML = '';

    if (liveStreams.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">No hay streamers de la comunidad en vivo en este momento. 😴</p>';
        return;
    }

    liveStreams.forEach(stream => {
        const streamCard = document.createElement('div');
        streamCard.className = 'streamer-card';
        
        const timeAgo = Math.floor((Date.now() - new Date(stream.started_at).getTime()) / (1000 * 60));
        
        streamCard.innerHTML = `
            <div class="stream-preview" onclick="startSupportSession('${stream.user_login}', '${stream.user_name}')">
                <div class="live-indicator">🔴 EN VIVO</div>
                <div class="viewer-count">👥 ${stream.viewer_count.toLocaleString()}</div>
                <div class="stream-info">
                    <div class="stream-title">${stream.title}</div>
                    <div class="stream-category">${stream.game_name} • ${timeAgo} min</div>
                </div>
            </div>
            <div class="streamer-avatar">${stream.user_name.substring(0, 2).toUpperCase()}</div>
            <h3>${stream.user_name}</h3>
            <div class="points">👥 ${stream.viewer_count} viewers</div>
            <div class="support-percentage">📺 ${stream.game_name}</div>
            <button class="btn" onclick="startSupportSession('${stream.user_login}', '${stream.user_name}')">🎯 Empezar Apoyo</button>
        `;
        
        grid.appendChild(streamCard);
    });
}

// ========================================
// SESIONES DE APOYO
// ========================================

function startSupportSession(streamerChannel, streamerName) {
    if (supportSession.active) {
        if (confirm('Ya tienes una sesión activa. ¿Quieres cambiar de streamer?')) {
            stopSupportSession();
        } else {
            return;
        }
    }

    const streamer = streamers.find(s => s.channel === streamerChannel) || 
                   { name: streamerName, channel: streamerChannel };

    supportSession = {
        active: true,
        streamer: streamer,
        startTime: Date.now(),
        pointsEarned: 0,
        commentsDetected: 0,
        timer: null
    };

    // Crear embed de Twitch
    const sessionDiv = document.getElementById('currentSupportSession');
    sessionDiv.innerHTML = `
        <div class="support-timer">
            <div class="timer-display" id="sessionTimer">00:00</div>
            <div class="points-earned" id="sessionPoints">+0 puntos ganados</div>
        </div>
        <p><strong>🎯 Apoyando a:</strong> ${streamer.name || streamer.channel}</p>
        <div class="twitch-embed">
            <iframe 
                src="https://player.twitch.tv/?channel=${streamer.channel}&parent=${window.location.hostname}&muted=false"
                height="400"
                width="100%"
                allowfullscreen>
            </iframe>
        </div>
        <div style="margin-top: 10px;">
            <small>💬 Comenta en el chat para ganar puntos adicionales</small>
        </div>
    `;

    document.getElementById('stopSessionBtn').style.display = 'block';

    // Iniciar timer
    startSupportTimer();
    
    showNotification('success', '🎯 Sesión iniciada', `Apoyando a ${streamer.name || streamer.channel}`);
}

function startSupportTimer() {
    supportSession.timer = setInterval(() => {
        const elapsed = Date.now() - supportSession.startTime;
        const minutes = Math.floor(elapsed / (1000 * 60));
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

        const timerEl = document.getElementById('sessionTimer');
        if (timerEl) {
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Ganar puntos por tiempo
        if (seconds === 0 && minutes > 0) {
            supportSession.pointsEarned += 5;
            const pointsEl = document.getElementById('sessionPoints');
            if (pointsEl) {
                pointsEl.textContent = `+${supportSession.pointsEarned} puntos ganados`;
            }
        }

        // Simular detección de comentarios
        if (Math.random() < 0.05) {
            supportSession.commentsDetected++;
            supportSession.pointsEarned += 10;
            const pointsEl = document.getElementById('sessionPoints');
            if (pointsEl) {
                pointsEl.textContent = `+${supportSession.pointsEarned} puntos ganados`;
            }
            showNotification('success', '💬 ¡Comentario detectado!', '+10 puntos por interacción');
        }
    }, 1000);
}

function stopSupportSession() {
    if (!supportSession.active) return;

    clearInterval(supportSession.timer);
    
    const totalMinutes = Math.floor((Date.now() - supportSession.startTime) / (1000 * 60));
    const finalPoints = supportSession.pointsEarned;
    
    currentUser.points += finalPoints;
    
    document.getElementById('currentSupportSession').innerHTML = 
        '<p>No hay sesión activa. ¡Empieza a apoyar a un streamer!</p>';
    document.getElementById('stopSessionBtn').style.display = 'none';
    
    supportSession.active = false;
    
    showNotification('success', '🎉 Sesión completada', 
        `${totalMinutes} minutos • +${finalPoints} puntos • ${supportSession.commentsDetected} interacciones`);
    
    updateSupportPercentage();
}

// ========================================
// SISTEMA DE PUNTOS
// ========================================

function watchStream(streamerName) {
    const randomPoints = Math.floor(Math.random() * 50) + 25;
    currentUser.points += randomPoints;
    
    alert(`🎥 Viendo stream de ${streamerName}!\n⭐ Puntos ganados: +${randomPoints}\n🎯 Total de puntos: ${currentUser.points}`);
    
    updateSupportPercentage();
}

function updateSupportPercentage() {
    const newPercentage = Math.min(95, Math.floor((currentUser.points / 20)));
    currentUser.supportPercentage = newPercentage;
    currentUser.hoursAllowed = Math.min(5, Math.floor(newPercentage / 20));
    
    console.log(`Nuevo porcentaje de apoyo: ${newPercentage}%`);
    console.log(`Horas permitidas: ${currentUser.hoursAllowed}`);
}

// ========================================
// HORARIOS
// ========================================

function generateSchedule() {
    const scheduleGrid = document.getElementById('scheduleGrid');
    
    // Limpiar horario actual (mantener headers)
    while (scheduleGrid.children.length > 8) {
        scheduleGrid.removeChild(scheduleGrid.lastChild);
    }
    
    const hours = [];
    for (let h = 8; h <= 23; h++) {
        hours.push(h + ':00');
    }
    
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    
    hours.forEach(hour => {
        // Celda de hora
        const hourCell = document.createElement('div');
        hourCell.className = 'schedule-cell';
        hourCell.textContent = hour;
        scheduleGrid.appendChild(hourCell);
        
        // Celdas de días
        days.forEach(day => {
            const dayCell = document.createElement('div');
            dayCell.className = 'schedule-slot';
            
            // Simular disponibilidad
            const random = Math.random();
            if (random < 0.7) {
                dayCell.className += ' available';
                dayCell.textContent = 'Libre';
                dayCell.onclick = () => bookSlot(hour, day, dayCell);
            } else {
                dayCell.className += ' taken';
                dayCell.textContent = 'Ocupado';
            }
            
            scheduleGrid.appendChild(dayCell);
        });
    });
    
    showNotification('success', '📅 Horario generado', `Puedes agendar ${currentUser.hoursAllowed} horas esta semana`);
}

function bookSlot(hour, day, element) {
    if (currentUser.scheduledHours.length >= currentUser.hoursAllowed) {
        alert(`⚠️ Has alcanzado tu límite de ${currentUser.hoursAllowed} horas semanales.\n📈 Aumenta tu porcentaje de apoyo para más horas.`);
        return;
    }
    
    element.className = 'schedule-slot my-slot';
    element.textContent = 'Mi Slot';
    element.onclick = null;
    
    currentUser.scheduledHours.push({hour, day});
    
    showNotification('success', '✅ Slot reservado', `${day} a las ${hour} - Slots: ${currentUser.scheduledHours.length}/${currentUser.hoursAllowed}`);
}

// ========================================
// MONITOREO DE INTERACCIONES
// ========================================

function startMonitoring() {
    const streamSelect = document.getElementById('streamToMonitor');
    const selectedStream = streamSelect.value;
    
    if (!selectedStream) {
        alert('⚠️ Selecciona un stream para monitorear');
        return;
    }
    
    showNotification('success', '🚀 Monitoreo iniciado', `Monitoreando ${selectedStream}`);
}

// ========================================
// ALMACENAMIENTO LOCAL
// ========================================

function saveUserData() {
    const userData = {
        currentUser: currentUser,
        streamers: streamers,
        timestamp: new Date().toISOString()
    };
    console.log('Guardando datos del usuario...', userData);
}

function loadUserData() {
    console.log('Cargando datos del usuario...');
}

// ========================================
// INICIALIZACIÓN
// ========================================

window.addEventListener('load', function() {
    loadUserData();
    
    showNotification('success', '🚀 StreamSupport iniciado', 'Plataforma cargada correctamente');
    
    // Cargar streamers en vivo automáticamente
    setTimeout(refreshLiveStreams, 1000);
    
    // Actualizar streams cada 2 minutos
    setInterval(refreshLiveStreams, 120000);
    
    // Generar horario inicial
    setTimeout(() => {
        const scheduleGrid = document.getElementById('scheduleGrid');
        if (scheduleGrid && scheduleGrid.children.length <= 8) {
            generateSchedule();
        }
    }, 2000);
});

// Auto-guardar datos cada 30 segundos

setInterval(saveUserData, 30000);




