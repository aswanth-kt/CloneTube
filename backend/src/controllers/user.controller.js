import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponce } from "../utils/ApiResponce.js";
import { 
  AVATAR_CLOUD_FOLDER_PATH, 
  COVER_IMAGE_CLOUD_FOLDER_PATH, 
  VIDEO_CLOUD_FOLDER_PATH 
} from "../constants.js";
import mongoose from "mongoose";


const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshtoken = await user.generateRefreshToken();

    user.refreshToken = refreshtoken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshtoken }
    
  } catch (error) {
    throw new ApiError(500, "Error while generate access and refresh token");
  }
};


export const userRegister = asyncHandler(async (req, res) => {
  // get user details from frontend
  const { fullName, email, username, password} = req.body;
  // console.log("req.body:", req.body)

  // validation - not empty
  if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are require")
  };

  // check if user already exists: username, email
  const existedUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existedUser) {
    // if user exists delete img from disk.
    // if (req.files) {
    //   fs.unlinkSync(req.files?.avatar[0]?.path);
    //   fs.unlinkSync(req.files?.coverImage?.[0]?.path);
    // }
    throw new ApiError(409, "You have already an account in this username or email");
  };

  // check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPth = req.files?.coverImage[0]?.path;

  let coverImageLocalPth = null;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPth = req.files.coverImage[0].path;
  };

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload them to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath, AVATAR_CLOUD_FOLDER_PATH);
  
  let coverImage = null;
  if (coverImageLocalPth) {
    coverImage = await uploadOnCloudinary(coverImageLocalPth, COVER_IMAGE_CLOUD_FOLDER_PATH);
  }
  // console.log("Cloudinary res:", avatar, coverImage)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  };

  // create user object - create entry in db
  const createdUser = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: { 
      url: avatar.url, 
      public_id: avatar.public_id 
    },
    coverImage: coverImage 
    ? {
      url: coverImage?.url,
      public_id: coverImage?.public_id
    } 
    : undefined
  });

  // Check user is created or not, if user create successfully remove password and refresh token field from response
  const user = await User.findById(createdUser._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw ApiError(500, "Something went wrong while registering the user!");
  };

  // return res
  return res.status(201).json(
    new ApiResponce(201, user, "User register successfully")
  );

});


export const userLogin = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  };

  const user = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  };

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  };

  const { accessToken, refreshtoken } = await generateAccessAndRefreshToken(user._id);

  const loggedinUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true
  };

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshtoken, options)
  .json(
    new ApiResponce(
      200,
      {
        user: loggedinUser,
        accessToken,
        refreshtoken
      },
      "User loggedin successfully"
    )
  );

});


export const userLogout = asyncHandler(async (req, res) => {
  const userId = req?.user?._id;

  await User.findByIdAndUpdate(userId, 
    {
      $unset: { refreshToken: 1 }
    }, 
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true
  };

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(
    new ApiResponce(
      200,
      {},
      "User loggedout"
    )
  )

});


export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  };

  const decode = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  if (!decode) {
    throw new ApiError(401, "Token expired or invalid");
  };

  console.log("decode token:", decode);

  const user = await User.findById(decode?._id);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  };

  if (incomingRefreshToken !== user?.refreshToken) {
    throw ApiError(401, "Refresh token is expired or used");
  };

  const {accessToken, refreshtoken} = await generateAccessAndRefreshToken(user._id);

  const options = {
    httpOnly: true,
    secure: true
  };

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshtoken, options)
  .json(
    new ApiResponce (
      200,
      { accessToken, refreshtoken },
      "Access token refreshed"
    )
  )

});


export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!(oldPassword && newPassword)) {
    throw new ApiError(400, "Password filed requierd");
  };
  
  const user = await User.findById(req?.user?._id);

  if (!user) {
    throw new ApiError(401, "Unauthorized request");
  };

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid credentials");
  };

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
  .status(200)
  .json(
    new ApiResponce(200, {}, "Password change successfully")
  );

});


export const getCurrentUser = asyncHandler(async (req, res) => {
  // const user = await User.findById(req?.user?._id).select(
  //   "-password"
  // );

  // if (!user) {
  //   throw new ApiError(401, "Unauthorized request")
  // };

// console.log("current user:", req?.user)
  return res
  .status(200)
  .json(
    new ApiResponce(
      200, 
      req?.user,
      "current user fetched"
    )
  )

});


export const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, username, email} = req.body;

  if (!fullName.trim() && !username.trim() && !email.trim()) {
    throw new ApiError(400, " Provide at least one field");
  };

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        username,
        email,
        fullName
      }
    },
    { new: true }
  ).select("-password");

  return res
  .status(200)
  .json(
    new ApiResponce(200, user, "Account details updated successfully")
  )

});


export const updateAvatar = asyncHandler(async (req, res) => {

  const avatarLocalFilePath = req?.file?.path;

  if (!avatarLocalFilePath) {
    throw new ApiError(400, "Avatar file is missing");
  };

  const avatar = await uploadOnCloudinary(avatarLocalFilePath, AVATAR_CLOUD_FOLDER_PATH);

  if (!avatar) {
    throw new ApiError(500, "Failed avatar file uploade on cloudinary");
  };

  // get public id for delete from cloudinary
  const avatarOldPublicId = (
    await User.findById(req.user?._id)
    .select("avatar.public_id")
    .lean()
  )?.avatar?.public_id;

  // Update new cloudinary url & public id
  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        avatar: {
          url: avatar.url,
          public_id: avatar.public_id
        }
      }
    },
    { new: true }
  ).select("-password");

  const cloudinaryDeleteRes = await deleteFromCloudinary(avatarOldPublicId);

  if (cloudinaryDeleteRes.result !== "ok") {
    console.warn("Cloudinary avatar delete warning:", cloudinaryDeleteRes)
  }

  return res
  .status(200)
  .json(
    new ApiResponce(200, user, "Avatar updataed successfully")
  );

});


export const updateCoverImage = asyncHandler(async (req, res) => {

  const coverImageLocalFilePath = req?.file?.path;

  if (!coverImageLocalFilePath) {
    throw new ApiError(400, "Cover image file is missing");
  };

  // Upload new img on cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalFilePath, COVER_IMAGE_CLOUD_FOLDER_PATH);

  if (!coverImage) {
    throw new ApiError(500, "Failed cover image file uploade on cloudinary");
  };

  const user = await User.findById(req?.user?._id)
  .select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  };

  const coverImageOldPublicId = user.coverImage?.public_id;
  // console.log("cover image old public id:", coverImageOldPublicId)

  // Update new cloudinary url and public id
  user.coverImage.url = coverImage?.url;
  user.coverImage.public_id = coverImage?.public_id;
  await user.save();

  // Delete img from cloudinary
  const cloudinaryDeleteRes = await deleteFromCloudinary(coverImageOldPublicId);

  if (cloudinaryDeleteRes.result !== "ok") {
    console.warn("Cloudinary cover image delete warning:", cloudinaryDeleteRes)
  }

  // const user = await User.findByIdAndUpdate(
  //   req?.user?._id,
  //   {
  //     $set: {coverImage: coverImage.url}
  //   },
  //   { new: true }
  // ).select("-password");

  return res
  .status(200)
  .json(
    new ApiResponce(200, user, "Cover image updataed successfully")
  );

});


export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  };

  const channel = await User.aggregate( [
    {
      $match: {
        username: username.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"  
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false
          }
        }
      }
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,

        subscribers: 1,
        subscribedTo: 1,
      }
    }
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not exists");
  };

  console.log("Channel:", channel)

  return res
  .status(200)
  .json(
    new ApiResponce(200, channel[0], "Channel found successfully")
  );

});


export const getWatchHistory = asyncHandler(async (req, res) => {
  
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [   // find onwers in videos
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1
                  }
                }
              ]
            }
          }, 
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ]);

  console.log("watch history user:", user)

  return res
  .status(200)
  .json(
    new ApiResponce(
      200,
      user[0].watchHistory,
      "Watch history fetched successfully"
    )
  );

});


export const uploadVideo = asyncHandler(async (req, res) => {

  const { title, description } = req.body;

  if (!title || !description) {
   throw new ApiError(400, "All fields are required") 
  }

  const { videoLocalPath } = req.file?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is missing");
  };

  const cldVideo = await uploadOnCloudinary(videoLocalPath, VIDEO_CLOUD_FOLDER_PATH);

  if (!cldVideo) {
    throw new ApiError(400, "Video file is required");
  };

  const createdVideo = await Video.create({
    videoFile: cldVideo.url,
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