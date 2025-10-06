import express from "express";
import multer from "multer";
import { supabase } from "../utils/db.js";
import path from "path";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post("/", upload.single("resume"), async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!user_id) return res.status(400).json({ error: "user_id is required" });

    const fileExt = path.extname(req.file.originalname).slice(1);
    const fileName = `${user_id}/${Date.now()}.${fileExt}`;

    const { error: storageError } = await supabase.storage
      .from("resumes")
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (storageError) return res.status(500).json({ error: storageError.message });

    const { data: { publicUrl } } = supabase.storage
      .from("resumes")
      .getPublicUrl(fileName);

    supabase.from("resumes").insert([{
      user_id,
      //filename: req.file.originalname || `resume_${Date.now()}.${fileExt}`,
      resumeFile: publicUrl,
      file_size: req.file.size,
      file_type: req.file.mimetype
    }]).then(result => {
      if (result.error) console.error("Metadata insert failed:", result.error);
    });

    res.status(201).json({ message: "Resume uploaded successfully", url: publicUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large. Max 10MB." });
    return res.status(400).json({ error: error.message });
  }
  if (error) return res.status(400).json({ error: error.message });
  next();
});

export default router;
