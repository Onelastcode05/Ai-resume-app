import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./db.js";  
import resumeRoutes from "../routes/resumeRoutes.js";
import jobRoutes from "../routes/jobs.js";
import fs from "fs";
import applicationsRoutes from "../routes/applications.js";

dotenv.config();

const app = express();

// Ensure uploads folder exists
const dir = "./uploads";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Routes
app.use("/api/resumes", resumeRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationsRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Backend API running with Supabase...");
});


app.get("/test-supabase", async (req, res) => {
  const { data, error } = await supabase.from("resumes").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Test endpoint to see table structure
app.get("/test-table-structure", async (req, res) => {
  try {
    // Try to get one record to see the structure
    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .limit(1);
    
    if (error) {
      return res.status(500).json({ 
        error: error.message,
        details: error.details,
        hint: error.hint
      });
    }
    
    res.json({
      message: "Table structure check",
      hasData: data && data.length > 0,
      sampleRecord: data && data.length > 0 ? data[0] : null,
      columns: data && data.length > 0 ? Object.keys(data[0]) : []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// JSON 404 handler to avoid HTML responses
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// JSON error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err?.message || "Server error" });
});

// Start server (no connectDB or mongoose)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
