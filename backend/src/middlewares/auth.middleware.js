import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";


export const veryfyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
  
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    };
  
    const decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  
    if (!decode) {
      throw new ApiError(401, "Something went wrong in token decode");
    };
  
    const user = await User.findById(decode?._id).select(
      "-password -refreshToken"
    );
  
    if (!user) {
      throw new ApiError(401, "Invalid Access Token")
    };
  
    req.user = user;
    next();

  } catch (error) {
    throw new ApiError(401, error?.mesage || "Invalid access token");
  };
  
});