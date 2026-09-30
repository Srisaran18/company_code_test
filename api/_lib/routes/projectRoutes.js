const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const { listProjects, getProject, saveProject, deleteProject } = require("../controllers/projectController");

const router = express.Router();
const projectsEnabled = requireFeature("projects");

router.use(verifyToken);
// Listing stays open: material requests and user forms pick projects even when the Projects screen is off.
router.get("/", listProjects);
router.get("/:id", getProject);
router.post("/", projectsEnabled, requirePrivilege("projects", "create"), saveProject);
router.put("/:id", projectsEnabled, requirePrivilege("projects", "edit"), saveProject);
router.delete("/:id", projectsEnabled, requirePrivilege("projects", "delete"), deleteProject);

module.exports = router;
