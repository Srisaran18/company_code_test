function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function sendError(res, error) {
  const status = Number(error.statusCode || error.status) || 500;
  const body = { message: error.message || "Server error" };
  if (typeof error.code === "string") body.code = error.code;
  if (status >= 400 && status < 500 && body.code) body.success = false;
  return res.status(status).json(body);
}

module.exports = { httpError, sendError };
