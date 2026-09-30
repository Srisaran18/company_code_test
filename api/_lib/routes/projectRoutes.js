const express = require("express");
const { verifyToken, requirePrivilege } = require("../middlewares/authMiddleware");
const { listProjects, getProject, saveProject, deleteProject } = require("../controllers/projectController");

const router = express.Router();

router.use(verifyToken);
router.get("/", listProjects);
router.get("/:id", getProject);
router.post("/", requirePrivilege("projects", "create"), saveProject);
router.put("/:id", requirePrivilege("projects", "edit"), saveProject);
router.delete("/:id", requirePrivilege("projects", "delete"), deleteProject);

module.exports = router;
