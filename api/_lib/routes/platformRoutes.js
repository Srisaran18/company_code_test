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
} = require("../controllers/platformController");

const router = express.Router();

router.use(verifyPlatformAdmin);
router.get("/companies", listCompanies);
router.post("/companies", createCompany);
router.get("/companies/:id", getCompany);
router.put("/companies/:id", updateCompany);
router.put("/companies/:id/features", setFeatures);
router.get("/features", listFeatures);
router.put("/features/:key", updateFeature);

module.exports = router;
