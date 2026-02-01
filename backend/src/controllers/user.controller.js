import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponce } from "../utils/ApiResponce.js";


export const userRegister = asyncHandler(async (req, res) => {
  // get user details from frontend
  const { fullName, email, username, password} = req.body;

  // validation - not empty
  if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are require")
  };

  // check if user already exists: username, email
  const existedUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existedUser) {
    throw new ApiError(409, "You have already an account in this username or email");
  };

  // check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPth = req.files?.coverImage[0]?.path;
  // console.log("Local path: ", avatarLocalPath)

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload them to cloudinary, avatar
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