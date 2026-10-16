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

// The signed-in account's own password. Answers with a new token for this login: all the
// account's other logins (other phones, browsers) are signed out.
const changePassword = async (req, res) => {
  const { token, admin } = await authService.changePassword(req.admin.id, req.body);

  res.status(200).json({
    message: "Password changed. You were signed out on other phones and browsers.",
    token,
    admin,
  });
};

module.exports = {
  login,
  me,
  changePassword,
};
