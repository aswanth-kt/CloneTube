import { asyncHandler } from "../utils/asyncHandler.js";

export const userRegister = asyncHandler(async (req, res) => {
  res.status(201).json({
    message: "Success"
  })
});