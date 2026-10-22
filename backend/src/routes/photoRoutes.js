const express = require("express");
const { z } = require("zod");
const photoController = require("../controllers/photoController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const validate = require("../middleware/validate");

// Body of PUT /api/photos/:employeeId: the JPEG as base64 text (about 40 to 80 KB once shrunk by the app)
const putPhotoSchema = z.object({
  image: z.string({ error: "image is required" }).min(1, "image is required").max(300_000, "image is too big"),
});

const router = express.Router();

// Any signed-in account may ask; who may see which photo is decided in the controller.
router.use(requireAuth);

router.get("/:employeeId", photoController.getPhoto);

// Only HR puts a photo on a person or takes it off.
router.put("/:employeeId", requireRole("HR_ADMIN"), validate(putPhotoSchema), photoController.putPhoto);

router.delete("/:employeeId", requireRole("HR_ADMIN"), photoController.deletePhoto);

module.exports = router;
