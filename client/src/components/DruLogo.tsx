const LOGO_URL = "/new-dru-clear-transparent-logo.png";
const LOGO_URL_LIGHT = "/new-dru-clear-navy-logo.png";
const WEBSITE_URL = "https://druaiconsulting.com";

interface LogoProps {
  height?: number;
  linkToWebsite?: boolean;
  linkToHome?: boolean;
  variant?: "dark" | "light";
}

export default function DruLogo({
  height = 68,
  linkToWebsite = false,
  linkToHome = false,
  variant = "dark",
}: LogoProps) {
  const src = variant === "light" ? LOGO_URL_LIGHT : LOGO_URL;

  const img = (
    <img
      src={src}
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

export { LOGO_URL, LOGO_URL_LIGHT, WEBSITE_URL };
