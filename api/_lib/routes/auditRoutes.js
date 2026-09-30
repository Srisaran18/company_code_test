const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const { listAudits } = require("../controllers/auditController");

const router = express.Router();

router.use(verifyToken);
router.use((req, res, next) => {
  if (req.user.role === "super_admin") return next();
  return requireFeature("audits")(req, res, next);
});
router.get("/", requirePrivilege("audits", "view"), listAudits);

module.exports = router;
