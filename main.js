const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const JSON_ALUMNOS_FILENAME = 'alumnos.json';
const JSON_VENTAS_FILENAME = 'ventas_roa.json'; 

let mainWindow;

/**
 * 1. Crea la ventana principal (index.html).
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: "M&B Teatro - Venta de Boletos ROA",
    icon: path.join(__dirname, 'logo.png'), 
    autoHideMenuBar: true, // Oculta el menú estándar (Archivo, Editar, etc.)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), 
      contextIsolation: true,
      nodeIntegration: false 
    }
  });
  
  // MAXIMIZAR DESPUÉS DE LA CREACIÓN para que los controles de ventana sean visibles
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize(); 
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});


// --- LÓGICA DE MANEJO DE MÚLTIPLES VENTANAS (REPORTE) ---

app.on('web-contents-created', (e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://')) {
        const reportWindow = new BrowserWindow({
            width: 900,
            height: 600,
            minWidth: 800,
            minHeight: 500,
            title: "Reporte de Ventas",
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        });
        
        // MAXIMIZAR VENTANA DE REPORTE
        reportWindow.once('ready-to-show', () => {
            reportWindow.show();
            reportWindow.maximize(); 
        });
        
        // FIX: Se usa path.join para resolver la ruta absoluta de forma segura
        reportWindow.loadFile(path.join(__dirname, 'reporte.html')); 
        return { action: 'deny' }; 
    }
    return { action: 'deny' }; 
  });
});


// --- HANDLER para GUARDAR NUEVOS ALUMNOS (PERSISTENCIA) ---

ipcMain.handle('guardar-alumnos', async (event, alumnosList) => {
    const alumnosPath = path.join(__dirname, JSON_ALUMNOS_FILENAME);
    try {
        // Escribe la lista completa de alumnos de vuelta al archivo JSON
        fs.writeFileSync(alumnosPath, JSON.stringify(alumnosList, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error("Error al guardar la lista de alumnos en JSON:", error);
        return { success: false, message: `Fallo al guardar alumnos: ${error.message}` };
    }
});

// --- NUEVO HANDLER para REESCRIBIR TODAS LAS VENTAS (Usado para eliminar/transferir) ---
ipcMain.handle('reescribir-ventas', async (event, ventasList) => {
    const jsonPath = path.join(__dirname, JSON_VENTAS_FILENAME);
    
    try {
        // Crea el objeto JSON de ventas con la nueva lista filtrada
        const controlVentas = { ventas: ventasList };
        
        // Reescribe todo el archivo ventas_roa.json
        fs.writeFileSync(jsonPath, JSON.stringify(controlVentas, null, 2), 'utf8');
        return { success: true };

    } catch (error) {
        console.error("Error al reescribir las ventas en JSON:", error);
        return { success: false, message: `Fallo al reescribir ventas: ${error.message}` };
    }
});


// --- NUEVO HANDLER para GUARDAR ARCHIVO EXCEL (Descarga) ---
ipcMain.handle('guardar-archivo', async (event, data, filename) => {
    const downloadPath = app.getPath('downloads');
    const tempFilePath = path.join(downloadPath, filename); 
    
    try {
        fs.writeFileSync(tempFilePath, data, 'binary'); 
        
        return { success: true, path: tempFilePath };

    } catch (error) {
        console.error("Error al guardar archivo Excel:", error);
        return { success: false, message: `Fallo al guardar archivo: ${error.message}` };
    }
});


// --- LÓGICA DE COMUNICACIÓN IPC (LECTURA Y ESCRITURA JSON) ---

ipcMain.handle('guardar-venta', async (event, nuevaVenta) => {
    const jsonPath = path.join(__dirname, JSON_VENTAS_FILENAME);
    
    try {
        const data = fs.readFileSync(jsonPath, 'utf8');
        let controlVentas = JSON.parse(data);
        controlVentas.ventas = controlVentas.ventas.concat(nuevaVenta);
        fs.writeFileSync(jsonPath, JSON.stringify(controlVentas, null, 2), 'utf8');
        return { success: true };

    } catch (error) {
        console.error("Error al guardar la venta en JSON:", error);
        return { success: false, message: `Fallo al guardar ventas: ${error.message}` };
    }
});

ipcMain.handle('cargar-datos', async () => {
    const alumnosPath = path.join(__dirname, JSON_ALUMNOS_FILENAME);
    const jsonPath = path.join(__dirname, JSON_VENTAS_FILENAME);
    
    const resultado = { alumnos: [], ventas: [] };

    try {
        // --- A. Cargar Alumnos desde JSON (Manejo de Error de Sintaxis) ---
        if (fs.existsSync(alumnosPath)) {
            const data = fs.readFileSync(alumnosPath, 'utf8');
            try {
                resultado.alumnos = JSON.parse(data) || [];
            } catch (parseError) {
                console.error("ERROR CRÍTICO: Falló al parsear alumnos.json.", parseError.message);
                return { success: false, message: `ERROR: El archivo ${JSON_ALUMNOS_FILENAME} tiene sintaxis JSON inválida. Revísalo.` };
            }

        } else {
             return { success: false, message: `ERROR: No se encontró el archivo ${JSON_ALUMNOS_FILENAME}.` };
        }

        // --- B. Cargar Ventas desde JSON ---
        if (fs.existsSync(jsonPath)) {
            const data = fs.readFileSync(jsonPath, 'utf8');
            const controlVentas = JSON.parse(data);
            resultado.ventas = controlVentas.ventas || [];
        }

        return { success: true, data: resultado };

    } catch (error) {
        console.error("Error al cargar datos generales:", error);
        return { success: false, message: `Error general de carga: ${error.message}` };
    }
});