

## Probleem: Afbeeldingen niet zichtbaar in WhatsApp chat

### Oorzaak

De `storage_url` in de metadata bevat een volledige URL zoals:
```
https://sigzpqwnavfxtvbyqvzj.supabase.co/storage/v1/object/whatsapp-media/2a5c7a99.../image/0fb96e1a...jpg
```

De `extractStoragePath()` functie in `storageUtils.ts` zoekt alleen naar het patroon `/storage/v1/object/public/<bucket>/`, maar `whatsapp-media` is een **private** bucket. De URL bevat `/storage/v1/object/whatsapp-media/` (zonder `public`). Hierdoor faalt de extractie en wordt de volledige URL als pad meegegeven aan `createSignedUrl`, wat resulteert in "Object not found".

### Oplossing

**1 bestand aanpassen: `src/utils/storageUtils.ts`**

In `extractStoragePath` een extra patroon toevoegen voor private bucket URLs:
```
/storage/v1/object/<bucket>/
```

Dit naast het bestaande patroon voor public buckets (`/storage/v1/object/public/<bucket>/`).

### Technische details

Regel 12-17 van `storageUtils.ts` aanpassen om ook het private-bucket URL-patroon te herkennen. Toevoegen na het public-patroon check:

```typescript
const privatePattern = `/storage/v1/object/${bucket}/`;
const privateIdx = urlOrPath.indexOf(privatePattern);
if (privateIdx !== -1) {
  return decodeURIComponent(urlOrPath.slice(privateIdx + privatePattern.length));
}
```

