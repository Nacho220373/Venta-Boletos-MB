// preload.js - API actualizada para JSON

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Función para guardar (escribe en JSON)
  guardarVenta: (ventaData) => ipcRenderer.invoke('guardar-venta', ventaData),
  
  // Función para guardar la lista completa de alumnos (Persistencia)
  guardarAlumnos: (alumnosList) => ipcRenderer.invoke('guardar-alumnos', alumnosList),
  
  // NUEVA FUNCIÓN: Reescribe la lista de ventas completa (usado para eliminar/transferir)
  reescribirVentas: (ventasList) => ipcRenderer.invoke('reescribir-ventas', ventasList),
  
  // Nueva función para cargar todos los datos (Alumnos del Excel, Ventas del JSON)
  cargarDatos: () => ipcRenderer.invoke('cargar-datos'),
  
  // NUEVA FUNCIÓN: Para guardar el archivo Excel (Descarga)
  guardarArchivo: (data, filename) => ipcRenderer.invoke('guardar-archivo', data, filename)
});