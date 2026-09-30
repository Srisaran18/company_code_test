const express = require("express");
const { verifyToken, requirePrivilege } = require("../middlewares/authMiddleware");
const { listRoles, saveRole, deleteRole } = require("../controllers/roleController");

const router = express.Router();

router.use(verifyToken);
router.get("/", requirePrivilege("roles", "view"), listRoles);
// Create/update/delete privileges (roles.* or privileges.edit) are checked in the controller.
router.post("/", saveRole);
router.put("/:id", saveRole);
router.delete("/:id", deleteRole);

module.exports = router;
