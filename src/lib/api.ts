import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";

/** Error carrying an HTTP status and a user-facing (Spanish) message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "error",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, "bad_request", details);
export const notFound = (message: string) => new ApiError(404, message, "not_found");
export const unprocessable = (message: string, code: string, details?: unknown) =>
  new ApiError(422, message, code, details);
export const conflict = (message: string, code = "conflict") => new ApiError(409, message, code);

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

type RouteHandler<P> = (request: NextRequest, params: P) => Promise<Response>;

/**
 * Wraps a route handler: connects to the database, resolves the async route params and
 * maps known failures (validation, casting, duplicate keys, ApiError) to HTTP responses.
 */
export function route<P = Record<string, never>>(handler: RouteHandler<P>) {
  return async (request: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      await connectToDatabase();
      const params = await context.params;
      return await handler(request, params);
    } catch (error) {
      return toErrorResponse(error, request);
    }
  };
}

function toErrorResponse(error: unknown, request: NextRequest): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Los datos enviados no son válidos",
        code: "validation_error",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return NextResponse.json(
      { error: "Los datos enviados no son válidos", code: "validation_error", details: error.message },
      { status: 400 }
    );
  }
  if (error instanceof mongoose.Error.CastError) {
    return NextResponse.json({ error: "Identificador inválido", code: "bad_request" }, { status: 400 });
  }
  if (isDuplicateKeyError(error)) {
    const fields = Object.keys(error.keyPattern ?? {});
    return NextResponse.json(
      { error: "Ya existe un registro con esos datos", code: "duplicate", details: { fields } },
      { status: 409 }
    );
  }
  console.error(`Unhandled error in ${request.method} ${request.nextUrl.pathname}:`, error);
  return NextResponse.json(
    { error: "Error interno del servidor", code: "internal_error" },
    { status: 500 }
  );
}

interface DuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is DuplicateKeyError {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/** Parses and validates a JSON body; throws a 400 when it is malformed. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("El cuerpo de la petición no es un JSON válido");
  }
  return schema.parse(raw);
}

/** Parses the URL query string with a Zod schema. */
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams));
}

export function toObjectId(value: string, label = "identificador"): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(value)) {
    throw badRequest(`El ${label} no es válido`);
  }
  return new mongoose.Types.ObjectId(value);
}

/** Escapes user input so it can be embedded in a RegExp safely. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
