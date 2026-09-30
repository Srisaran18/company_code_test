const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const {
  listMaterials,
  listDepartmentManagers,
  saveProjectManager,
  saveMaterial,
  deleteMaterial,
} = require("../controllers/materialController");

const router = express.Router();

router.use(verifyToken, requireFeature("material_requests"));
router.get("/managers", requirePrivilege("materials", "view"), listDepartmentManagers);
router.put("/manager", requirePrivilege("materials", "edit"), saveProjectManager);
// Readable by anyone who can raise or process MRs (catalogue dropdowns), scoped by project/department.
router.get("/", listMaterials);
router.post("/", requirePrivilege("materials", "create"), saveMaterial);
router.put("/:id", requirePrivilege("materials", "edit"), saveMaterial);
router.delete("/:id", requirePrivilege("materials", "delete"), deleteMaterial);

module.exports = router;
