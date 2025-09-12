import express from "express";
import multer from "multer";
import fs from "fs";
import Resume from "../models/resume.js";

const router = express.Router();

// Ensure uploads folder exists
const dir = "./uploads";
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // folder to store files
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// POST /api/resumes → upload resume
router.post("/", upload.single("resume"), async (req, res) => {
  try {
    console.log("req.file",req.file);
    console.log("req.body:",req.body);
    const { name, email, skills, education, experience } = req.body;

    const newResume = new Resume({
      userId: req.user?._id || null, // later with auth
      name,
      email,
      skills: skills ? skills.split(",") : [], // safe split
      education,
      experience,
      resumeFile: req.file ? req.file.path : null,
    });

    await newResume.save();
    res.status(201).json({ message: "Resume uploaded successfully", resume: newResume });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default router;
