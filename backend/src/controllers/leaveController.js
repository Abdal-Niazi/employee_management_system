const leaveService = require("../services/leaveService");
const AppError = require("../utils/AppError");
const parseId = require("../utils/parseId");
const { LEAVE_STATUSES } = require("../validators/managerSchema");

const getLeaveRequests = async (req, res) => {
  const { status } = req.query;

  if (status !== undefined && !LEAVE_STATUSES.includes(status)) {
    throw new AppError(`status must be one of: ${LEAVE_STATUSES.join(", ")}`, 400);
  }

  const leaveRequests = await leaveService.listAll(status);

  res.status(200).json({
    message: "Leave requests retrieved successfully",
    leaveRequests,
  });
};

const decideLeave = async (req, res) => {
  const leaveRequest = await leaveService.decide(req.admin.id, parseId(req.params.id, "Leave request id"), req.body);

  res.status(200).json({
    message: `Leave request ${leaveRequest.status.toLowerCase()}`,
    leaveRequest,
  });
};

module.exports = { getLeaveRequests, decideLeave };
