

## Two fixes needed

### 1. FK-indexes migration: OK, no action needed

The existing migration uses plain `CREATE INDEX IF NOT EXISTS` (not `CONCURRENTLY`), which works correctly inside Supabase's transactional migration runner. No change required.

### 2. Missing composite index on `usage_events` for rate-limit performance

The `_shared/rate-limit.ts` helper does:
```sql
SELECT id FROM usage_events 
WHERE company_id = ? AND event_type = ? AND created_at >= ?
```

Without a composite index, this becomes a sequential scan at scale. Need to add:

```sql
CREATE INDEX IF NOT EXISTS idx_usage_events_company_type_created
  ON public.usage_events (company_id, event_type, created_at DESC);
```

This is a single new migration file with one statement.

### Implementation

1. Create one migration adding the composite index on `usage_events(company_id, event_type, created_at DESC)`

That's it — one file, one statement.

