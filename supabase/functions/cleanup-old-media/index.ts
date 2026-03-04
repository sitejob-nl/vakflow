import { createAdminClient } from "../_shared/supabase.ts";
import { corsHeaders, jsonRes, optionsResponse } from "../_shared/cors.ts";

const BUCKET = "whatsapp-media";
const MAX_AGE_DAYS = 90;
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  // Verify cron secret to prevent unauthenticated access
  const cronSecret = Deno.env.get("CRON_SECRET");
  const requestSecret = req.headers.get("X-Cron-Secret") || req.headers.get("x-cron-secret");
  if (!cronSecret || requestSecret !== cronSecret) {
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createAdminClient();
    const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    let totalErrors = 0;

    // List all top-level folders (company IDs)
    const { data: folders, error: listError } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: 1000 });

    if (listError) {
      console.error("Error listing folders:", listError.message);
      return jsonRes({ error: listError.message }, 500);
    }

    for (const folder of folders || []) {
      if (!folder.name) continue;

      // List files in each company folder
      const { data: files, error: filesError } = await supabase.storage
        .from(BUCKET)
        .list(folder.name, { limit: 1000 });

      if (filesError) {
        console.error(`Error listing files in ${folder.name}:`, filesError.message);
        totalErrors++;
        continue;
      }

      const oldFiles = (files || []).filter((f) => {
        if (!f.created_at) return false;
        return new Date(f.created_at) < cutoffDate;
      });

      if (oldFiles.length === 0) continue;

      // Delete in batches
      for (let i = 0; i < oldFiles.length; i += BATCH_SIZE) {
        const batch = oldFiles.slice(i, i + BATCH_SIZE);
        const paths = batch.map((f) => `${folder.name}/${f.name}`);

        const { error: deleteError } = await supabase.storage
          .from(BUCKET)
          .remove(paths);

        if (deleteError) {
          console.error(`Error deleting batch in ${folder.name}:`, deleteError.message);
          totalErrors++;
        } else {
          totalDeleted += batch.length;
        }
      }
    }

    console.log(`Cleanup complete: ${totalDeleted} files deleted, ${totalErrors} errors`);
    return jsonRes({ success: true, deleted: totalDeleted, errors: totalErrors });
  } catch (err) {
    console.error("cleanup-old-media error:", err);
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
