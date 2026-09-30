const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const { listDepartments, saveDepartment, deleteDepartment } = require("../controllers/departmentController");

const router = express.Router();

router.use(verifyToken);
// Listing stays open: material requests and user forms pick departments even when the Departments screen is off.
router.get("/", listDepartments);
router.post("/", requireFeature("departments"), requirePrivilege("departments", "create"), saveDepartment);
router.put("/:id", requireFeature("departments", "privileges"), requirePrivilege("departments", "edit"), saveDepartment);
router.delete("/:id", requireFeature("departments"), requirePrivilege("departments", "delete"), deleteDepartment);

module.exports = router;
