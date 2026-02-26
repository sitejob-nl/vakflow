import { useSignedUrl } from "@/hooks/useSignedUrl";

interface SignedMediaProps {
  bucket: string;
  url: string | null | undefined;
  type: "image" | "video" | "audio" | "document" | "sticker" | string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Component that renders media from a private storage bucket using signed URLs.
 */
export function SignedMedia({ bucket, url, type, alt, className, children }: SignedMediaProps) {
  const signedUrl = useSignedUrl(bucket, url);

  if (!signedUrl) return null;

  switch (type) {
    case "image":
    case "sticker":
      return (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={signedUrl}
            alt={alt || "Media"}
            className={className || "rounded-md max-w-[220px] max-h-[160px] object-cover"}
            loading="lazy"
          />
        </a>
      );
    case "video":
      return (
        <video
          src={signedUrl}
          controls
          preload="metadata"
          className={className || "rounded-md max-w-[240px] max-h-[180px]"}
        />
      );
    case "audio":
      return (
        <audio src={signedUrl} controls preload="metadata" className={className || "h-8 max-w-[200px]"} />
      );
    case "document":
      return (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {children || "Document openen"}
        </a>
      );
    default:
      return null;
  }
}
