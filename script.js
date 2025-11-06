// BOLROA/script.js
// --- 1. Definición de la estructura de Mesas ---
const estructuraMesas = [
    { id: 1, asientos: 6 }, { id: 2, asientos: 6 }, { id: 3, asientos: 6 }, { id: 4, asientos: 6 },
    { id: 5, asientos: 6 }, { id: 6, asientos: 6 }, { id: 7, asientos: 6 }, { id: 8, asientos: 6 },
    { id: 9, asientos: 6 }, { id: 10, asientos: 6 }, { id: 11, asientos: 6 }, { id: 12, asientos: 6 },
    { id: 13, asientos: 6, especial: 'accesible' }, 
    { id: 14, asientos: 6 }, { id: 15, asientos: 6 }, { id: 16, asientos: 6 },

    { id: 17, asientos: 8 }, { id: 18, asientos: 8 }, { id: 19, asientos: 8 }, { id: 20, asientos: 8 },
    { id: 21, asientos: 8 }, { id: 22, asientos: 8 }, { id: 23, asientos: 8 }, { id: 24, asientos: 8 },
    { id: 25, asientos: 8 }, { id: 26, asientos: 8 }, { id: 27, asientos: 8 }, { id: 28, asientos: 8 },
    { id: 29, asientos: 4 }, 
    { id: 30, asientos: 8 }, { id: 31, asientos: 8 }, { id: 32, asientos: 8 }, { id: 33, asientos: 8 },
    { id: 34, asientos: 8 },
];

const TOTAL_ASIENTOS = estructuraMesas.reduce((sum, mesa) => sum + mesa.asientos, 0);
const TOTAL_ASIENTOS_TEMPORADA = TOTAL_ASIENTOS * 6; // 6 funciones

// --- 2. Variables de Estado Global y Configuración ---
let alumnosData = []; 
let ventasData = []; 
let currentPrecioUnitario = 450;
const boletosSeleccionados = new Map(); 
const boletosBaseSeleccionados = new Map(); 
let boletosPersonalizados = new Map(); 

// --- 6. Variables de Seguridad (REMOVIDAS) ---


// --- 3. Funciones de Comunicación de Datos (IPC) ---

async function cargarDatosInicialesDesdeElectron() {
    const alumnoSelect = document.getElementById('alumno-select');
    const alumnoBaseSelect = document.getElementById('alumno-base-select');
    
    if (alumnosData.length === 0) {
        alumnoSelect.innerHTML = '<option value="">Cargando Alumnos...</option>';
        alumnoBaseSelect.innerHTML = '<option value="">Cargando Alumnos...</option>';
    }

    try {
        const resultado = await window.electronAPI.cargarDatos();

        if (resultado.success) {
            alumnosData = resultado.data.alumnos || [];
            ventasData = resultado.data.ventas || []; 
            
            poblarAlumnos();
            cargarAlumnosBase(); 
            bloquearAsientosVendidos();
            asignarListenersAsientos(); 
            actualizarDashboardGlobal(); 
        } else {
            const errorMessage = resultado.message || "Error desconocido al cargar datos.";
            alumnoSelect.innerHTML = `<option value="" disabled selected>${errorMessage}</option>`;
            alumnoBaseSelect.innerHTML = `<option value="" disabled selected>${errorMessage}</option>`;
        }

    } catch (error) {
        alumnoSelect.innerHTML = '<option value="">ERROR CRÍTICO DE APLICACIÓN</option>';
        alumnoBaseSelect.innerHTML = '<option value="">ERROR CRÍTICO DE APLICACIÓN</option>';
        console.error("Error al cargar datos iniciales:", error);
    }
}

// Para el botón de eliminar, usamos el handler reescribirVentas
async function eliminarVentaEnElectron(ventaAEliminar) {
    // Filtramos la venta a eliminar del array de ventasData 
    const ventasActualizadas = ventasData.filter((v, index) => {
        return index !== ventaAEliminar.originalIndex;
    });
    
    try {
         const resultado = await window.electronAPI.reescribirVentas(ventasActualizadas);

        if (resultado.success) {
            location.reload(); 
        } else {
            console.error(`Error al reescribir ventas: ${resultado.message}`);
            alert(`Error al reescribir ventas. Verifica la Consola.`);
        }
    } catch (error) {
        console.error("Error de comunicación Electron/IPC al eliminar:", error);
        alert("Error crítico al eliminar el boleto.");
    }
}

async function guardarVentaEnElectron(nuevaVenta) {
    try {
        const resultado = await window.electronAPI.guardarVenta(nuevaVenta);

        if (resultado.success) {
            location.reload(); 
        } else {
            console.error(`Error al intentar guardar la venta: ${resultado.message}`);
            alert(`Error al intentar guardar la venta. Verifica la Consola.`);
            return; 
        }
    } catch (error) {
        console.error("Error de comunicación Electron/IPC:", error);
        alert("Error crítico al guardar la venta.");
    }
}

async function agregarNuevoAlumno() {
    const inputAlumno = document.getElementById('nuevo-alumno-input');
    const alumnoSelect = document.getElementById('alumno-select');
    const controlDiv = document.getElementById('nuevo-alumno-control');
    const toggleBtn = document.getElementById('btn-toggle-nuevo-alumno');

    const nombre = inputAlumno.value.trim();

    if (nombre === "") {
        alert("Por favor, ingresa un nombre para el nuevo alumno.");
        return;
    }
    
    if (alumnosData.some(a => a.nombre.toUpperCase() === nombre.toUpperCase())) {
        alert(`El alumno "${nombre}" ya existe en la lista.`);
        return;
    }

    const nuevoAlumno = {
        nombre: nombre,
        vendidos_iniciales: 0
    };
    alumnosData.push(nuevoAlumno);
    alumnosData.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    const resultadoGuardado = await window.electronAPI.guardarAlumnos(alumnosData);
    
    if (!resultadoGuardado.success) {
        alert(`Error Crítico al guardar el nuevo alumno de forma permanente: ${resultadoGuardado.message}`);
        alumnosData = alumnosData.filter(a => a.nombre !== nombre); 
        return;
    }
    
    poblarAlumnos();
    cargarAlumnosBase();
    alumnoSelect.value = nombre;
    inputAlumno.value = '';
    controlDiv.style.display = 'none';
    alumnoSelect.style.display = 'block';
    toggleBtn.textContent = '➕ Registrar Nuevo Alumno';
    alumnoSelect.required = true;

    actualizarResumenYBoton();
    
    alert(`Alumno "${nombre}" agregado a la lista de forma permanente.`);
}


// --- 4. Lógica de Negocio y UI ---

// NUEVA FUNCIÓN: Actualiza Gráficas (1, 2, 4)
function actualizarDashboardGlobal() {
    const funcionActualId = document.getElementById('funcion').value;
    const btnAsignacion = document.getElementById('btn-asignacion');
    
    // --- Cálculo de la Temporada (2) ---
    const todasLasVentasPagadas = ventasData.filter(v => v.monto > 0);
    const todosLosBoletosBase = alumnosData.reduce((sum, alumno) => sum + alumno.vendidos_iniciales, 0);
    
    const totalVendidoTemporada = todasLasVentasPagadas.length + todosLosBoletosBase;
    
    const porcentajeTemporada = Math.min(100, Math.round((totalVendidoTemporada / TOTAL_ASIENTOS_TEMPORADA) * 100));
    
    const graficaTemporada = document.getElementById('grafica-temporada');
    // FIX 1: Aplicar el gradiente circular para mostrar el progreso
    graficaTemporada.style.background = `conic-gradient(var(--color-interactivo) ${porcentajeTemporada}%, var(--color-meta) ${porcentajeTemporada}%)`;
    graficaTemporada.querySelector('.progreso-porcentaje').textContent = `${porcentajeTemporada}%`;
    graficaTemporada.title = `Boletos vendidos (Pagados/Base): ${totalVendidoTemporada}/${TOTAL_ASIENTOS_TEMPORADA} (${porcentajeTemporada}%)`;
    
    // --- Cálculo de la Función Actual (1) ---
    const vendidosFuncion = ventasData.filter(v => v.fecha === funcionActualId).length;
    const porcentajeFuncion = Math.min(100, Math.round((vendidosFuncion / TOTAL_ASIENTOS) * 100));
    
    const graficaFuncion = document.getElementById('grafica-funcion');
    // FIX 1: Aplicar el gradiente circular para mostrar el progreso
    graficaFuncion.style.background = `conic-gradient(var(--color-interactivo) ${porcentajeFuncion}%, var(--color-meta) ${porcentajeFuncion}%)`;
    graficaFuncion.querySelector('.progreso-porcentaje').textContent = `${porcentajeFuncion}%`;
    graficaFuncion.title = `Asientos Asignados Función ${funcionActualId}: ${vendidosFuncion}/${TOTAL_ASIENTOS} (${porcentajeFuncion}%)`;
    
    // --- Lógica del Botón Asignar (3, 4) ---
    const totalAsignados = ventasData.filter(v => v.monto === 0).length;
    
    if (totalAsignados >= todosLosBoletosBase) {
        btnAsignacion.style.display = 'none';
    } else {
        btnAsignacion.style.display = 'inline-block';
        const restantes = todosLosBoletosBase - totalAsignados;
        btnAsignacion.textContent = `📍 Asignar Boletos No Asignados (${restantes} restantes)`;
    }
}


function poblarAlumnos() {
    const select = document.getElementById('alumno-select');
    select.innerHTML = '<option value="" disabled selected>Selecciona un Alumno</option>';
    
    alumnosData.sort((a, b) => a.nombre.localeCompare(b.nombre));

    alumnosData.forEach(alumno => {
        const option = document.createElement('option');
        option.value = alumno.nombre;
        option.textContent = alumno.nombre;
        option.dataset.iniciales = alumno.vendidos_iniciales || 0; 
        select.appendChild(option);
    });
}

function cargarAlumnosBase() {
    const selectAlumno = document.getElementById('alumno-base-select');
    const selectFuncion = document.getElementById('funcion-base-select');
    const selectFuncionVenta = document.getElementById('funcion');
    
    selectAlumno.innerHTML = '<option value="" disabled selected>Selecciona Alumno Base</option>';
    alumnosData.forEach(alumno => {
        const option = document.createElement('option');
        option.value = alumno.nombre;
        option.textContent = alumno.nombre;
        selectAlumno.appendChild(option);
    });
    
    selectFuncion.innerHTML = ''; 
    Array.from(selectFuncionVenta.options).forEach(option => {
        if (option.value) {
            const newOption = option.cloneNode(true);
            selectFuncion.appendChild(newOption);
        }
    });
}

function bloquearAsientosVendidos() {
    document.querySelectorAll('.asiento').forEach(asiento => {
        asiento.classList.remove('bloqueado', 'seleccionado');
    });
    boletosSeleccionados.clear();
    boletosBaseSeleccionados.clear();
    boletosPersonalizados.clear(); 
    actualizarResumenYBoton(); 

    const funcionVenta = document.getElementById('funcion').value;
    const funcionBase = document.getElementById('funcion-base-select').value;
    
    const modoAsignacionActivo = document.getElementById('asignacion-base-section').style.display !== 'none';

    const funcionActual = modoAsignacionActivo 
        ? funcionBase 
        : funcionVenta;

    const asientosVendidos = ventasData.filter(v => v.fecha === funcionActual);

    asientosVendidos.forEach(venta => {
        const idAsiento = `M${venta.mesa}-A${venta.asiento}`;
        const asientoElements = document.querySelectorAll(`.asiento[data-id="${idAsiento}"]`);
        
        asientoElements.forEach(asientoElement => {
            if (asientoElement) {
                asientoElement.classList.add('bloqueado');
            }
        });
    });
    
    if (modoAsignacionActivo) {
        actualizarBaseResumen();
    }
    
    actualizarDashboardGlobal(); 
}

function calcularMonto() {
    const alumnoSelect = document.getElementById('alumno-select');
    const alumnoSeleccionado = alumnoSelect.options[alumnoSelect.selectedIndex];
    
    const cantidadBoletosSeleccionados = boletosSeleccionados.size;
    
    let precio = 0;
    
    const btnSeleccionado = document.querySelector('.btn-precio.seleccionado');
    const otroPrecioInput = document.getElementById('otro-precio-input');
    
    if (otroPrecioInput.style.display === 'block' && otroPrecioInput.value && !isNaN(parseInt(otroPrecioInput.value))) {
        precio = parseInt(otroPrecioInput.value, 10);
    } else if (btnSeleccionado && btnSeleccionado.id !== 'btn-toggle-otro-precio') {
        precio = parseInt(btnSeleccionado.dataset.precio, 10);
    } else {
        precio = 450; 
    }

    let boletosAcumulados = 0;
    if (alumnoSeleccionado && alumnoSeleccionado.value) {
        const nombreAlumno = alumnoSeleccionado.value;
        const iniciales = parseInt(alumnoSeleccionado.dataset.iniciales, 10);

        const ventasPagadas = ventasData.filter(v => v.alumno === nombreAlumno && v.monto > 0).length;
        
        boletosAcumulados = iniciales + ventasPagadas;
    } else {
        boletosAcumulados = 0;
    }
    
    document.getElementById('boletos-acumulados').textContent = boletosAcumulados;

    const montoTotal = cantidadBoletosSeleccionados * precio;
    currentPrecioUnitario = precio;

    document.getElementById('monto-total').value = `$${montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}


function actualizarResumenYBoton() {
    const listaUL = document.getElementById('lista-asientos-seleccionados');
    const btnVender = document.getElementById('btn-vender');
    const alumnoSelect = document.getElementById('alumno-select');
    
    listaUL.innerHTML = ''; 
    calcularMonto();

    const alumnoSeleccionado = alumnoSelect.value; 

    if (boletosSeleccionados.size === 0) {
        listaUL.innerHTML = '<li>Aún no has seleccionado ningún asiento.</li>';
        btnVender.disabled = true;
    } else {
        boletosSeleccionados.forEach((valor, asientoId) => {
            const li = document.createElement('li');
            const nombreDuenio = boletosPersonalizados.get(asientoId) || '';
            const duenioDisplay = nombreDuenio ? ` (${nombreDuenio})` : '';
            
            li.textContent = `✅ M${valor.mesa}-A${valor.asiento} ($${currentPrecioUnitario})${duenioDisplay}`;
            listaUL.appendChild(li);
        });
        
        btnVender.disabled = !(boletosSeleccionados.size > 0 && alumnoSeleccionado);
    }
    
    // Control de personalización (5)
    if (boletosSeleccionados.size > 0) {
        document.getElementById('btn-toggle-personalizar').disabled = false;
        const contenedor = document.getElementById('campos-personalizacion');
        if (contenedor.style.display !== 'none') {
             togglePersonalizar(true); 
        }
    } else {
        document.getElementById('btn-toggle-personalizar').disabled = true;
        document.getElementById('campos-personalizacion').style.display = 'none';
        document.getElementById('btn-toggle-personalizar').textContent = '✏️ Asignar Nombres';
    }
}


function manejarClicAsiento(event) {
    const asientoElement = event.target;
    
    if (asientoElement.classList.contains('bloqueado')) {
        alert('Este asiento ya está vendido y no puede ser seleccionado.');
        return;
    }

    const asientoId = asientoElement.dataset.id;
    const mesaElement = asientoElement.closest('.mesa');
    const mesaId = parseInt(mesaElement.dataset.mesa);
    const asientoNum = parseInt(asientoElement.dataset.asiento);
    
    const modoAsignacionActivo = document.getElementById('asignacion-base-section').style.display !== 'none';

    let mapaObjetivo = boletosSeleccionados;
    if (modoAsignacionActivo) {
        mapaObjetivo = boletosBaseSeleccionados;
    }

    if (asientoElement.classList.contains('seleccionado')) {
        asientoElement.classList.remove('seleccionado');
        mapaObjetivo.delete(asientoId);
        boletosPersonalizados.delete(asientoId); 
    } else {
        asientoElement.classList.add('seleccionado');
        mapaObjetivo.set(asientoId, { mesa: mesaId, asiento: asientoNum });
    }

    if (modoAsignacionActivo) {
        actualizarBaseResumen();
    } else {
        actualizarResumenYBoton();
    }
}

function asignarListenersAsientos() {
    document.querySelectorAll('.asiento').forEach(asiento => {
        asiento.removeEventListener('click', manejarClicAsiento);
        asiento.addEventListener('click', manejarClicAsiento);
    });
}

function manejarEnvioFormulario(event) {
    event.preventDefault(); 
    
    if (boletosSeleccionados.size === 0) {
        alert("Por favor, selecciona al menos un asiento.");
        return;
    }

    const alumnoSelect = document.getElementById('alumno-select');
    const nombreAlumno = alumnoSelect.value;
        
    if (!nombreAlumno) {
         alert("Por favor, selecciona un alumno (o agrégalo si es nuevo).");
         return;
    }

    const funcion = document.getElementById('funcion').value;
    const formaPago = document.getElementById('forma-pago').value;

    const montoTotalDisplay = document.getElementById('monto-total').value;
    const mensaje = `¿Confirma la venta de ${boletosSeleccionados.size} boleto(s) a ${nombreAlumno} por ${montoTotalDisplay}?`;

    mostrarModalConfirmacion(mensaje, () => {
        const nuevaVenta = [];
        boletosSeleccionados.forEach((item, asientoId) => {
             const nombreDuenio = boletosPersonalizados.get(asientoId) || nombreAlumno; 
            
            nuevaVenta.push({
                alumno: nombreAlumno,
                mesa: item.mesa,
                asiento: item.asiento,
                fecha: funcion,
                monto: currentPrecioUnitario, 
                pago: formaPago,
                duenio: nombreDuenio 
            });
        });
        guardarVentaEnElectron(nuevaVenta);
    });
}

// --- LÓGICA DE MODAL DE CONFIRMACIÓN (REEMPLAZO DE confirm()) ---

function mostrarModalConfirmacion(message, onConfirm) {
    const modal = document.getElementById('custom-confirm-modal');
    const messageElement = document.getElementById('confirm-message');
    const btnOk = document.getElementById('confirm-ok');
    const btnCancel = document.getElementById('confirm-cancel');
    
    messageElement.textContent = message;

    btnOk.onclick = null;
    btnCancel.onclick = null;

    btnOk.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    btnCancel.onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'block';
}


// --- LÓGICA DE PERSONALIZACIÓN DE BOLETOS (5) ---

function togglePersonalizar(forceUpdate = false) {
    const contenedor = document.getElementById('campos-personalizacion');
    const btn = document.getElementById('btn-toggle-personalizar');
    const isVisible = contenedor.style.display !== 'none';
    
    if (isVisible && !forceUpdate) {
        contenedor.style.display = 'none';
        btn.textContent = '✏️ Asignar Nombres';
    } else {
        contenedor.innerHTML = '';
        if (boletosSeleccionados.size === 0) {
            contenedor.innerHTML = '<p style="color: #CC0000;">Selecciona asientos primero para asignarles nombres.</p>';
        } else {
            boletosSeleccionados.forEach((valor, id) => {
                const div = document.createElement('div');
                div.style.marginBottom = '10px';

                div.innerHTML = `
                    <label for="duenio-${id}" style="font-weight: 400;">Dueño M${valor.mesa}-A${valor.asiento}:</label>
                    <input type="text" id="duenio-${id}" placeholder="Nombre del dueño" value="${boletosPersonalizados.get(id) || ''}">
                `;
                contenedor.appendChild(div);
                
                // FIX 3: Solo guardamos el valor en el mapa de personalización.
                document.getElementById(`duenio-${id}`).addEventListener('input', (e) => {
                    const nombre = e.target.value.trim();
                    if (nombre) {
                        boletosPersonalizados.set(id, nombre);
                    } else {
                        boletosPersonalizados.delete(id); 
                    }
                    // La llamada a actualizarResumenYBoton() fue eliminada para evitar el bug de enfoque.
                });
                
                if (forceUpdate && !isVisible) {
                    contenedor.style.display = 'none';
                }
            });
        }
        contenedor.style.display = 'block';
        btn.textContent = 'Ocultar Campos de Nombres';
    }
}


// --- LÓGICA DE ASIGNACIÓN BASE ---

function actualizarBaseResumen() {
    const nombreAlumno = document.getElementById('alumno-base-select').value;
    const restantesSpan = document.getElementById('boletos-base-restantes');
    const listaUL = document.getElementById('lista-base-seleccionados');
    
    if (!nombreAlumno) {
        restantesSpan.textContent = '0';
        listaUL.innerHTML = '<li>Selecciona un alumno.</li>';
        return;
    }

    const alumno = alumnosData.find(a => a.nombre === nombreAlumno);
    const iniciales = alumno ? alumno.vendidos_iniciales : 0;
    
    const asignados = ventasData.filter(v => v.alumno === nombreAlumno && v.monto === 0).length;
    
    const restantes = iniciales - asignados;
    restantesSpan.textContent = restantes;

    listaUL.innerHTML = '';
    boletosBaseSeleccionados.forEach((valor) => {
        const li = document.createElement('li');
        li.textContent = `✅ M${valor.mesa}-A${valor.asiento}`;
        listaUL.appendChild(li);
    });
    
    if (boletosBaseSeleccionados.size === 0) {
        listaUL.innerHTML = '<li>Selecciona asientos en el mapa.</li>';
    }
    
    if (restantes < 0) {
        restantesSpan.textContent = "Error";
    }
}

function manejarEnvioAsignacion(event) {
    event.preventDefault();

    const nombreAlumno = document.getElementById('alumno-base-select').value;
    const funcion = document.getElementById('funcion-base-select').value;
    const restantes = parseInt(document.getElementById('boletos-base-restantes').textContent, 10);
    const numSeleccionados = boletosBaseSeleccionados.size;

    if (!nombreAlumno || !funcion) {
        alert("Debes seleccionar un Alumno y una Función.");
        return;
    }

    if (numSeleccionados === 0) {
        alert("Debes seleccionar al menos un asiento.");
        return;
    }
    
    if (restantes < 0) {
        alert("Error en el conteo de boletos base. No se puede asignar.");
        return;
    }

    let mensaje;
    if (numSeleccionados > restantes && restantes >= 0) {
         mensaje = `El alumno solo tiene ${restantes} boletos base restantes. ¿Deseas asignar ${numSeleccionados} lugares de todas formas? (Esto generará un conteo negativo en el reporte)`;
    } else {
         mensaje = `¿Confirma la asignación de ${boletosBaseSeleccionados.size} lugar(es) a ${nombreAlumno} para la función ${funcion}? Estos se registrarán como boletos base.`;
    }
    
    mostrarModalConfirmacion(mensaje, () => {
        const asignaciones = [];
        boletosBaseSeleccionados.forEach(item => {
            const nombreDuenio = nombreAlumno; 
            asignaciones.push({
                alumno: nombreAlumno,
                mesa: item.mesa,
                asiento: item.asiento,
                fecha: funcion,
                monto: 0, 
                pago: 'ASIGNACION BASE',
                duenio: nombreDuenio
            });
        });
        guardarVentaEnElectron(asignaciones);
    });
}


// --- LÓGICA DE SEGURIDAD Y ADMINISTRACIÓN (REMOVIDA) ---

// Se remueve toda la lógica de contraseña, autenticación y expiración de sesión.

function cambiarContrasena() {
    alert("La función de cambiar contraseña ha sido deshabilitada en esta versión sin seguridad.");
}


// --- DESCARGA A EXCEL (9) ---

function descargarListaFuncion() {
    const funcionId = document.getElementById('funcion').value;
    const funcionSelect = document.getElementById('funcion');
    const funcionNombre = funcionSelect.options[funcionSelect.selectedIndex].textContent;
    
    const ventasFuncion = ventasData.filter(v => v.fecha === funcionId);
    
    if (ventasFuncion.length === 0) {
        alert(`No hay boletos vendidos para la función ${funcionId}.`);
        return;
    }

    const dataParaExcel = ventasFuncion.map(v => ({
        'Alumno Vendedor': v.alumno,
        'Mesa': v.mesa,
        'Asiento': v.asiento,
        'Nombre Dueño Boleto': v.duenio || v.alumno,
        'Precio Venta': v.monto > 0 ? `$${v.monto}` : 'BASE',
        'Forma Pago': v.pago
    }));

    if (typeof XLSX === 'undefined') {
        alert("Error: La librería XLSX no está cargada. Verifica que './libs/xlsx.full.min.js' esté disponible.");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(dataParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lista Acomodadores");
    
    const filename = `Lista_Acomodadores_${funcionNombre.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    
    // MODIFICACIÓN CRÍTICA: Escribe a Buffer/Binary y usa IPC para guardar.
    const wbout = XLSX.write(wb, { type: 'binary', bookType: "xlsx" });

    // Llama a la API de Electron para guardar el archivo
    window.electronAPI.guardarArchivo(wbout, filename)
        .then(result => {
            if (result.success) {
                 alert(`Archivo "${filename}" generado y guardado en la carpeta de Descargas.`);
            } else {
                 alert(`Error al guardar el archivo: ${result.message}`);
            }
        })
        .catch(error => {
            console.error("Error IPC al guardar archivo:", error);
            alert("Error crítico de comunicación al guardar el archivo.");
        });
}


// FUNCIÓN FALTANTE: Abre la ventana de reportes (Fallo 2)
function abrirReporte() {
    // Esto disparará el 'setWindowOpenHandler' configurado en main.js
    window.open('reporte.html', 'Reporte de Ventas'); 
}

function renderizarMesas() {
    const contenedor = document.getElementById('contenedor-mesas');
    const contenedorBase = document.getElementById('contenedor-mesas-base');
    contenedor.innerHTML = '';
    contenedorBase.innerHTML = '';

    estructuraMesas.forEach(mesa => {
        const card = document.createElement('div');
        card.classList.add('mesa');
        card.dataset.mesa = mesa.id;
        if (mesa.especial) card.classList.add(mesa.especial);

        card.innerHTML = `<div class="etiqueta-mesa">MESA ${mesa.id}</div>
                          <div class="asientos"></div>
                          ${mesa.especial === 'accesible' ? '<span class="icono-discapacidad">♿</span>' : ''}`;

        const asientosDiv = card.querySelector('.asientos');
        for (let i = 1; i <= mesa.asientos; i++) {
            const asiento = document.createElement('div');
            asiento.classList.add('asiento');
            asiento.dataset.id = `M${mesa.id}-A${i}`;
            asiento.dataset.mesa = mesa.id;
            asiento.dataset.asiento = i;
            asiento.textContent = i;
            asientosDiv.appendChild(asiento);
        }
        
        contenedor.appendChild(card);
        contenedorBase.appendChild(card.cloneNode(true)); // Clonar para la sección de asignación base
    });
    
    asignarListenersAsientos(); 
}

function iniciarApp() {
    renderizarMesas();

    document.getElementById('funcion').addEventListener('change', bloquearAsientosVendidos); 
    document.getElementById('alumno-select').addEventListener('change', actualizarResumenYBoton);
    document.getElementById('formulario-venta').addEventListener('submit', manejarEnvioFormulario);
    
    // --- Listeners de botones de precio ---
    document.querySelectorAll('.btn-precio').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.btn-precio').forEach(b => b.classList.remove('seleccionado'));
            this.classList.add('seleccionado');
            
            const otroPrecioInput = document.getElementById('otro-precio-input');
            if (this.id === 'btn-toggle-otro-precio') {
                otroPrecioInput.style.display = 'block';
                otroPrecioInput.value = ''; // Limpiar el valor para forzar el recálculo
            } else {
                otroPrecioInput.style.display = 'none';
                otroPrecioInput.value = '';
            }
            actualizarResumenYBoton(); 
        });
    });
    
    document.getElementById('otro-precio-input').addEventListener('input', actualizarResumenYBoton);
    
    // Listeners de la sección de Nuevo Alumno
    document.getElementById('btn-toggle-nuevo-alumno').addEventListener('click', function() {
        const controlDiv = document.getElementById('nuevo-alumno-control');
        const alumnoSelect = document.getElementById('alumno-select');
        const isVisible = controlDiv.style.display === 'block';

        if (isVisible) {
            controlDiv.style.display = 'none';
            alumnoSelect.style.display = 'block';
            alumnoSelect.required = true;
            this.textContent = '➕ Registrar Nuevo Alumno';
        } else {
            controlDiv.style.display = 'flex';
            alumnoSelect.style.display = 'none';
            alumnoSelect.required = false;
            this.textContent = 'Ocultar Registro';
        }
    });

    document.getElementById('btn-agregar-alumno').addEventListener('click', agregarNuevoAlumno);

    // Listeners para la sección de Asignación Base (Control del Toggle)
    document.getElementById('btn-asignacion').addEventListener('click', function() {
        const mainSection = document.querySelector('main.container');
        const asignacionSection = document.getElementById('asignacion-base-section');
        mainSection.style.display = 'none';
        asignacionSection.style.display = 'flex';
        bloquearAsientosVendidos(); 
        actualizarDashboardGlobal();
    });
    
    document.getElementById('btn-cancelar-asignacion').addEventListener('click', function() {
        const mainSection = document.querySelector('main.container');
        const asignacionSection = document.getElementById('asignacion-base-section');
        asignacionSection.style.display = 'none';
        mainSection.style.display = 'flex';
        bloquearAsientosVendidos(); 
        actualizarDashboardGlobal();
    });
    
    // Listeners para la lógica de Asignación Base
    document.getElementById('alumno-base-select').addEventListener('change', bloquearAsientosVendidos);
    document.getElementById('funcion-base-select').addEventListener('change', bloquearAsientosVendidos);
    document.getElementById('formulario-asignacion').addEventListener('submit', manejarEnvioAsignacion);

    // Listeners de Reporte y Descarga (6, 7, 9)
    document.getElementById('btn-reporte').addEventListener('click', abrirReporte);
    document.getElementById('btn-descargar-funcion').addEventListener('click', descargarListaFuncion); 
    
    // Listener de Personalización (5)
    document.getElementById('btn-toggle-personalizar').addEventListener('click', () => togglePersonalizar(false));
    
    // Listener de Seguridad (REMOVIDO)
    document.getElementById('btn-toggle-cambiar-pass').addEventListener('click', function() {
        alert("La función de cambio de contraseña ha sido deshabilitada en esta versión sin seguridad.");
    });
    const btnGuardarPass = document.getElementById('btn-guardar-pass');
    if (btnGuardarPass) {
        btnGuardarPass.addEventListener('click', cambiarContrasena);
    }
    
    cargarDatosInicialesDesdeElectron();
}

document.addEventListener('DOMContentLoaded', iniciarApp);