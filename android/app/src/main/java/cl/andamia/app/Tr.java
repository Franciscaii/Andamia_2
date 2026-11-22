package cl.andamia.app;

import android.content.Context;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Textos fijos de los widgets nativos en inglés. La app (JavaScript) guarda el idioma elegido junto
 * con los datos de los widgets; sin idioma guardado, todo sigue en español.
 */
final class Tr {
    private Tr() {}

    private static volatile Boolean ingles = null;
    private static final Map<String, String> EN = new HashMap<>();

    static {
        String[][] p = {
            { "Abre Andamia para ver tu mes", "Open Andamia to see your month" },
            { "Abre Andamia para ver tus estadísticas", "Open Andamia to see your statistics" },
            { "Sin hábitos cumplidos en este período.", "No completed habits in this period." },
            { "Sin tareas completadas en este período.", "No completed tasks in this period." },
            { "Mis hábitos cumplidos", "My completed habits" },
            { "Mis tareas completadas", "My completed tasks" },
            { "Hábitos", "Habits" },
            { "Alta", "High" },
            { "Media", "Medium" },
            { "Baja", "Low" },
            { "Ninguna", "None" },
            { "Tareas hoy", "Today's tasks" },
            { "Tareas del día", "Tasks of the day" },
            { "Atrasada", "Overdue" },
            { "Hoy", "Today" },
            { "Mañana", "Tomorrow" },
            { "Hoy · abre Andamia", "Today · open Andamia" },
            { "Abre Andamia", "Open Andamia" },
            { "Matriz", "Matrix" },
            { "Sin tareas pendientes.\nToca aquí para abrir Andamia.", "No pending tasks.\nTap here to open Andamia." },
            { "Confeti al completarlo", "Confetti when completed" },
            { "Abre Andamia una vez para poder editar esto desde el widget", "Open Andamia once to be able to edit this from the widget" },
            { "¿Qué quieres añadir?", "What do you want to add?" },
            { "Tarea", "Task" },
            { "Evento", "Event" },
            { "Hábito", "Habit" },
            { "Editar tarea", "Edit task" },
            { "Editar evento", "Edit event" },
            { "Editar hábito", "Edit habit" },
            { "Nueva tarea", "New task" },
            { "Nuevo evento", "New event" },
            { "Nuevo hábito", "New habit" },
            { "Leer paper", "Read paper" },
            { "Entrevista de trabajo", "Job interview" },
            { "Tomar agua", "Drink water" },
            { "Nombre", "Name" },
            { "Fecha", "Date" },
            { "Importancia · urgencia y valor", "Importance · urgency and value" },
            { "Dificultad · tiempo y esfuerzo", "Difficulty · time and effort" },
            { "Color", "Color" },
            { "Índole", "Kind" },
            { "Fecha de inicio · Fecha de fin (opcional)", "Start date · End date (optional)" },
            { "Ícono", "Icon" },
            { "Frecuencia", "Frequency" },
            { "Objetivo por día", "Goal per day" },
            { "Eliminar", "Delete" },
            { "Cancelar", "Cancel" },
            { "Guardar", "Save" },
            { "Crear tarea", "Create task" },
            { "Crear evento", "Create event" },
            { "Crear hábito", "Create habit" },
            { "Quitar la fecha de fin", "Remove the end date" },
            { "Abre Andamia una vez para ver tus etiquetas.", "Open Andamia once to see your tags." },
            { "Diaria", "Daily" },
            { "Algunos días", "Some days" },
            { "Veces por semana", "Times per week" },
            { "Cambios guardados", "Changes saved" },
            { "Tarea añadida a Andamia", "Task added to Andamia" },
            { "Evento añadido a Andamia", "Event added to Andamia" },
            { "Hábito añadido a Andamia", "Habit added to Andamia" },
            { "¿Seguro?", "Sure?" },
            { "Se borra también su historial. Toca Eliminar otra vez para confirmar.", "Its history is deleted too. Tap Delete again to confirm." },
            { "Hábito eliminado", "Habit deleted" },
            { "Enviado a la papelera de Andamia", "Sent to Andamia's trash" },
            { "Tareas", "Tasks" },
            { "Eventos", "Events" },
            { "Todos", "All" },
            { "Nada para hoy.\nToca aquí para abrir Andamia.", "Nothing for today.\nTap here to open Andamia." },
            { "Nada este día.\nToca aquí para abrir Andamia.", "Nothing this day.\nTap here to open Andamia." },
            { "Toca aquí para abrir Andamia.", "Tap here to open Andamia." },
            { "Completadas", "Completed" },
            { "Día", "Day" },
            { "Semana", "Week" },
            { "Mes", "Month" },
            { "Año", "Year" },
            { "Semana anterior", "Previous week" },
            { "Semana siguiente", "Next week" },
        };
        for (String[] par : p) EN.put(par[0], par[1]);
    }

    /** Lee el idioma guardado la primera vez (o tras olvidar()). */
    static void iniciar(Context c) {
        if (ingles == null) ingles = "en".equals(DatosWidget.leerIdioma(c));
    }

    static void olvidar() {
        ingles = null;
    }

    static boolean en() {
        return Boolean.TRUE.equals(ingles);
    }

    static String t(Context c, String es) {
        iniciar(c);
        return t(es);
    }

    static String t(String es) {
        if (!en()) return es;
        String r = EN.get(es);
        return r == null ? es : r;
    }

    /** En inglés, cambia el texto fijo (del diseño XML) de un widget. */
    static void texto(android.widget.RemoteViews vista, int id, String es) {
        if (en()) vista.setTextViewText(id, t(es));
    }

    static Locale locale() {
        return en() ? Locale.US : new Locale("es", "CL");
    }

    static final String[] DIAS_ES = { "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom" };
    static final String[] DIAS_EN = { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };
    static final String[] MESES_ES = { "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic" };
    static final String[] MESES_EN = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };

    static String[] dias() {
        return en() ? DIAS_EN : DIAS_ES;
    }

    static String[] meses() {
        return en() ? MESES_EN : MESES_ES;
    }
}
