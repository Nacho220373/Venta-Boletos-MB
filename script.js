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

// --- 2. Variables de Estado Global y Configuración ---
let alumnosData = []; 
let ventasData = []; 
let currentPrecioUnitario = 450;
const boletosSeleccionados = new Map(); 
const boletosBaseSeleccionados = new Map(); 

// --- 3. Funciones de Comunicación de Datos (IPC) ---

async function cargarDatosInicialesDesdeElectron() {
    const alumnoSelect = document.getElementById('alumno-select');
    const alumnoBaseSelect = document.getElementById('alumno-base-select');
    
    // Solo mostrar cargando si están vacíos
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

async function guardarVentaEnElectron(nuevaVenta) {
    try {
        const resultado = await window.electronAPI.guardarVenta(nuevaVenta);

        if (resultado.success) {
            // Se elimina el alert nativo. La recarga de página confirmará el éxito.
            location.reload(); 
        } else {
            console.error(`Error al intentar guardar la venta: ${resultado.message}`);
            alert(`Error al intentar guardar la venta. Verifica la Consola.`); // Mantenemos el alert para errores críticos de guardado
            return; 
        }


    } catch (error) {
        console.error("Error de comunicación Electron/IPC:", error);
        alert("Error crítico al guardar la venta.");
    }
}


// --- 4. Lógica de Negocio y UI ---

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
    
    // Se eliminó la condición para asegurar que el select de alumnos base siempre se pueble.
    selectAlumno.innerHTML = '<option value="" disabled selected>Selecciona Alumno Base</option>';
    alumnosData.forEach(alumno => {
        const option = document.createElement('option');
        option.value = alumno.nombre;
        option.textContent = alumno.nombre;
        selectAlumno.appendChild(option);
    });
    

    // Llenar Funciones
    selectFuncion.innerHTML = ''; 
    Array.from(selectFuncionVenta.options).forEach(option => {
        if (option.value) {
            const newOption = option.cloneNode(true);
            selectFuncion.appendChild(newOption);
        }
    });
}

function bloquearAsientosVendidos() {
    // Al bloquear asientos, limpia todas las selecciones de AMBOS modos.
    document.querySelectorAll('.asiento').forEach(asiento => {
        asiento.classList.remove('bloqueado', 'seleccionado');
    });
    boletosSeleccionados.clear();
    boletosBaseSeleccionados.clear();
    actualizarResumenYBoton(); // Actualiza el resumen de venta principal.

    const funcionVenta = document.getElementById('funcion').value;
    const funcionBase = document.getElementById('funcion-base-select').value;
    
    const modoAsignacionActivo = document.getElementById('asignacion-base-section').style.display !== 'none';

    const funcionActual = modoAsignacionActivo 
        ? funcionBase 
        : funcionVenta;

    const asientosVendidos = ventasData.filter(v => v.fecha === funcionActual);

    // FIX: Se usa querySelectorAll para bloquear el asiento en AMBOS contenedores (venta y asignación)
    asientosVendidos.forEach(venta => {
        const idAsiento = `M${venta.mesa}-A${venta.asiento}`;
        const asientoElements = document.querySelectorAll(`.asiento[data-id="${idAsiento}"]`);
        
        asientoElements.forEach(asientoElement => {
            if (asientoElement) {
                asientoElement.classList.add('bloqueado');
            }
        });
    });
    
    // Si estamos en modo asignación, actualizamos su resumen después de bloquear.
    if (modoAsignacionActivo) {
        actualizarBaseResumen();
    }
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

        // FIX: Sólo contamos las ventas donde el monto es mayor a 0, ignorando las asignaciones base.
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
        boletosSeleccionados.forEach((valor) => {
            const li = document.createElement('li');
            li.textContent = `✅ M${valor.mesa}-A${valor.asiento} ($${currentPrecioUnitario})`;
            listaUL.appendChild(li);
        });
        
        // El botón Vender solo se habilita si hay asientos y un alumno seleccionado (sea nuevo o viejo).
        btnVender.disabled = !(boletosSeleccionados.size > 0 && alumnoSeleccionado);
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

    const mensaje = `¿Confirma la venta de ${boletosSeleccionados.size} boleto(s) a ${nombreAlumno} por ${document.getElementById('monto-total').value}?`;

    // Reemplaza confirm() con el modal personalizado
    mostrarModalConfirmacion(mensaje, () => {
        const nuevaVenta = [];
        boletosSeleccionados.forEach(item => {
            nuevaVenta.push({
                alumno: nombreAlumno,
                mesa: item.mesa,
                asiento: item.asiento,
                fecha: funcion,
                monto: currentPrecioUnitario, 
                pago: formaPago
            });
        });
        guardarVentaEnElectron(nuevaVenta);
    });
}

// --- LÓGICA DE MODAL DE CONFIRMACIÓN (REEMPLAZO DE confirm()) ---

/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} message - El mensaje a mostrar al usuario.
 * @param {function} onConfirm - Función a ejecutar si el usuario presiona "Aceptar".
 */
function mostrarModalConfirmacion(message, onConfirm) {
    const modal = document.getElementById('custom-confirm-modal');
    const messageElement = document.getElementById('confirm-message');
    const btnOk = document.getElementById('confirm-ok');
    const btnCancel = document.getElementById('confirm-cancel');
    
    // Asigna el mensaje
    messageElement.textContent = message;

    // Limpia y asigna nuevos listeners
    btnOk.onclick = null;
    btnCancel.onclick = null;

    btnOk.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };

    btnCancel.onclick = () => {
        modal.style.display = 'none';
    };

    // Muestra el modal
    modal.style.display = 'block';
}


// --- LÓGICA DE AGREGAR ALUMNO (PERSISTENCIA) ---

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

    // 1. Agregar a la lista temporal de datos
    const nuevoAlumno = {
        nombre: nombre,
        vendidos_iniciales: 0
    };
    alumnosData.push(nuevoAlumno);
    alumnosData.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // 2. Guardar la lista completa de alumnos de forma persistente (IPC Call)
    const resultadoGuardado = await window.electronAPI.guardarAlumnos(alumnosData);
    
    if (!resultadoGuardado.success) {
        alert(`Error Crítico al guardar el nuevo alumno de forma permanente: ${resultadoGuardado.message}`);
        // Detener el proceso y eliminar el alumno de la lista temporal si falló
        alumnosData = alumnosData.filter(a => a.nombre !== nombre); 
        return;
    }
    
    // 3. Volver a poblar los <select> y seleccionar al nuevo alumno
    poblarAlumnos();
    cargarAlumnosBase();

    alumnoSelect.value = nombre;

    // 4. Limpiar y ocultar UI
    inputAlumno.value = '';
    controlDiv.style.display = 'none';
    alumnoSelect.style.display = 'block';
    toggleBtn.textContent = '➕ Registrar Nuevo Alumno';
    
    alumnoSelect.required = true;

    // 5. Actualizar el estado de la venta
    actualizarResumenYBoton();
    
    alert(`Alumno "${nombre}" agregado a la lista de forma permanente.`);
}


// --- LÓGICA DE ASIGNACIÓN BASE ---

function toggleAsignacionSection() {
    const mainSection = document.querySelector('main.container');
    const assignSection = document.getElementById('asignacion-base-section');
    
    if (assignSection.style.display === 'none' || !assignSection.style.display) {
        // Mostrar sección de asignación
        mainSection.style.display = 'none';
        assignSection.style.display = 'flex';
        // Asegura que se usen los asientos base
        limpiarSeleccionAsientos(); 
        actualizarBaseResumen();
        bloquearAsientosVendidos(); 
    } else {
        // Ocultar sección de asignación
        assignSection.style.display = 'none';
        mainSection.style.display = 'flex';
        // Asegura que se usen los asientos de venta
        limpiarSeleccionAsientosBase(); 
        // Recarga datos para actualizar el estado del mapa principal
        cargarDatosInicialesDesdeElectron(); 
    }
}

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
    
    // Filtra las ventas que tienen monto CERO (0) y son del alumno seleccionado.
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

function limpiarSeleccionAsientos() {
    boletosSeleccionados.clear();
    // Usa el selector del contenedor principal para evitar limpiar asientos base si el modo está activo
    document.querySelectorAll('#contenedor-mesas .asiento.seleccionado').forEach(a => a.classList.remove('seleccionado'));
}

function limpiarSeleccionAsientosBase() {
    boletosBaseSeleccionados.clear();
    // Usa el selector del contenedor base para limpiar solo esos asientos
    document.querySelectorAll('#contenedor-mesas-base .asiento.seleccionado').forEach(a => a.classList.remove('seleccionado'));
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
         mensaje = `¿Confirmas la asignación de ${boletosBaseSeleccionados.size} lugar(es) a ${nombreAlumno} para la función ${funcion}? Estos se registrarán como boletos base.`;
    }
    
    // Reemplaza confirm() con el modal personalizado
    mostrarModalConfirmacion(mensaje, () => {
        const asignaciones = [];
        boletosBaseSeleccionados.forEach(item => {
            asignaciones.push({
                alumno: nombreAlumno,
                mesa: item.mesa,
                asiento: item.asiento,
                fecha: funcion,
                monto: 0, // Monto 0 para marcar como "Asignación Base"
                pago: 'ASIGNACION BASE' // Etiqueta para diferenciar en el reporte
            });
        });
        guardarVentaEnElectron(asignaciones);
    });
}


// --- 6. Inicialización y Renderizado ---

function renderizarMesas() {
    const contenedor = document.getElementById('contenedor-mesas');
    const contenedorBase = document.getElementById('contenedor-mesas-base');
    
    contenedor.innerHTML = '';
    
    let mesasHTML = '';
    estructuraMesas.forEach(mesaData => {
        const mesaClass = mesaData.especial ? 'mesa ' + mesaData.especial : 'mesa';
        let iconoDiscapacidadHTML = mesaData.especial === 'accesible' ? '<div class="icono-discapacidad" title="Mesa accesible">♿</div>' : '';

        mesasHTML += `<div class="${mesaClass}" data-mesa="${mesaData.id}">
            <span class="etiqueta-mesa">Mesa ${mesaData.id}</span>
            <div class="asientos">`;

        for (let i = 1; i <= mesaData.asientos; i++) {
            const idAsiento = `M${mesaData.id}-A${i}`;
            mesasHTML += `<div class="asiento" data-asiento="${i}" data-id="${idAsiento}">${i}</div>`;
        }

        mesasHTML += '</div>' + iconoDiscapacidadHTML + '</div>';
    });
    
    contenedor.innerHTML = mesasHTML;
    if (contenedorBase) {
        contenedorBase.innerHTML = mesasHTML;
    }
}

function abrirReporte() {
    const rutaReporte = 'reporte.html';
    window.open(rutaReporte);
}

function iniciarApp() {
    renderizarMesas();

    // Re-asignar correctamente los listeners:
    document.getElementById('funcion').addEventListener('change', cargarDatosInicialesDesdeElectron); 
    document.getElementById('alumno-select').addEventListener('change', actualizarResumenYBoton);
    document.getElementById('formulario-venta').addEventListener('submit', manejarEnvioFormulario);
    
    // Botones de PRECIO 
    document.querySelectorAll('.btn-precio').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.id !== 'btn-toggle-otro-precio') {
                document.querySelectorAll('.btn-precio').forEach(b => b.classList.remove('seleccionado'));
                this.classList.add('seleccionado');
                document.getElementById('otro-precio-input').style.display = 'none';
                document.getElementById('otro-precio-input').value = ''; 
            }
            actualizarResumenYBoton();
        });
    });

    document.getElementById('otro-precio-input').addEventListener('input', function() {
        document.querySelectorAll('.btn-precio').forEach(b => b.classList.remove('seleccionado'));
        actualizarResumenYBoton();
    });
    
    // --- LÓGICA DE AGREGAR ALUMNO ---
    document.getElementById('btn-toggle-nuevo-alumno').addEventListener('click', function() {
        const alumnoSelect = document.getElementById('alumno-select');
        const controlDiv = document.getElementById('nuevo-alumno-control');
        
        const isControlVisible = controlDiv.style.display !== 'none';

        if (isControlVisible) {
            // Desactivar/Cancelar modo Nuevo Alumno
            controlDiv.style.display = 'none';
            alumnoSelect.style.display = 'block'; // Mostrar select
            alumnoSelect.required = true;
            document.getElementById('nuevo-alumno-input').value = '';
            this.textContent = '➕ Registrar Nuevo Alumno';
        } else {
            // Activar modo Nuevo Alumno
            controlDiv.style.display = 'flex'; // Usar flexbox para el nuevo control
            alumnoSelect.style.display = 'none'; // Ocultar select
            alumnoSelect.required = false;
            alumnoSelect.value = ''; 
            
            // Asegurar que el modo "Otro Precio" se desactive si estaba activo
            const inputOtroPrecio = document.getElementById('otro-precio-input');
            const btnTogglePrecio = document.getElementById('btn-toggle-otro-precio');
            if (inputOtroPrecio.style.display !== 'none') {
                inputOtroPrecio.style.display = 'none';
                btnTogglePrecio.textContent = '💰 Otro Precio';
                document.querySelector('.btn-precio[data-precio="450"]').classList.add('seleccionado');
            }

            this.textContent = '❌ Cancelar Registro Nuevo Alumno';
        }
        actualizarResumenYBoton(); 
    });
    
    // Botón para AGREGAR ALUMNO A LA LISTA
    document.getElementById('btn-agregar-alumno').addEventListener('click', agregarNuevoAlumno);


    // --- LÓGICA DE OTRO PRECIO (SEPARADO) ---
    document.getElementById('btn-toggle-otro-precio').addEventListener('click', function() {
        const alumnoSelect = document.getElementById('alumno-select');
        const controlDiv = document.getElementById('nuevo-alumno-control');
        const inputOtroPrecio = document.getElementById('otro-precio-input');
        const btn450 = document.querySelector('.btn-precio[data-precio="450"]');
        
        const isVisible = inputOtroPrecio.style.display !== 'none';

        if (isVisible) {
            // Desactivar/Cancelar modo Otro Precio
            inputOtroPrecio.style.display = 'none';
            inputOtroPrecio.value = '';
            btn450.classList.add('seleccionado'); // Regresa al precio por defecto (450)
            this.textContent = '💰 Otro Precio';
        } else {
            // Activar modo Otro Precio
            inputOtroPrecio.style.display = 'block';
            
            // Asegurar que el modo "Nuevo Alumno" se desactive si estaba activo
            if (controlDiv.style.display !== 'none') {
                controlDiv.style.display = 'none';
                alumnoSelect.style.display = 'block';
                document.getElementById('btn-toggle-nuevo-alumno').textContent = '➕ Registrar Nuevo Alumno';
            }
            
            document.querySelectorAll('.btn-precio').forEach(b => b.classList.remove('seleccionado'));
            this.textContent = '❌ Cancelar Otro Precio';
        }
        actualizarResumenYBoton();
    });

    // Botones de VENTA/ASIGNACION/REPORTE
    document.getElementById('btn-asignacion').addEventListener('click', toggleAsignacionSection);
    document.getElementById('btn-reporte').addEventListener('click', abrirReporte); 
    
    document.getElementById('btn-cancelar-asignacion').addEventListener('click', toggleAsignacionSection);
    document.getElementById('alumno-base-select').addEventListener('change', actualizarBaseResumen);
    document.getElementById('funcion-base-select').addEventListener('change', bloquearAsientosVendidos); 
    document.getElementById('formulario-asignacion').addEventListener('submit', manejarEnvioAsignacion);


    // CARGAR DATOS AL INICIAR
    cargarDatosInicialesDesdeElectron();
}

document.addEventListener('DOMContentLoaded', iniciarApp);