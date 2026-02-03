import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponce } from "../utils/ApiResponce.js";


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
}


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
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPth);
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
    avatar: avatar.url,
    coverImage: coverImage?.url || ""
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
      $set: { refreshToken: undefined }
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