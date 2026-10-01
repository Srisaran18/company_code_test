const express = require("express");
const { verifyToken, requirePrivilege, requireFeature } = require("../middlewares/authMiddleware");
const { getCompany, updateCompany } = require("../controllers/companyController");

const router = express.Router();

router.use(verifyToken);
router.get("/", requireFeature("company_settings"), getCompany);
router.put("/", requireFeature("company_settings"), requirePrivilege("company_settings", "edit"), updateCompany);

module.exports = router;
