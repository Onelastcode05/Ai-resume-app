import express from "express";
import { supabase } from "../utils/db.js";

const router = express.Router();

/**
 * POST /api/applications
 * Body: { user_id: string (Supabase auth user id), job_id: string | number, status?: string }
 *
 * Validations:
 * 1) user_id is provided and exists in Supabase Auth (auth.users)
 *    - OPTIONAL: If your FK targets an app-level 'users' table instead of auth.users,
 *      this code attempts an upsert into 'users' with the given id to prevent FK errors.
 *      If your FK targets auth.users, you must ensure the user already exists in auth.
 * 2) job_id is provided and exists in 'jobs'
 * 3) user has at least one resume in 'resumes'
 *
 * Inserts an application only after all validations succeed.
 * Returns JSON with proper HTTP status codes.
 */
router.post("/", async (req, res) => {
  try {
    const { user_id, job_id, status } = req.body;

    // Basic input validation
    if (!user_id || !job_id) {
      return res.status(400).json({ error: "user_id and job_id are required" });
    }

    // Validate user exists in Supabase Auth
    const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(user_id);
    if (userErr) {
      return res.status(500).json({ error: userErr.message || "Failed to validate user" });
    }
    if (!userResp?.user) {
      // OPTIONAL: If your FK references an app-level 'users' table (not auth.users),
      // you can upsert a shadow record here to prevent FK issues.
      // If your FK references auth.users, you cannot create an auth user from here; return 400.
      const { error: upsertErr } = await supabase
        .from("users")
        .upsert([{ id: user_id }], { onConflict: "id" });
      if (upsertErr) {
        // FK likely targets auth.users; surface an actionable error
        return res.status(400).json({
          error:
            "Unknown user_id. Ensure this is a valid Supabase auth user id, or align the FK to your 'users' table.",
        });
      }
    }

    // Validate job exists
    const { data: jobRow, error: jobErr } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", job_id)
      .maybeSingle();
    if (jobErr) {
      return res.status(500).json({ error: jobErr.message || "Failed to validate job" });
    }
    if (!jobRow) {
      return res.status(400).json({ error: "Unknown job_id; job not found" });
    }

    // Ensure user has at least one resume (use created_at if available; otherwise fallback)
    let { data: latestResume, error: resumeErr } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resumeErr) {
      // Fallback without ordering in case created_at is not present in your schema
      const fallback = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .maybeSingle();
      latestResume = fallback.data;
      resumeErr = fallback.error;
    }

    if (resumeErr) {
      return res.status(500).json({ error: resumeErr.message || "Failed to check resumes" });
    }
    if (!latestResume) {
      return res.status(400).json({ error: "No resume found for this user" });
    }

    // All validations passed → insert application
    const applicationRow = {
      user_id,
      job_id,
      status: status || "pending",
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("applications")
      .insert([applicationRow])
      .select()
      .limit(1);

    if (insertErr) {
      return res.status(500).json({ error: insertErr.message || "Failed to insert application" });
    }

    return res.status(201).json({ message: "Application submitted", data: inserted?.[0] || null });
  } catch (err) {
    // Unexpected server error
    // eslint-disable-next-line no-console
    console.error("POST /api/applications error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/**
 * GET /api/applications/job/:jobId
 * Returns all applications for a job with basic user info and the user's latest resume.
 * This is a simple fan-out implementation (n+1 queries) for clarity.
 */
router.get("/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: "jobId is required" });

    // Fetch applications for the job
    const { data: apps, error: appsErr } = await supabase
      .from("applications")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (appsErr) {
      return res.status(500).json({ error: appsErr.message || "Failed to fetch applications" });
    }
    if (!apps || apps.length === 0) return res.json([]);

    const userIds = [...new Set(apps.map((a) => a.user_id))];

    // Fetch user info from Supabase Auth
    const usersMap = new Map();
    for (const uid of userIds) {
      const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(uid);
      if (!userErr && userResp?.user) {
        usersMap.set(uid, {
          id: userResp.user.id,
          email: userResp.user.email,
          name:
            userResp.user.user_metadata?.full_name ||
            userResp.user.user_metadata?.name ||
            null,
        });
      } else {
        usersMap.set(uid, { id: uid, email: null, name: null });
      }
    }

    // Fetch latest resume per user
    const resumesMap = new Map();
    for (const uid of userIds) {
      let { data: latestResume, error: rErr } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rErr) {
        const fb = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();
        latestResume = fb.data;
        rErr = fb.error;
      }

      if (!rErr && latestResume) {
        resumesMap.set(uid, {
          id: latestResume.id,
          file_url:
            latestResume.resume_url ||
            latestResume.file_url ||
            latestResume.resumeFile ||
            null,
          filename: latestResume.file_name || null,
          uploaded_at: latestResume.created_at || latestResume.uploaded_at || null,
        });
      } else {
        resumesMap.set(uid, null);
      }
    }

    // Combine and return
    const result = apps.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      job_id: a.job_id,
      status: a.status,
      created_at: a.created_at,
      user: usersMap.get(a.user_id) || { id: a.user_id },
      resume: resumesMap.get(a.user_id),
    }));

    return res.json({ message: "OK", data: result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/applications/job/:jobId error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
});

/**
 * Optional health check for quick verification in browser:
 * GET /api/applications/health → { ok: true }
 */
router.get("/health", (req, res) => {
  res.json({ ok: true });
});

export default router;