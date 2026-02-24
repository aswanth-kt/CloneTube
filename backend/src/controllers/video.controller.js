import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponce } from "../utils/ApiResponce.js";
import { VIDEO_CLOUD_FOLDER_PATH, VIDEO_THUMPNAIL_CLOUD_FOLDER_PATH } from "../constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";


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

  let cldVideoThumpnail = null;
  if (thumpnailLocalPath) {
    cldVideoThumpnail = await uploadOnCloudinary(thumpnailLocalPath, VIDEO_THUMPNAIL_CLOUD_FOLDER_PATH);
  }

  if (!cldVideo) {
    throw new ApiError(400, "Video file is required");
  };
  console.log("cloud_video:", cldVideo);

  const createdVideo = await Video.create({
    videoFile: {
      url: cldVideo.url,
      public_id: cldVideo.public_id
    },
    thumpnail: cldVideoThumpnail
    ? {
      url: cldVideoThumpnail.url,
      public_id: cldVideoThumpnail.public_id
    }
    : undefined,
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


export const getAllVideos = asyncHandler(async (req, res) => {
  const { query, sortBy, sortType, userId } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  const match = {};
  if(query) {
    match.title = { $regex: query, $options: "i" };
  };

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    match.owner = new mongoose.Types.ObjectId(userId);
  };
  console.log("match: ", match)

  const sort = {};
  if (sortBy) {
    sort[sortBy] = sortType === "asc" ? 1 : -1;
  } else {
    sort.createdAt = -1;  // default sort
  };
  console.log("sort: ", sort)

  const aggregate = Video.aggregate([
    { $match: match },
    { $sort: sort },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "owner"
      }
    },
    { $unwind: { 
        path: "$owner", 
        preserveNullAndEmptyArrays: true 
      } 
    }
  ]);

  const videos = await Video.aggregatePaginate(aggregate, { page, limit });

  console.log("All videos: ", videos);

  if (!videos.docs.length) {
    throw new ApiError(404, "Videos not found");
  };

  return res
  .status(200)
  .json(new ApiResponce(
    200,
    videos,
    "Fetch all videos"
  ))

});


export const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId && !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video Id");
  };

  // const video = await Video.findById(videoId)
  // .populate("owner", "username avatar fullName")
  // .lean();

  const video = await Video.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId) }
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1
            }
          }
        ]
      }
    },
    { $unwind: "$owner" },
  ])

  if(!video) {
    throw new ApiError(404, "Video not found");
  };

  return res.status(200)
  .json(new ApiResponce(200, video[0], "Video fetched"))
});


export const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Invalid video Id");
  };

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  };

  const { title, description } = req.body;

  const videoLocalPath = req.files?.videoFile?.[0]?.path || null;
  const thumpnailLocalPath = req.files?.thumpnail?.[0]?.path || null;

  let cld_video = null;
  let cld_thumpnail = null;

  try {
    if (videoLocalPath) {
      cld_video = await uploadOnCloudinary(videoLocalPath, VIDEO_CLOUD_FOLDER_PATH);
      if (!cld_video) {
        throw new ApiError(500, "Video upload failed");
      };
    }
  
    if (thumpnailLocalPath) {
      cld_thumpnail = await uploadOnCloudinary(thumpnailLocalPath, VIDEO_THUMPNAIL_CLOUD_FOLDER_PATH);
      if (!cld_thumpnail) {
        throw new ApiError(500, "Thumpnail upload failed");
      };
    }
  
    const old_cld_video_publicId = video?.videoFile?.public_id;
    const old_cld_thumpnail_publicId = video?.thumpnail?.public_id;
  
    // Update provided fields
    if (title) video.title = title;
    if (description) video.description = description;
    if (cld_video) {
      video.duration = cld_video.duration;
      video.videoFile.url = cld_video?.url;
      video.videoFile.public_id = cld_video?.public_id;
    }
    if (cld_thumpnail) {
      video.thumpnail = {
        url: cld_thumpnail.url,
        public_id: cld_thumpnail.public_id
      }
    }
    await video.save();
  
    // delete old files from cloudinary
    if (cld_video && old_cld_video_publicId) {
      const cloudinaryVideoDeleteRes = await deleteFromCloudinary(old_cld_video_publicId, "video");
  
      if (cloudinaryVideoDeleteRes.result !== "ok") {
        console.warn("Cloudinary video file delete warning:", cloudinaryVideoDeleteRes)
      };
    };
  
    if (thumpnailLocalPath) {
      const cloudinaryThumpnailDeleteRes = await deleteFromCloudinary(old_cld_thumpnail_publicId);
  
      if (cloudinaryThumpnailDeleteRes.result !== "ok") {
        console.warn("Cloudinary thumpnail file delete warning:", cloudinaryThumpnailDeleteRes)
      }
    };
  
    return res.status(200)
    .json(
      new ApiResponce(200, video, "Video updated")
    );

  } catch (error) {
    
    // rollback uploaded file if DB is failed
    if (cld_video?.public_id) {
      await deleteFromCloudinary(cld_video.public_id, "video")
    }

    if(cld_thumpnail?.public_id) {
      await deleteFromCloudinary(cld_thumpnail.public_id);
    };

    throw new ApiError(500, error?.message);
  };

});