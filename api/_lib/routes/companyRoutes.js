const express = require("express");
const { verifyToken, requirePrivilege } = require("../middlewares/authMiddleware");
const { getCompany, updateCompany } = require("../controllers/companyController");

const router = express.Router();

router.use(verifyToken);
router.get("/", getCompany);
router.put("/", requirePrivilege("company_settings", "edit"), updateCompany);

module.exports = router;
