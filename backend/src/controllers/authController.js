const authService = require("../services/authService");

const login = async (req, res) => {
  const { token, admin } = await authService.login(req.body.email, req.body.password);

  res.status(200).json({
    message: "Login successful",
    token,
    admin,
  });
};

const me = async (req, res) => {
  res.status(200).json({
    message: "Admin retrieved successfully",
    admin: req.admin,
  });
};

module.exports = {
  login,
  me,
};
