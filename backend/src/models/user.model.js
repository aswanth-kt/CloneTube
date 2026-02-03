import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    avatar: {
      url:{
        type: String,
        required: true
      },
      public_id:{
        type: String,
        required: true
      },
    },
    coverImage: {
      url: String,
      public_id: String
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video"
      }
    ],
    password: {
      type: String,
      required: [true, "Password is required"]
    },
    refreshToken: {
      type: String
    },

  }, {timestamps: true}
);

// Password hasing before saving
userSchema.pre("save", async function() {
  // Password is not modify don't update it
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

// Add a method for checking password (compare bcrypt)
userSchema.methods.isPasswordCorrect = async function(password) {
  return await bcrypt.compare(password, this.password)
};

//  Generate tokens
userSchema.methods.generateAccessToken = function() {
  const payload = {
    _id: this._id,
    email: this.email,
    username: this.username,
    fullName: this.fullName
  };

  return jwt.sign(
    payload,
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  )
};

userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  )
};

export const User = mongoose.model("User", userSchema);