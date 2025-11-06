// reporte.js

const META_BOLETOS = 30;

let alumnosData = []; 
let ventasData = [];

// La función principal para cargar y renderizar los datos
async function renderizarDashboard() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = '<h2>Cargando datos...</h2>';

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
    
    container.innerHTML = ''; 

    // --- Procesamiento y Renderizado de Tarjetas ---
    
    alumnosData.forEach(alumno => {
        const ventasPagadas = ventasData.filter(v => v.alumno === alumno.nombre && v.monto > 0);
        const totalVendido = alumno.vendidos_iniciales + ventasPagadas.length;
        const progreso = Math.min(100, Math.round((totalVendido / META_BOLETOS) * 100));

        const card = document.createElement('div');
        card.classList.add('alumno-card');
        card.dataset.nombre = alumno.nombre;
        
        // Determinar el color del progreso (usamos el color de acento si es menor, verde si se alcanza la meta)
        const colorProgreso = progreso >= 100 ? 'var(--color-alcanzada)' : 'var(--color-acento)';

        card.innerHTML = `
            <h3>${alumno.nombre}</h3>
            
            <div class="progreso-circular ${progreso >= 100 ? 'meta-alcanzada' : ''}" 
                 style="background: conic-gradient(${colorProgreso} ${progreso}%, var(--color-meta) ${progreso}%)">
                <div class="progreso-inner">${totalVendido}</div>
            </div>

            <div class="progreso-info">
                <span>${totalVendido}</span> boletos vendidos
            </div>
            <div class="progreso-info">
                Faltan: <span>${Math.max(0, META_BOLETOS - totalVendido)}</span> para la meta.
            </div>
        `;
        
        card.addEventListener('click', () => mostrarDetalleBoletos(alumno.nombre));
        
        container.appendChild(card);
    });
}

/**
 * Función para ejecutar la eliminación/transferencia/personalización.
 * @param {string} action 'eliminar', 'transferir', o 'personalizar'
 * @param {object} ventaData Datos del boleto original.
 * @param {string} [data=''] Nuevo alumno o nombre de dueño.
 */
async function ejecutarAccion(action, ventaData, data = '') {
    let ventasModificadas = ventasData.map(v => ({...v}));
    const targetIndex = ventaData.originalIndex;
    let mensaje;

    if (targetIndex === undefined || targetIndex < 0 || targetIndex >= ventasModificadas.length) {
         alert("Error interno: No se pudo localizar el boleto original para modificar.");
         return;
    }

    if (action === 'eliminar') {
        ventasModificadas = ventasModificadas.filter((v, i) => i !== targetIndex);
        mensaje = `¿Confirma ELIMINAR el boleto M${ventaData.mesa}-A${ventaData.asiento} de ${ventaData.alumno}? ESTO DESBLOQUEARÁ EL ASIENTO.`;
    } else if (action === 'transferir') {
        const nuevaVenta = {
            alumno: data, // El nuevo alumno es el destino de la transferencia
            mesa: ventaData.mesa,
            asiento: ventaData.asiento,
            fecha: ventaData.fecha,
            monto: ventaData.monto,
            pago: ventaData.pago,
            duenio: ventaData.duenio 
        };
        // 1. Elimina el boleto original por índice
        ventasModificadas.splice(targetIndex, 1);
        // 2. Añade el nuevo boleto (la nueva venta)
        ventasModificadas.push(nuevaVenta);
        mensaje = `¿Confirma transferir el boleto M${ventaData.mesa}-A${ventaData.asiento} de ${ventaData.alumno} a ${data}?`;
    } else if (action === 'personalizar') {
        ventasModificadas[targetIndex].duenio = data; // El nuevo nombre de dueño
        mensaje = `¿Confirma cambiar el dueño del boleto M${ventaData.mesa}-A${ventaData.asiento} a ${data}?`;
    } else {
        return;
    }

    if (confirm(mensaje)) {
        window.electronAPI.reescribirVentas(ventasModificadas)
            .then(resultado => {
                if (resultado.success) {
                    alert(`Boleto ${action === 'eliminar' ? 'eliminado' : (action === 'transferir' ? 'transferido' : 'actualizado')} con éxito. Recargando el reporte...`);
                    location.reload(); 
                } else {
                    alert(`Error al ejecutar la acción: ${resultado.message}`);
                }
            })
            .catch(error => {
                console.error("Error IPC al modificar ventas:", error);
                alert("Error crítico de comunicación.");
            });
    }
}

/**
 * Muestra el modal con el detalle de los boletos vendidos por un alumno.
 */
function mostrarDetalleBoletos(nombre) {
    const modal = document.getElementById('detalle-modal');
    const nombreHeader = document.getElementById('modal-alumno-nombre');
    const listaUL = document.getElementById('boletos-detalle-lista');

    nombreHeader.textContent = `Detalle de Boletos: ${nombre}`;
    listaUL.innerHTML = ''; 
    
    // Filtramos las ventas del alumno y añadimos el índice original para eliminar
    const detalles = ventasData.map((v, index) => ({...v, originalIndex: index}))
                              .filter(v => v.alumno === nombre);

    if (detalles.length === 0) {
        listaUL.innerHTML = '<li>Aún no ha vendido boletos registrados.</li>';
    } else {
        detalles.forEach(venta => {
            const li = document.createElement('li');
            const esAsignacionBase = venta.monto === 0;
            const duenio = venta.duenio || venta.alumno;
            
            li.innerHTML = `
                <div>
                    Función ${venta.fecha} | M${venta.mesa}-A${venta.asiento} | Dueño: **${duenio}**<br>
                    Monto: ${esAsignacionBase ? 'BASE/ASIGNADO' : `$${venta.monto}`} | Pago: ${venta.pago}
                </div>
                
                <div class="control-boletos-detalle">
                    <button data-venta='${JSON.stringify(venta)}' 
                            data-action="transferir" id="btn-transferir">Transferir</button>
                            
                    <button data-venta='${JSON.stringify(venta)}' 
                            data-action="personalizar" 
                            id="btn-personalizar" style="background-color: #4BACC6;">Personalizar</button>
                            
                    <button data-venta='${JSON.stringify(venta)}' 
                            data-action="eliminar" 
                            id="btn-eliminar">Eliminar</button>
                </div>
            `;
            listaUL.appendChild(li);
        });

        // AÑADIR LISTENERS A LOS NUEVOS BOTONES (Transferir/Eliminar/Personalizar)
        listaUL.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ventaData = JSON.parse(e.currentTarget.dataset.venta);
                const action = e.currentTarget.dataset.action;
                
                if (action === 'eliminar') {
                    ejecutarAccion('eliminar', ventaData);
                } else if (action === 'transferir') {
                    mostrarModalTransferencia(ventaData);
                } else if (action === 'personalizar') {
                    mostrarModalPersonalizacion(ventaData);
                }
                
                // Ocultar modal de detalle (la acción se ejecutará o se abrirá el de transferencia/personalización)
                modal.style.display = 'none'; 
            });
        });
    }

    modal.style.display = 'block';
}


/**
 * Muestra el modal para seleccionar el alumno destino para la transferencia.
 */
function mostrarModalTransferencia(ventaData) {
    const transferModal = document.getElementById('transfer-modal');
    const infoSpan = document.getElementById('transfer-info');
    const select = document.getElementById('alumno-destino-select');
    const btnConfirmar = document.getElementById('btn-confirmar-transferencia');

    infoSpan.innerHTML = `Transfiriendo boleto **M${ventaData.mesa}-A${ventaData.asiento}** de <b>${ventaData.alumno}</b>.`;

    // 1. Llenar el selector de alumnos
    select.innerHTML = '<option value="" disabled selected>--- Seleccionar Alumno ---</option>';
    alumnosData.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(alumno => {
        // No permitir transferir al mismo alumno
        if (alumno.nombre !== ventaData.alumno) {
            const option = document.createElement('option');
            option.value = alumno.nombre;
            option.textContent = alumno.nombre;
            select.appendChild(option);
        }
    });

    // 2. Limpiar listeners previos y asignar el nuevo evento
    btnConfirmar.onclick = null;
    btnConfirmar.onclick = () => {
        const nuevoAlumno = select.value;
        if (!nuevoAlumno) {
            alert("Por favor, selecciona un alumno destino.");
            return;
        }
        
        ejecutarAccion('transferir', ventaData, nuevoAlumno);
        transferModal.style.display = 'none';
    };

    transferModal.style.display = 'block';
}

/**
 * Muestra el modal para modificar el nombre del dueño del boleto.
 */
function mostrarModalPersonalizacion(ventaData) {
    const personalizeModal = document.getElementById('personalize-modal');
    const infoSpan = document.getElementById('personalize-info');
    const input = document.getElementById('nuevo-duenio-input');
    const btnConfirmar = document.getElementById('btn-confirmar-personalizacion');

    infoSpan.innerHTML = `Boleto **M${ventaData.mesa}-A${ventaData.asiento}** (Vendedor: <b>${ventaData.alumno}</b>).`;
    input.value = ventaData.duenio || ventaData.alumno;
    
    // 1. Limpiar listeners previos y asignar el nuevo evento
    btnConfirmar.onclick = null;
    btnConfirmar.onclick = () => {
        const nuevoDueno = input.value.trim();
        if (!nuevoDueno) {
            alert("Por favor, ingresa un nombre para el dueño.");
            return;
        }
        
        ejecutarAccion('personalizar', ventaData, nuevoDueno);
        personalizeModal.style.display = 'none';
    };

    personalizeModal.style.display = 'block';
}


// Iniciar el dashboard al cargar
document.addEventListener('DOMContentLoaded', renderizarDashboard);