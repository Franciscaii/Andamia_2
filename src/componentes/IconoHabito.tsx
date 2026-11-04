import { Apple, Bed, Bike, BookOpen, Brain, Droplet, Dumbbell, Footprints, Heart, Leaf, Music, PenLine, Pill, Salad, Star, Sun, type LucideIcon } from "lucide-react";

export const ICONOS_HABITO: Record<string, LucideIcon> = {
  estrella: Star,
  agua: Droplet,
  libro: BookOpen,
  pesas: Dumbbell,
  pasos: Footprints,
  bici: Bike,
  sueno: Bed,
  fruta: Apple,
  ensalada: Salad,
  mente: Brain,
  pastilla: Pill,
  musica: Music,
  escritura: PenLine,
  hoja: Leaf,
  sol: Sun,
  corazon: Heart,
};

export function IconoHabito({ nombre, color, tamano = 18 }: { nombre: string; color: string; tamano?: number }) {
  const Icono = ICONOS_HABITO[nombre] ?? Star;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, width: tamano + 14, height: tamano + 14 }}>
      <Icono size={tamano} style={{ color }} />
    </span>
  );
}
