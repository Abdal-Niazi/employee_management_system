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

  // Prisma unique constraint violation (duplicate employeeId or email)
  if (err.code === "P2002") {
    return res.status(409).json({
      message: "A record with this value already exists",
    });
  }

  // Prisma "record not found" on update or delete
  if (err.code === "P2025") {
    return res.status(404).json({ message: "Employee not found" });
  }

  // Everything else: log it here, send nothing internal to the client
  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal server error" });
};

module.exports = { notFound, errorHandler };
