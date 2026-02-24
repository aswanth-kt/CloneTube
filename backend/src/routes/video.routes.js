import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { 
  getAllVideos, 
  getVideoById, 
  updateVideo, 
  uploadVideo 
} from "../controllers/video.controller.js";
import { veryfyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/publish-video", 
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumpnail", maxCount: 1 }
  ]), 
  veryfyJWT,
  uploadVideo
);

router.get("/get-videos", getAllVideos);

router.get("/get-video/:videoId", getVideoById);

router.post("/update-video/:videoId", upload.single("videoFile"), updateVideo);


export default router;