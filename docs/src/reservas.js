// 📄 src/reservas.js
import {
    obtenerDisponibilidadEquipos,
    guardarReservaMasiva,
    getDocentes,
    getReservasDelMes,
    eliminarReservasMasivas
} from './modules/api.js';
import { renderDocentes, } from './modules/ui.js';
import { supabaseClient } from './modules/supabase.js'; // O la ruta donde tengas tu cliente
import { cerrarSesion } from './modules/auth.js';

const appState = {
    idsSeleccionados: [],
    nombresSeleccionados: []
};

let usuarioId = null;
/**
 * 🚀 Controla la sesión del docente y pinta su nombre real en la interfaz
 */
// 📄 En tu archivo de lógica de reservas (ej: reservasApp.js o similar)

async function controlarSesionDocente() {
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();

    if (authError || !session) {
        window.location.href = './login.html';
        return;
    }

    try {
        // 🎯 Traemos el nombre completo Y el rol del usuario logueado desde la DB
        const { data: usuarioDb, error: dbError } = await supabaseClient
            .from('usuarios')
            .select('nombre_completo, rol')
            .eq('user_id', session.user.id)
            .single();

        if (dbError) throw dbError;

        // Establecemos el texto de bienvenida arriba
        const nombreUsuario = usuarioDb?.nombre_completo || session.user.email;
        document.getElementById('docente-display-nombre').textContent = `👤 ${nombreUsuario}`;

        // 🔍 Capturamos los elementos de la interfaz usando tus IDs y atributos reales
        const inputDocente = document.querySelector('input[placeholder*="Tipeá nombre"]');
        const btnLimpiar = document.getElementById('btn-limpiar-docente') || document.querySelector('button.btn-limpiar') || document.evaluate("//button[contains(text(),'Limpiar')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        const sidebarHistorial = document.getElementById('sidebar-historial'); // 👈 Tu ID real de la línea 157
        const btnVolverInicio = document.getElementById('btn-volver-inicio'); // 👈 Capturamos el botón nuevo
        // 🎀 CAPA DE ADAPTACIÓN SEGÚN EL ROL
        if (usuarioDb && usuarioDb.rol === 'Docente') {
            console.log("Configurando interfaz restrictiva para rol Docente.");

            // 1. Inyectamos su nombre en el input y lo bloqueamos por completo
            if (inputDocente) {
                inputDocente.value = nombreUsuario;
                usuarioId = usuarioDb.id; // Asigna el ID real del docente de la sesión a tu variable global
                inputDocente.disabled = true; // 🔒 No puede escribir ni buscar a otros
                inputDocente.style.backgroundColor = '#e9ecef'; // Color gris de campo deshabilitado
                inputDocente.style.cursor = 'not-allowed';
            }

            // 2. Buscamos el botón 'Limpiar' al lado del input y lo ocultamos
            // Si no tiene ID asignado aún, intentamos ocultar el hermano siguiente del input
            if (btnLimpiar) {
                btnLimpiar.style.display = 'none';
            } else if (inputDocente && inputDocente.nextElementSibling) {
                // Por si las dudas, si el botón está justo al lado en el HTML
                inputDocente.nextElementSibling.style.display = 'none';
            }

            // 3. Ocultamos por completo la pestaña lateral azul del Historial
            if (sidebarHistorial) {
                sidebarHistorial.style.display = 'none';
            }
            // 🚀 4. ¡LA NUEVA REGLA!: Escondemos el botón para que el Docente no intente ir al index
            if (btnVolverInicio) {
                btnVolverInicio.style.display = 'none';
            }

        } else if (usuarioDb && usuarioDb.rol === 'administrador') {
            console.log("Configurando interfaz completa para Administrador.");

            // Si sos vos (Admin), todo queda libre para usar a gusto
            if (inputDocente) {
                inputDocente.disabled = false;
                inputDocente.value = ''; // Vacío para que busques libremente
                inputDocente.style.backgroundColor = '#ffffff';
                inputDocente.style.cursor = 'text';
            }
            if (btnLimpiar) btnLimpiar.style.display = 'inline-block';
            if (sidebarHistorial) sidebarHistorial.style.display = 'block';
        }

    } catch (err) {
        console.error("Error al adaptar la interfaz de reservas:", err);
        document.getElementById('docente-display-nombre').textContent = `👤 ${session.user.email}`;
    }
}

// 🎬 Ejecutamos el control apenas arranca la página de reservas
controlarSesionDocente();

// 🛑 Configuración del botón de Cerrar Sesión para Docentes
const btnLogoutDocente = document.getElementById('btn-logout-docente');
if (btnLogoutDocente) {
    btnLogoutDocente.addEventListener('click', async () => {
        if (confirm("¿Estás seguro de que querés cerrar sesión?")) {
            try {
                await cerrarSesion(); // Limpia Supabase y te manda al login.html
            } catch (error) {
                console.error("Error al cerrar sesión:", error.message);
                window.location.href = 'login.html'; // Forzado por las dudas
            }
        }
    });
}




document.addEventListener('DOMContentLoaded', async () => {

    //Esto permite que las pestañas se queden fija o moviles
// Asegurate de seleccionar el contenedor principal que tiene la clase .sidebar-flotante
const panelEquipos = document.querySelector('.sidebar-flotante');
const btnFijar = document.getElementById('btn-fijar');

btnFijar.addEventListener('click', () => {
    // Alternamos la clase 'fija'
    panelEquipos.classList.toggle('fija');

    // Cambiamos el texto del botón (opcional)
    btnFijar.textContent = panelEquipos.classList.contains('fija') ? '❌' : '📌';
});




const inputFecha = document.getElementById('input-fecha');
    const formReservas = document.getElementById('form-reservas');

    const btnAbrirModal = document.getElementById('btn-abrir-modal');
    const modalEquipos = document.getElementById('modal-equipos');
    const contenedorEquipos = document.getElementById('contenedor-equipos');
    const btnConfirmarModal = document.getElementById('btn-confirmar-seleccion-modal');

    if (inputFecha) inputFecha.value = "";
    if (btnAbrirModal) btnAbrirModal.disabled = true;

    // =========================================================
    // 1. CARGA INICIAL DE DATOS (Docentes e Historial)
    // =========================================================

    // Cargar Docentes en el Datalist
    try {
        console.log("Intentando traer docentes...");
        const docentes = await getDocentes();
        console.log("Docentes recibidos:", docentes);

        if (docentes && docentes.length > 0) {
            await renderDocentes();
            console.log("renderDocentes ejecutado con éxito.");
        } else {
            console.warn("La lista de docentes está vacía.");
        }
    } catch (error) {
        console.error("Error al cargar docentes al inicio:", error);
    }

    // Cargar el historial en el sidebar
    await renderizarHistorial();

    // =========================================================================
    // 2. LOGICA DEL HISTORIAL ACTUALIZADA (CON CURSO Y FECHA FORMATEADA)
    // =========================================================================
    async function renderizarHistorial() {
        const tbody = document.getElementById('tabla-historial-body');
        if (!tbody) {
            console.warn("No se encuentra el elemento con ID 'tabla-historial-body'");
            return;
        }

        // 📅 Función interna rápida para formatear la fecha a formato local ("Vie, 19 Jun")
        function formatearFechaBonita(fechaStr) {
            if (!fechaStr) return 'Sin fecha';
            // Dividimos por '-' para evitar problemas de zona horaria con New Date(str)
            const partes = fechaStr.split('-');
            if (partes.length !== 3) return fechaStr;

            // Creamos la fecha local con los datos provistos
            const fechaLocal = new Date(partes[0], partes[1] - 1, partes[2]);

            // Opciones para el formato: día de la semana corto, día numérico y mes corto
            const opciones = { weekday: 'short', day: 'numeric', month: 'short' };
            let resultado = fechaLocal.toLocaleDateString('es-AR', opciones);

            // Capitalizamos la primera letra (ej: "vie, 19 jun" -> "Vie, 19 Jun")
            return resultado.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        }

        try {
            const reservas = await getReservasDelMes();

            const reservasAgrupadas = reservas.reduce((acc, r) => {
                const nombreDocente = r.docentes?.nombre_completo || 'Sin nombre';
                const nombreEquipo = r.equipos?.nombre || 'ID: ' + r.equipo_id;
                const fecha = r.fecha_reserva;
                // 🏫 Capturamos el curso de la reserva (si viene vacío, ponemos '-')
                const curso = r.curso || '-';

                if (!acc[nombreDocente]) {
                    acc[nombreDocente] = { equipos: new Set(), fecha: fecha, curso: curso, ids: [] };
                }
                acc[nombreDocente].equipos.add(nombreEquipo);
                acc[nombreDocente].ids.push(r.id);
                return acc;
            }, {});

            tbody.innerHTML = '';
            Object.keys(reservasAgrupadas).forEach(docente => {
                const datos = reservasAgrupadas[docente];

                const badgesEquipos = Array.from(datos.equipos)
                    .map(equipo => `<span class="badge-equipo-historial">${equipo.trim()}</span>`)
                    .join(' ');

                const cadenaIds = datos.ids.join(',');

                // 🌟 Aplicamos el formateador de fecha bonita
                const fechaFormateada = formatearFechaBonita(datos.fecha);

                tbody.innerHTML += `
                <tr>
                    <td class="td-docente"><strong>${docente}</strong></td>
                    <td class="td-equipos"><div class="badge-lista-contenedor">${badgesEquipos}</div></td>
                    <td class="td-curso"><span class="badge-curso-historial">${datos.curso}</span></td>
                    <td class="td-fecha">📅 ${fechaFormateada}</td>
                    <td class="td-acciones" style="text-align: center;">
                        <button type="button" class="btn-cancelar" data-ids="${cadenaIds}">
                            <span class="btn-icon">❌</span> Cancelar
                        </button>
                    </td>
                </tr>`;
            });

            // Escuchador para cancelar reservas agrupadas
            tbody.onclick = async (e) => {
                const boton = e.target.closest('.btn-cancelar');
                if (!boton) return;

                const idsTexto = boton.dataset.ids;
                const idsArray = idsTexto.split(',').map(id => parseInt(id));

                const seguro = confirm(`¿Estás seguro de que deseas cancelar estas reservas agrupadas?`);
                if (!seguro) return;

                try {
                    await eliminarReservasMasivas(idsArray);
                    alert("¡Reservas canceladas con éxito!");
                    await renderizarHistorial();
                } catch (error) {
                    console.error("Error al intentar cancelar:", error);
                    alert("Hubo un error al intentar cancelar las reservas.");
                }
            };

        } catch (err) {
            console.error("Error al cargar el historial:", err);
        }
    }

    // =========================================================
    // 3. VALIDACIONES Y MANEJO DEL MODAL DE EQUIPOS
    // =========================================================
    function validarRequisitosModal() {
        if (!inputFecha || !btnAbrirModal) return;

        const fechaElegida = inputFecha.value;
        const horasTildadas = document.querySelectorAll('input[name="hora"]:checked');

        btnAbrirModal.disabled = !(fechaElegida && horasTildadas.length > 0);
    }

    function obtenerHorasSeleccionadas() {
        const checkboxes = document.querySelectorAll('input[name="hora"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    async function renderEquiposReservas() {
        if (!contenedorEquipos || !inputFecha) return;

        const fechaSeleccionada = inputFecha.value;
        const horasSeleccionadas = obtenerHorasSeleccionadas();

        if (!fechaSeleccionada || horasSeleccionadas.length === 0) return;

        try {
            contenedorEquipos.innerHTML = '<p style="text-align:center; color:#64748b;">Consultando disponibilidad por horas...</p>';
            const listaEquipos = await obtenerDisponibilidadEquipos(fechaSeleccionada, horasSeleccionadas);
            contenedorEquipos.innerHTML = '';

            if (!listaEquipos || listaEquipos.length === 0) {
                contenedorEquipos.innerHTML = '<p style="text-align:center;">No hay equipos cargados en la base de datos.</p>';
                return;
            }

            listaEquipos.forEach(eq => {
                const btn = document.createElement('button');

                btn.innerHTML = `💻 ${eq.nombre}`;
                btn.type = "button";

                if (eq.ocupado) {
                    btn.className = "btn-equipo prestado";
                    btn.disabled = true;
                } else {
                    const yaSeleccionado = appState.idsSeleccionados.includes(eq.id);
                    btn.className = yaSeleccionado ? "btn-equipo disponible seleccionado" : "btn-equipo disponible";

                    btn.addEventListener('click', () => {
                        if (btn.classList.contains('seleccionado')) {
                            btn.classList.remove('seleccionado');
                            appState.idsSeleccionados = appState.idsSeleccionados.filter(id => id !== eq.id);
                            appState.nombresSeleccionados = appState.nombresSeleccionados.filter(n => n !== eq.nombre);
                        } else {
                            btn.classList.add('seleccionado');
                            appState.idsSeleccionados.push(eq.id);
                            appState.nombresSeleccionados.push(eq.nombre);
                        }
                    });
                }
                contenedorEquipos.appendChild(btn);
            });

        } catch (err) {
            console.error("Error renderizando el modal:", err);
            contenedorEquipos.innerHTML = `<p style="color:red; text-align:center;">Error al conectar con la API.</p>`;
        }
    }

    function resetearSeleccionEquipos() {
        appState.idsSeleccionados = [];
        appState.nombresSeleccionados = [];
        if (btnAbrirModal) {
            btnAbrirModal.textContent = "Seleccionar Equipos Masivos";
            btnAbrirModal.style.backgroundColor = '#2563eb';
        }
        if (modalEquipos && !modalEquipos.classList.contains('oculto')) {
            renderEquiposReservas();
        }
    }

    // =========================================================
    // 4. EVENT LISTENERS DE LA INTERFAZ
    // =========================================================
    if (inputFecha) {
        inputFecha.addEventListener('change', () => {
            validarRequisitosModal();
            resetearSeleccionEquipos();
        });
    }

    // Captura el cambio de horas usando el documento de forma directa
    document.addEventListener('change', (e) => {
        if (e.target && e.target.name === 'hora') {
            validarRequisitosModal();
            if (typeof resetearSeleccionEquipos === 'function') {
                resetearSeleccionEquipos();
            }
        }
    });

    if (btnAbrirModal) {
        btnAbrirModal.addEventListener('click', () => {
            if (modalEquipos) {
                modalEquipos.classList.remove('oculto');
                renderEquiposReservas();
            }
        });
    }

    if (btnConfirmarModal) {
        btnConfirmarModal.addEventListener('click', () => {
            if (modalEquipos) {
                modalEquipos.classList.add('oculto');
                if (appState.idsSeleccionados.length > 0) {
                    btnAbrirModal.textContent = `🟢 ${appState.nombresSeleccionados.length} Equipos Seleccionados`;
                    btnAbrirModal.style.backgroundColor = '#10b981';
                } else {
                    btnAbrirModal.textContent = "Seleccionar Equipos Masivos";
                    btnAbrirModal.style.backgroundColor = '#2563eb';
                }
            }
        });
    }

    window.cerrarModal = function () {
        if (modalEquipos) modalEquipos.classList.add('oculto');
    };

    // 🧼 LÓGICA INTEGRADITA DEL BOTÓN LIMPIAR BUSQUEDA
    const btnLimpiar = document.getElementById('btn-limpiar-busqueda');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            const inputDocente = document.getElementById('docente');

            // 1. Vaciamos los campos de texto y fecha
            // if (inputDocente) inputDocente.value = '';
            if (inputFecha) inputFecha.value = '';

            // 2. Destildamos y habilitamos todos los checkboxes de horas
            const checkboxesHoras = document.querySelectorAll('input[name="hora"]');
            checkboxesHoras.forEach(cb => {
                cb.checked = false;
                cb.disabled = false;
            });

            // 3. Reseteamos el estado interno usando tu función
            resetearSeleccionEquipos();

            // 4. Limpiamos visualmente el contenedor del modal
            if (contenedorEquipos) contenedorEquipos.innerHTML = '';

            // 5. Deshabilitamos el botón azul porque ya no hay fecha ni hora elegida
            validarRequisitosModal();

            // 6. Foco automático al cuadro del docente
            if (inputDocente) inputDocente.focus();

            console.log("🧹 Formulario reseteado por completo sin romper el código.");
        });
    }

    // =========================================================================
    // 5. ENVÍO DEL FORMULARIO (Inserción Masiva) - CORREGIDO CON CURSO
    // =========================================================================
    if (formReservas) {
        formReservas.addEventListener('submit', async (e) => {
            e.preventDefault();

            const inputDocente = document.getElementById('docente');
            const datalistProfes = document.getElementById('lista-docentes');
            // 🏫 Capturamos el valor del nuevo input
            const cursoValor = document.getElementById('input-curso').value.trim();

            let usuarioId = null;
            const valorEscrito = inputDocente.value.trim().toLowerCase();
            const opciones = datalistProfes.options;

            for (let i = 0; i < opciones.length; i++) {
                if (opciones[i].value.trim().toLowerCase() === valorEscrito) {
                    usuarioId = opciones[i].dataset.id;
                    break;
                }
            }

            const fechaSelected = inputFecha.value;
            const horasSelected = obtenerHorasSeleccionadas();
            console.log("El ID del usuario actual es:", usuarioId);

            // ⚠️ Podés sumar una validación opcional para el curso si querés que sea obligatorio:
            if (!usuarioId || appState.idsSeleccionados.length === 0 || horasSelected.length === 0 || !cursoValor) {
                alert("Por favor, completa todos los datos: selecciona un docente válido, ingresá el curso y elegí las horas.");
                return;
            }

            try {
                const filasAInsertar = [];
                appState.idsSeleccionados.forEach(idEquipo => {
                    horasSelected.forEach(hora => {
                        filasAInsertar.push({
                            docente_id: parseInt(usuarioId),
                            equipo_id: idEquipo,
                            fecha_reserva: fechaSelected,
                            hora_catedra: hora,
                            curso: cursoValor, // 🔥 ¡AHORA SÍ! Guardamos el curso en Supabase
                            estado: 'Confirmada'
                        });
                    });
                });

                await guardarReservaMasiva(filasAInsertar);
                alert("¡Reserva masiva completada con éxito!");

                await renderizarHistorial();

                // Reseteo completo del formulario
                formReservas.reset();

                // 🧹 Nos aseguramos manualmente de vaciar el input del curso por si las dudas
                document.getElementById('input-curso').value = '';

                resetearSeleccionEquipos();
                validarRequisitosModal();

            } catch (error) {
                console.error(error);
                alert("Error al guardar la reserva.");
            }
        });
    }
});

// ==========================================================================
// 🔄 FUNCIÓN GLOBAL PARA ABRIR / CERRAR EL PANEL (TOGGLE REAL)
// ==========================================================================
window.toggleSidebar = function (idSidebar) {
    const sidebar = document.getElementById(idSidebar);

    if (sidebar) {
        // 🤔 Evaluamos si ya contiene la clase 'open'
        if (sidebar.classList.contains('open')) {
            // ❌ Si ya está abierto, lo cerramos (Limpieza absoluta)
            sidebar.classList.remove('fija', 'open', 'active');
            console.log("Panel " + idSidebar + " cerrado correctamente.");

            // 📌 Sincronizamos el botón del pin para que vuelva a ser un pin común
            const pin = document.getElementById('btn-fijar');
            if (pin) {
                pin.textContent = '📌';
            }
        } else {
            // 🟢 Si está escondido, le metemos 'open' para que el CSS responsive lo muestre (right: 0)
            sidebar.classList.add('open');
            console.log("Panel " + idSidebar + " abierto correctamente.");
        }
    } else {
        console.error("No se encontró ningún panel con el ID:", idSidebar);
    }
};