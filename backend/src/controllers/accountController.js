const accountService = require("../services/accountService");
const requestEmployee = require("../utils/requestEmployee");

// HR: an employee's login. The temporary passwords below are shown once, in the answer, and never
// stored (only their hash is).

const getAccount = async (req, res) => {
  const employee = await requestEmployee(req);
  const account = accountService.toAccountDto(await accountService.findAccount(employee.id));

  res.status(200).json({ message: "Login retrieved successfully", account });
};

const createAccount = async (req, res) => {
  const employee = await requestEmployee(req);
  const { account, temporaryPassword } = await accountService.createAccount(employee, req.body);

  res.status(201).json({
    message: "Login created. Give the person the temporary password: they choose their own when they sign in.",
    account,
    temporaryPassword,
  });
};

const resetPassword = async (req, res) => {
  const employee = await requestEmployee(req);
  const { account, temporaryPassword } = await accountService.resetPassword(employee.id);

  res.status(200).json({
    message: "Password reset. Give the person the temporary password: they choose their own when they sign in.",
    account,
    temporaryPassword,
  });
};

const updateAccount = async (req, res) => {
  const employee = await requestEmployee(req);
  const account = await accountService.updateAccount(employee.id, req.body);

  res.status(200).json({ message: "Login updated", account });
};

module.exports = { getAccount, createAccount, resetPassword, updateAccount };
