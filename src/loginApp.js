// 📄 src/loginApp.js
import { iniciarSesion } from './modules/auth.js';

console.log("¡CEREBRO DEL LOGIN CARGADO EXITOSAMENTE!");

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btnSubmit = e.target.querySelector('.btn-login');

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Verificando...";

    try {
        await iniciarSesion(email, password);
        window.location.href = 'index.html'; 
   } catch (error) {
        // Guardamos el error completo en la consola
        console.error("Error detallado de Supabase:", error);
        
        // Te va a abrir un cartelito con el texto exacto del servidor
        alert("❌ Error de Supabase: " + error.message); 
        
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Ingresar al Sistema";
    }
});