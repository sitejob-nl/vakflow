

## Plan: Fix e-mail template preview

### Probleem

De preview-tab in `EmailTemplateEditor` gebruikt `doc.write()` via een `useEffect` om HTML in een iframe te schrijven. Dit heeft twee problemen:

1. **Timing issue**: Radix `TabsContent` mount de inhoud lazy. De `useEffect` kan vuren voordat de iframe's `contentDocument` beschikbaar is.
2. **`doc.write()` is verouderd**: Moderne browsers behandelen dit steeds restrictiever in sandboxed iframes.

### Oplossing

Vervang de iframe + `useEffect` + `doc.write()` aanpak door het `srcDoc` attribuut op de iframe. Dit is declaratief, heeft geen timing-issues, en werkt betrouwbaar in alle browsers.

### Wijziging in `src/components/EmailTemplateEditor.tsx`

**Verwijderen:**
- De `iframeRef` (regel 176)
- De `useEffect` voor preview (regels 204-208)

**Aanpassen (regels 442-447):**
```tsx
// Was:
<iframe ref={iframeRef} title="E-mail preview" sandbox="allow-same-origin"
  className="w-full min-h-[400px] border-0" />

// Wordt:
<iframe srcDoc={htmlBody} title="E-mail preview" sandbox="allow-same-origin"
  className="w-full min-h-[400px] border-0" />
```

Dit is een eenregelige fix die het hele timing-probleem elimineert.

