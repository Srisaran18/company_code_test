const express = require("express");
const { verifyToken, requireFeature } = require("../middlewares/authMiddleware");
const { listRequests, reviewRequest } = require("../controllers/deleteRequestController");

const router = express.Router();

router.use(verifyToken, requireFeature("delete_requests"));
router.get("/", listRequests);
router.post("/:id/review", reviewRequest);

module.exports = router;
