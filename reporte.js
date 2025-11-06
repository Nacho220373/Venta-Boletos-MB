// reporte.js

const META_BOLETOS = 30;

// La función principal para cargar y renderizar los datos
async function renderizarDashboard() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = '<h2>Cargando datos...</h2>';

    let alumnosData = [];
    let ventasData = [];

    try {
        const resultado = await window.electronAPI.cargarDatos();

        if (resultado.success) {
            alumnosData = resultado.data.alumnos || [];
            ventasData = resultado.data.ventas || [];
        } else {
            throw new Error(resultado.message);
        }
    } catch (error) {
        container.innerHTML = `<h2>❌ Error al cargar datos: ${error.message}</h2>`;
        console.error("Error cargando datos en reporte:", error);
        return;
    }

    if (alumnosData.length === 0) {
        container.innerHTML = '<h2>No hay alumnos registrados.</h2>';
        return;
    }
    
    container.innerHTML = ''; // Limpiar el mensaje de carga

    // --- Procesamiento y Renderizado de Tarjetas ---
    
    alumnosData.forEach(alumno => {
        // 1. Calcular el total acumulado
        
        // FIX: Se filtran SÓLO las ventas con monto > 0 (ventas pagadas)
        const ventasPagadas = ventasData.filter(v => v.alumno === alumno.nombre && v.monto > 0);
        
        // Las ventas base (monto = 0) deben ser excluidas de este conteo, 
        // ya que solo representan una ubicación para un boleto ya contado en 'vendidos_iniciales'.
        const totalVendido = alumno.vendidos_iniciales + ventasPagadas.length;
        
        const progreso = Math.min(100, Math.round((totalVendido / META_BOLETOS) * 100));

        // 2. Crear la tarjeta HTML
        const card = document.createElement('div');
        card.classList.add('alumno-card');
        card.dataset.nombre = alumno.nombre;
        
        card.innerHTML = `
            <h3>${alumno.nombre}</h3>
            
            <div class="progreso-circular ${progreso >= 100 ? 'meta-alcanzada' : ''}" 
                 style="background: conic-gradient(var(--color-acento) ${progreso}%, var(--color-meta) ${progreso}%)">
                <div class="progreso-inner">${totalVendido}</div>
            </div>

            <div class="progreso-info">
                <span>${totalVendido}</span> boletos vendidos
            </div>
            <div class="progreso-info">
                Faltan: <span>${Math.max(0, META_BOLETOS - totalVendido)}</span> para la meta.
            </div>
        `;
        
        // 3. Asignar el evento para abrir el modal (mostramos TODAS las transacciones en el detalle, incluidas las asignaciones)
        const ventasAcumuladasDetalle = ventasData.filter(v => v.alumno === alumno.nombre);
        card.addEventListener('click', () => mostrarDetalleBoletos(alumno.nombre, ventasAcumuladasDetalle));
        
        container.appendChild(card);
    });
}

/**
 * Muestra el modal con el detalle de los boletos vendidos por un alumno.
 * @param {string} nombre - Nombre del alumno.
 * @param {Array} detalles - Array de objetos de venta (incluye asignaciones base).
 */
function mostrarDetalleBoletos(nombre, detalles) {
    const modal = document.getElementById('detalle-modal');
    const nombreHeader = document.getElementById('modal-alumno-nombre');
    const listaUL = document.getElementById('boletos-detalle-lista');

    nombreHeader.textContent = `Detalle de Boletos: ${nombre}`;
    listaUL.innerHTML = ''; 

    // Aquí mostramos TODAS las transacciones registradas, incluyendo las de monto 0
    if (detalles.length === 0) {
        listaUL.innerHTML = '<li>Aún no ha vendido boletos nuevos registrados en el sistema.</li>';
    } else {
        detalles.forEach(venta => {
            const li = document.createElement('li');
            li.innerHTML = `
                Función ${venta.fecha} | Mesa ${venta.mesa}, Asiento ${venta.asiento}<br>
                Monto: ${venta.monto === 0 ? 'BASE/ASIGNADO' : `$${venta.monto}`} | Pago: ${venta.pago}
            `;
            listaUL.appendChild(li);
        });
    }

    modal.style.display = 'block';
}

// Iniciar el dashboard al cargar
document.addEventListener('DOMContentLoaded', renderizarDashboard);