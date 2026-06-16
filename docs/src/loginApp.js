// 📄 src/loginApp.js
import { iniciarSesion, registrarDocente } from './modules/auth.js';

console.log("¡CEREBRO DEL LOGIN Y REGISTRO CARGADO EXITOSAMENTE!");

// VARIABLES DE ESTADO Y ELEMENTOS DEL DOM
let modoRegistro = false;

const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const authTitulo = document.getElementById('auth-titulo');
const authSubtitulo = document.getElementById('auth-subtitulo');
const btnSwitchAuth = document.getElementById('btn-switch-auth');
const switchTexto = document.getElementById('switch-texto');

// 🔄 1. INTERRUPTOR VISUAL: CONMUTAR ENTRE LOGIN Y REGISTRO
if (btnSwitchAuth) {
    btnSwitchAuth.addEventListener('click', (e) => {
        e.preventDefault();
        modoRegistro = !modoRegistro;

        if (modoRegistro) {
            // Pasamos a modo Registro
            formLogin.style.display = 'none';
            formRegistro.style.display = 'block';
            authTitulo.textContent = "Registro de Docentes";
            authSubtitulo.textContent = "Creá tu cuenta para gestionar tus reservas del laboratorio";
            switchTexto.textContent = "¿Ya tenés una cuenta?";
            btnSwitchAuth.textContent = "Iniciá Sesión";
        } else {
            // Volvemos a modo Login
            formLogin.style.display = 'block';
            formRegistro.style.display = 'none';
            authTitulo.textContent = "RoomControl";
            authSubtitulo.textContent = "Acceso exclusivo para el personal de informática";
            switchTexto.textContent = "¿Sos docente y no tenés cuenta?";
            btnSwitchAuth.textContent = "Registrate acá";
        }
    });
}

// 🔑 2. ESCUCHADOR ORIGINAL: INICIO DE SESIÓN
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btnSubmit = e.target.querySelector('.btn-login');

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Verificando...";

    try {
        await iniciarSesion(email, password);
        window.location.href = './index.html'; 
        
    } catch (error) {
        console.error("Error detallado de Supabase:", error);
        alert("❌ Error de Supabase: " + error.message); 
        
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Ingresar al Sistema";
    }
});

// 📝 3. ESCUCHADOR: REGISTRO DE DOCENTES (VERSIÓN DEFINITIVA CORREGIDA)
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Capturamos los elementos del formulario de registro
        const nombreInput = document.getElementById('registro-nombre');
        const emailInput = document.getElementById('registro-email');
        const passwordInput = document.getElementById('registro-password');
        const btnSubmit = e.target.querySelector('.btn-login');

        // 2. Extraemos los valores limpios
        const nombre = nombreInput ? nombreInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        // 3. Validaciones de seguridad básicas
        if (!nombre || !email || !password) {
            alert("⚠️ Por favor, completá todos los campos.");
            return;
        }

        if (password.length < 6) {
            alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        // 4. Deshabilitamos el botón para evitar dobles clics
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Creando cuenta...";
        }

        try {
            // Mandamos los datos a la función del auth.js
            await registrarDocente(email, password, nombre);

            alert("✨ ¡Cuenta de docente creada con éxito!");
            
            // Limpiamos el formulario de registro
            formRegistro.reset();

            // 🚀 En lugar de mandarlo al login de vuelta para que vuelva a escribir los datos,
            // lo mandamos directo a reservas.html porque Supabase ya lo inicia sesión al registrarse.
            window.location.href = './reservas.html';

        } catch (error) {
            console.error("Error detallado en el registro:", error);
            alert("❌ Error al registrar cuenta: " + error.message);
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Crear mi Cuenta de Docente";
            }
        }
    });
}