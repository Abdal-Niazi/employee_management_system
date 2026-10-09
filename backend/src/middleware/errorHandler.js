const { ZodError } = require("zod");
const AppError = require("../utils/AppError");

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  // Our own errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(422).json({
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Malformed JSON in the request body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }

  // Request body over the 100 kB limit
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }

  // Other client errors from the body parser (bad encoding, unsupported charset, ...)
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }

  // Prisma unique constraint violation (duplicate employeeId or email)
  if (err.code === "P2002") {
    return res.status(409).json({
      message: "A record with this value already exists",
    });
  }

  // Prisma foreign key violation (e.g. a managerId that matches no employee)
  if (err.code === "P2003") {
    return res.status(400).json({ message: "A linked record does not exist" });
  }

  // Prisma "record not found" on update or delete
  if (err.code === "P2025") {
    return res.status(404).json({ message: `${err.meta?.modelName ?? "Record"} not found` });
  }

  // Everything else: log it here, send nothing internal to the client
  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal server error" });
};

module.exports = { notFound, errorHandler };
