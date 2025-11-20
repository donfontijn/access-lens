/**
 * Design tokens aligned with WCAG-friendly typography rules.
 * Centralising these values keeps the UI consistent and makes it easy
 * to reason about accessibility tradeoffs.
 */
export const typographyTokens = {
  fonts: {
    base: "var(--font-family-base)",
    accessible: "var(--font-family-accessible)",
  },
  sizes: {
    body: "17px",
    secondary: "16px",
    caption: "15px",
    h1: "30px",
    h2: "24px",
    h3: "19px",
    button: "16px",
    uppercase: "18px",
  },
  lineHeights: {
    body: 1.6,
    relaxed: 1.7,
    heading: 1.25,
  },
  letterSpacing: {
    body: "0.005em",
    uppercase: "0.02em",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
};

export const layoutTokens = {
  textMaxWidth: "44rem", // ~75 characters for calm reading
  paragraphSpacing: "1.1rem",
  sectionSpacing: "2.5rem",
};

