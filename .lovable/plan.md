## Status: Afgerond

Alle drie verbeteringen uit het plan zijn geïmplementeerd:

1. ✅ **Bug fix sync-all-contacts**: `type: "P"` → `cust.type === "zakelijk" ? "B" : "P"` + `contact: cust.contact_person || ""`
2. ✅ **safeMessages uitgebreid**: `MUT_`, `INV_`, `REL_`, `e-Boekhouden POST/PATCH` toegevoegd
3. ✅ **pull-invoice-status verbeterd**: gebruikt nu `/v1/mutation/invoice/outstanding` met fallback naar `paymentDate` check
