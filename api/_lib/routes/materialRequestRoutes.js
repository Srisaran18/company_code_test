const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const {
  listAssignees,
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  deleteRequest,
  issueStock,
  sendPendingToPurchase,
} = require("../controllers/materialRequestController");

const router = express.Router();

router.use(verifyToken, requireFeature("material_requests"));
router.get("/", requirePrivilege("material_requests", "view"), listRequests);
router.get("/assignees", listAssignees);
router.get("/:id", requirePrivilege("material_requests", "view"), getRequest);
router.post("/", requirePrivilege("material_requests", "create"), createRequest);
router.post("/:id/issue", requirePrivilege("material_requests", "edit"), issueStock);
router.post("/:id/send-to-purchase", requirePrivilege("material_requests", "edit"), sendPendingToPurchase);
router.put("/:id", requirePrivilege("material_requests", "edit"), updateRequest);
router.delete("/:id", deleteRequest);

module.exports = router;
