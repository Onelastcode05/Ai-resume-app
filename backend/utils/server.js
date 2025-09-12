import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import resumeRoutes from "../routes/resumeRoutes.js";
import fs from "fs";

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
app.use(express.urlencoded({ extended: true })); // needed for form submissions

// Routes
app.use("/api/resumes", resumeRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Backend API running...");
});

// MongoDB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error", err));

app.listen(5000, () => console.log("Server running on port 5000"));

connectDB();
