CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON public.vehicles (customer_id);
CREATE INDEX IF NOT EXISTS idx_object_rooms_asset_id ON public.object_rooms (asset_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicle_types_asset_id ON public.fleet_vehicle_types (asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_audits_asset_id ON public.quality_audits (asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_room_scores_audit_id ON public.audit_room_scores (audit_id);