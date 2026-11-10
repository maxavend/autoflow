import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utilidad de FigUI (https://figui.dev): une clases de Tailwind sin conflictos.
export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}
