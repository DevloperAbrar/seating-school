const ApiError = require("../utils/ApiError");

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || [];

  // ✅ Prisma unique constraint violation
  if (err.code === "P2002") {
    statusCode = 409;
    const field = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : err.meta?.target;
    message = `${field ? field + " " : ""}already exists`;
    errors = [{ field, message: "This value conflicts with an existing record" }];
  }

  // ✅ Prisma record not found (e.g. update/delete on missing row)
  if (err.code === "P2025") {
    statusCode = 404;
    message = err.meta?.cause || "Record not found";
  }

  // ✅ Prisma foreign key constraint failed
  if (err.code === "P2003") {
    statusCode = 400;
    message = "Related record does not exist";
  }

  // Mongoose duplicate key (kept in case any legacy code path still uses it)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    statusCode = 409;
    message = `${field} already exists`;
    errors = [{ field, message: `${err.keyValue[field]} is already taken` }];
  }

  // Mongoose validation
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // JWT error
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("❌ Error:", err);
  }

  res.status(statusCode).json({ success: false, statusCode, message, errors });
};

module.exports = { notFound, errorHandler };