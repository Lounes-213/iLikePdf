import { Icon } from "@app/ui/Icon";
import "@app/components/shared/BrandMark.css";

interface BrandMarkProps {
  /** Height of the mark (CSS length). */
  height?: string;
  className?: string;
}

/**
 * The iLikePdf heart mark, rendered inline so its fill follows the active
 * theme token. Callers can add `sui-brandmark--working` to drift it while a job
 * runs.
 */
export function BrandMark({ height = "1.6rem", className }: BrandMarkProps) {
  return (
    <Icon
      name="stirling-mark"
      size={height}
      className={`sui-brandmark${className ? ` ${className}` : ""}`}
      title="iLikePdf"
    />
  );
}
