// preload.js - API actualizada para JSON

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Función para guardar (escribe en JSON)
  guardarVenta: (ventaData) => ipcRenderer.invoke('guardar-venta', ventaData),
  
  // Nueva función para guardar la lista completa de alumnos (Persistencia)
  guardarAlumnos: (alumnosList) => ipcRenderer.invoke('guardar-alumnos', alumnosList),
  
  // Nueva función para cargar todos los datos (Alumnos del Excel, Ventas del JSON)
  cargarDatos: () => ipcRenderer.invoke('cargar-datos')
});