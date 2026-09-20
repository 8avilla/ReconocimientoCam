import mongoose from "mongoose";
import { z } from "zod";

// Validation messages are shown to end users, so use the Spanish locale.
z.config(z.locales.es());

export const objectIdSchema = z
  .string()
  .refine((value) => mongoose.isValidObjectId(value), { message: "Identificador inválido" });

export const requiredText = (max = 120) => z.string().trim().min(1, "Este campo es obligatorio").max(max);

export const optionalText = (max = 120) => z.string().trim().max(max);

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hexadecimal (#RRGGBB)");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const skipFor = ({ page, limit }: Pagination) => (page - 1) * limit;

/** Base64 data URL of a JPEG/PNG image, as sent by the browser camera capture. */
export const imageDataUrlSchema = z
  .string()
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, "La imagen debe estar en formato JPEG, PNG o WebP")
  .max(8_000_000, "La imagen es demasiado grande");
