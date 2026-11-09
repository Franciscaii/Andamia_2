/**
 * Recordatorios de tareas y hábitos. Apagados por decisión de Francisca: el código
 * sigue aquí y se vuelven a mostrar con VITE_RECORDATORIOS=si en .env.local.
 */
export const recordatoriosActivos = import.meta.env.VITE_RECORDATORIOS === "si";

/**
 * Crear listas y carpetas. Apagado por decisión de Francisca: no quiere crear listas.
 * Si ya existe alguna, se sigue viendo para no esconder tareas. Se vuelve a encender
 * con VITE_LISTAS=si en .env.local.
 */
export const listasActivas = import.meta.env.VITE_LISTAS === "si";

/**
 * Hora, repetir, tipo (tarea/evento) y enfocar en el detalle. Ocultos por decisión de
 * Francisca: el detalle muestra solo título, fecha, importancia y dificultad, índole,
 * notas y subtareas. Se vuelven a mostrar con VITE_OPCIONES_AVANZADAS=si en .env.local.
 */
export const opcionesAvanzadas = import.meta.env.VITE_OPCIONES_AVANZADAS === "si";
