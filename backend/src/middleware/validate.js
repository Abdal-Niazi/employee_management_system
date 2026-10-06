// Replaces req.body with the parsed result, so unknown fields are stripped
// and values like hireDate arrive already converted.
const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};

module.exports = validate;
