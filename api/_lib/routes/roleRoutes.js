const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const { listRoles, saveRole, deleteRole } = require("../controllers/roleController");

const router = express.Router();
const rolesEnabled = requireFeature("roles", "privileges");

router.use(verifyToken);
router.get("/", requirePrivilege("roles", "view"), listRoles);
// Create/update/delete privileges (roles.* or privileges.edit) are checked in the controller.
router.post("/", rolesEnabled, saveRole);
router.put("/:id", rolesEnabled, saveRole);
router.delete("/:id", rolesEnabled, deleteRole);

module.exports = router;
