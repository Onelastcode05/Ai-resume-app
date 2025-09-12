import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  name: { type: String, required: true },
  email: { type: String, required: true },
  skills: [String],
  education: String,
  experience: String,
  resumeFile: String, // file path or URL if uploaded
}, { timestamps: true });

export default mongoose.model("Resume", resumeSchema);
