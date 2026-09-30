const express = require("express");
const { verifyPlatformAdmin } = require("../middlewares/authMiddleware");
const {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  setFeatures,
  listFeatures,
  updateFeature,
  listCompanyAudits,
  listAllAudits,
  getDashboard,
} = require("../controllers/platformController");

const router = express.Router();

router.use(verifyPlatformAdmin);
router.get("/companies", listCompanies);
router.post("/companies", createCompany);
router.get("/dashboard", getDashboard);
router.get("/audits", listAllAudits);
router.get("/companies/:id", getCompany);
router.put("/companies/:id", updateCompany);
router.put("/companies/:id/features", setFeatures);
router.get("/companies/:id/audits", listCompanyAudits);
router.get("/features", listFeatures);
router.put("/features/:key", updateFeature);

module.exports = router;
