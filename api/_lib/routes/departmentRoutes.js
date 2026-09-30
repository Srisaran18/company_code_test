const express = require("express");
const { verifyToken, requirePrivilege } = require("../middlewares/authMiddleware");
const { listDepartments, saveDepartment, deleteDepartment } = require("../controllers/departmentController");

const router = express.Router();

router.use(verifyToken);
router.get("/", listDepartments);
router.post("/", requirePrivilege("departments", "create"), saveDepartment);
router.put("/:id", requirePrivilege("departments", "edit"), saveDepartment);
router.delete("/:id", requirePrivilege("departments", "delete"), deleteDepartment);

module.exports = router;
