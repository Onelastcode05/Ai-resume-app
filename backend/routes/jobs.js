import express from "express";
import { supabase } from "../utils/db.js";

const router = express.Router();

// GET all jobs
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

// GET jobs by recruiter
router.get("/recruiter/:recruiter_id", async (req, res) => {
  try {
    const { recruiter_id } = req.params;

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("recruiter_id", recruiter_id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

// POST new job
router.post("/", async (req, res) => {
  try {
    const { title, description, recruiter_id } = req.body;

    if (!title || !description || !recruiter_id) {
      return res.status(400).json({ error: "title, description, and recruiter_id are required" });
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert([{
        title,
        description,
        recruiter_id,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      message: "Job posted successfully",
      data: data[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

// DELETE job
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

export default router;
