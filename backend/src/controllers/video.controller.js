import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponce } from "../utils/ApiResponce.js";
import { VIDEO_CLOUD_FOLDER_PATH, VIDEO_THUMPNAIL_CLOUD_FOLDER_PATH } from "../constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


export const uploadVideo = asyncHandler(async (req, res) => {

  const { title, description } = req.body;

  if (!title || !description) {
   throw new ApiError(400, "All fields are required") 
  };

  console.log("file:", req.files)

  const videoLocalPath = req.files?.videoFile[0]?.path;
  const thumpnailLocalPath = req.files?.thumpnail[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is missing");
  };

  if (!thumpnailLocalPath) {
    throw new ApiError(400, "thumpnail file is missing");
  };

  const cldVideo = await uploadOnCloudinary(videoLocalPath, VIDEO_CLOUD_FOLDER_PATH);

  const cldVideoThumpnail = await uploadOnCloudinary(thumpnailLocalPath, VIDEO_THUMPNAIL_CLOUD_FOLDER_PATH);

  if (!cldVideo) {
    throw new ApiError(400, "Video file is required");
  };
  console.log("cloud_video:", cldVideo);

  if (!cldVideoThumpnail) {
    throw new ApiError(400, "Video thumpnail file is required");
  };

  const createdVideo = await Video.create({
    videoFile: {
      url: cldVideo.url,
      public_id: cldVideo.public_id
    },
    thumpnail: {
      url: cldVideoThumpnail.url,
      public_id: cldVideoThumpnail.public_id
    },
    title,
    description,
    duration: cldVideo.duration,
    owner: req.user?._id
  });

  const video = await Video.findById(createdVideo._id);

  if (!video) {
    throw new ApiError(500, "Something went wromg while upload video");
  };

  return res
  .status(201)
  .json(
    new ApiResponce(201, video, "Video uploaded")
  );

});