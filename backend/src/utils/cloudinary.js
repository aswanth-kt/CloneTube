import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { ApiError } from "./ApiError.js";


export const uploadOnCloudinary = async (localFilePath, cloud_folder_path) => {
  try {
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    if (!localFilePath || !cloud_folder_path) {
      console.log("Both localFilePath and cloud folder path are required");
      return null;
    }

    // Upload file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: cloud_folder_path
    });

    if (!response) {
      fs.unlinkSync(localFilePath)
      return new ApiError(400, "Cloudinary upload failed by uploading time");
    };

    // successfully img uploade on cloudinary then remove local image
    fs.unlinkSync(localFilePath);

    return response;

  } catch (error) {
    // if upload operation is failed delete file from temp
    fs.unlinkSync(localFilePath);
    return null;
  }
};
 

export const deleteFromCloudinary = async (public_id, type = "image") => {

  if (!public_id) {
    console.log("public id missing")
    return null;
  }

  try {

    const response = await cloudinary.uploader.destroy(
      public_id,
      { resource_type: type }
    );

    return response;
    
  } catch (error) {
    console.error("Cloudinary delete error:", error?.message);
    return null;
  }
}