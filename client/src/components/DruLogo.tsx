const LOGO_URL = "https://assets.cdn.filesafe.space/gl07I4JnbkGgW8zJprSz/media/69d1a1c384c045c2744d50f6.png";
const WEBSITE_URL = "https://druaiconsulting.com";

interface LogoProps {
  height?: number;
  linkToWebsite?: boolean;
  linkToHome?: boolean;
}

export default function DruLogo({ height = 40, linkToWebsite = false, linkToHome = false }: LogoProps) {
  const img = (
    <img
      src={LOGO_URL}
      alt="DRU CLEAR™ — AI Mastery. Leadership Clarity. Measurable Results."
      style={{ height, width: "auto", display: "block" }}
    />
  );

  if (linkToWebsite) {
    return (
      <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", lineHeight: 0 }}>
        {img}
      </a>
    );
  }

  if (linkToHome) {
    return (
      <a href="/" style={{ display: "inline-block", lineHeight: 0 }}>
        {img}
      </a>
    );
  }

  return img;
}

export { LOGO_URL, WEBSITE_URL };
