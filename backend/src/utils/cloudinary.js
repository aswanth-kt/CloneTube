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

    console.log("File uploaded on cloudinary ", response.url);

    // successfully img uploade on cloudinary then remove local image
    fs.unlinkSync(localFilePath);

    return response;

  } catch (error) {
    // if upload operation is failed delete file from temp
    fs.unlinkSync(localFilePath);
    return null;
  }
};
 



// cloudinary.v2.uploader
// .upload("dog.mp4", {
//   resource_type: "video", 
//   public_id: "my_dog",
//   overwrite: true, 
//   notification_url: "https://mysite.example.com/notify_endpoint"})
// .then(result=>console.log(result));