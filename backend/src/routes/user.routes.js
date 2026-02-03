import { Router } from "express";
import { refreshAccessToken, updateAvatar, updateCoverImage, userLogin, userLogout, userRegister } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { veryfyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", 
  upload.fields([
    { name: "avatar", maxCount:1 }, 
    { name: "coverImage", maxCount: 1 }
  ]), 
  userRegister
);

router.post("/login", userLogin);

router.post("/logout", veryfyJWT, userLogout);

router.post("/refresh-token", refreshAccessToken);

router.patch("/update-avatar", upload.single("avatar"), veryfyJWT, updateAvatar);

router.patch("/update-cover-image", upload.single("coverImage"), veryfyJWT, updateCoverImage);


export default router;