const express = require("express");
const { login, logout, me, directory } = require("../controllers/authController");
const { authenticate, verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/login", login);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);
router.get("/directory", verifyToken, directory);

module.exports = router;
