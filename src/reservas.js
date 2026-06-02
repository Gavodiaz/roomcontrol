// 📄 src/reservas.js
import { obtenerDisponibilidadEquipos, guardarReservaMasiva, getDocentes } from './modules/api.js';

const appState = {
    idsSeleccionados: [],
    nombresSeleccionados: []
};

document.addEventListener('DOMContentLoaded', async () => {
    const selectDocente = document.getElementById('select-docente');
    const inputFecha = document.getElementById('input-fecha');
    const formReservas = document.getElementById('form-reservas');
    
    const btnAbrirModal = document.getElementById('btn-abrir-modal');
    const modalEquipos = document.getElementById('modal-equipos');
    const contenedorEquipos = document.getElementById('contenedor-equipos');
    const btnConfirmarModal = document.getElementById('btn-confirmar-seleccion-modal');

    if (inputFecha) inputFecha.value = ""; 
    if (btnAbrirModal) btnAbrirModal.disabled = true;

    // A: Cargar los docentes
    async function cargarDocentes() {
        if (!selectDocente) return;
        try {
            const usuarios = await getDocentes();
            selectDocente.innerHTML = '<option value="" disabled selected>-- Seleccione un Profesor --</option>';
            usuarios.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.nombre_completo;
                selectDocente.appendChild(option);
            });
        } catch (err) {
            console.error("Error cargando profesores:", err.message);
        }
    }

    // 🔒 FUNCIÓN CLAVE: Valida si habilitar o no el botón azul del modal
    function validarRequisitosModal() {
        if (!inputFecha || !btnAbrirModal) return;
        
        const fechaElegida = inputFecha.value;
        // Buscamos cuántos checkboxes de hora están tildados
        const horasTildadas = document.querySelectorAll('input[name="hora"]:checked');

        // Se habilita SOLO si hay fecha Y al menos una hora seleccionada
        btnAbrirModal.disabled = !(fechaElegida && horasTildadas.length > 0);
    }

    // Helper para obtener un array simple con las horas seleccionadas [1, 2, 3]
    function obtenerHorasSeleccionadas() {
        const checkboxes = document.querySelectorAll('input[name="hora"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    // =========================================================
    // B: DIBUJAR LA INTERFAZ CON FITRO DE FECHA + HORAS
    // =========================================================
    async function renderEquiposReservas() {
        if (!contenedorEquipos || !inputFecha) return;

        const fechaSeleccionada = inputFecha.value;
        const horasSeleccionadas = obtenerHorasSeleccionadas();

        if (!fechaSeleccionada || horasSeleccionadas.length === 0) return;

        try {
            contenedorEquipos.innerHTML = '<p style="text-align:center; color:#64748b;">Consultando disponibilidad por horas...</p>';

            // Enviamos la fecha Y el array de horas a la API
            const listaEquipos = await obtenerDisponibilidadEquipos(fechaSeleccionada, horasSeleccionadas);

            contenedorEquipos.innerHTML = '';

            if (!listaEquipos || listaEquipos.length === 0) {
                contenedorEquipos.innerHTML = '<p style="text-align:center;">No hay equipos cargados en la base de datos.</p>';
                return;
            }

            listaEquipos.forEach(eq => {
                const btn = document.createElement('button');
                btn.textContent = eq.nombre;
                btn.type = "button";

                // 🔴 Si está ocupado en alguna de esas horas, se bloquea en rojo
                if (eq.ocupado) {
                    btn.className = "btn-equipo prestado"; 
                    btn.disabled = true;
                } 
                // 🟢 Si está libre todas esas horas, queda disponible
                else {
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

    // =========================================================
    // C: ESCUCHADORES DE EVENTOS
    // =========================================================
    
    // Escuchar el cambio de fecha
    if (inputFecha) {
        inputFecha.addEventListener('change', () => {
            validarRequisitosModal();
            resetearSeleccionEquipos();
        });
    }

    // Escuchar los clicks en los checkboxes de las horas cátedra
    const contenedorHoras = document.getElementById('contenedor-horas');
    if (contenedorHoras) {
        contenedorHoras.addEventListener('change', (e) => {
            if (e.target.name === 'hora') {
                validarRequisitosModal();
                resetearSeleccionEquipos(); // Si cambia la hora, hay que volver a elegir equipos
            }
        });
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

    window.cerrarModal = function() {
        if (modalEquipos) modalEquipos.classList.add('oculto');
    };

    // =========================================================
    // D: ENVIAR RESERVA CON MULTIPLICACIÓN POR HORA CÁTEDRA
    // =========================================================
    if (formReservas) {
        formReservas.addEventListener('submit', async (e) => {
            e.preventDefault();

            const docenteId = selectDocente.value;
            const fechaSelected = inputFecha.value;
            const horasSelected = obtenerHorasSeleccionadas();

            if (!docenteId || appState.idsSeleccionados.length === 0 || horasSelected.length === 0) {
                alert("Faltan completar datos obligatorios.");
                return;
            }

            try {
                const filasAInsertar = [];

                // 🎯 LA MAGIA: Multiplicamos filas (Equipos x Horas Seleccionadas)
                appState.idsSeleccionados.forEach(idEquipo => {
                    horasSelected.forEach(hora => {
                        filasAInsertar.push({
                            docente_id: parseInt(docenteId),
                            equipo_id: idEquipo,
                            fecha_reserva: fechaSelected,
                            hora_catedra: hora, // Se guarda el número de hora (1 al 14)
                            estado: 'Confirmada'
                        });
                    });
                });

                await guardarReservaMasiva(filasAInsertar);

                alert(`🎉 ¡Reserva masiva completada! Se registraron los equipos para las ${horasSelected.length} horas cátedra elegidas.`);
                
                // Resetear todo el formulario
                formReservas.reset();
                appState.idsSeleccionados = [];
                appState.nombresSeleccionados = [];
                if (btnAbrirModal) {
                    btnAbrirModal.textContent = "Seleccionar Equipos Masivos";
                    btnAbrirModal.style.backgroundColor = '#2563eb';
                    btnAbrirModal.disabled = true;
                }

            } catch (error) {
                alert("Hubo un error al procesar la reserva por horas.");
            }
        });
    }

    await cargarDocentes();
});