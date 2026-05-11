/**
 * F1 TELEMETRY DASHBOARD
 * Design Tokens & Aesthetic Rules
 * 
 * VISION: Futuristic, precision-driven F1 pit lane experience
 * Built for engineers who appreciate craft
 */

// ============================================
// COLOR PALETTE
// ============================================
export const colors = {
  // Primary F1 Inspired
  primary: {
    red: '#EF1E24',        // F1 Ferrari Red
    cyan: '#00D9FF',       // Neon Cyan (Electric)
    darkCyan: '#00A8CC',   // Darker Cyan (Accent)
  },
  
  // Backgrounds
  background: {
    dark: '#0A0E27',       // Deep space black
    darker: '#050812',     // Absolute dark (overlays)
    card: 'rgba(20, 25, 48, 0.8)',  // Card background with transparency
  },
  
  // Accents & Status
  accent: {
    neon: '#FF006E',       // Hot pink neon (alternative accent)
    warning: '#FFB703',    // Amber for warnings
    success: '#06FFA5',    // Neon green for positive data
    error: '#FF0040',      // Bright red for alerts
  },
  
  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B5C1',
    muted: '#6B7280',
    accent: '#00D9FF',     // Cyan text for emphasis
  },
  
  // Borders & Dividers
  border: {
    primary: 'rgba(0, 217, 255, 0.2)',     // Subtle cyan border
    secondary: 'rgba(239, 30, 36, 0.15)',  // Subtle red border
    glow: 'rgba(0, 217, 255, 0.4)',        // Glowing cyan
  },
};

// ============================================
// TYPOGRAPHY
// ============================================
export const typography = {
  // Font Family Stack
  fonts: {
    display: "'Space Grotesk', 'Courier New', monospace",  // Bold, futuristic, tech-forward
    body: "'Roboto Mono', monospace",                       // Clean, readable, technical
    accent: "'Inter', sans-serif",                          // Fallback for micro text
  },
  
  // Font Sizes (rem-based for scalability)
  sizes: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '2rem',      // 32px
    '4xl': '2.5rem',    // 40px
  },
  
  // Font Weights
  weights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    mono: 400,          // Monospace is naturally bold enough
  },
  
  // Line Heights (technical readability first)
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Letter Spacing (precision aesthetic)
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.05em',
    extraWide: '0.1em',
  },
};

// ============================================
// SPACING & LAYOUT
// ============================================
export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  2: '0.5rem',      // 8px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
};

// ============================================
// BORDER RADIUS
// ============================================
export const borderRadius = {
  none: '0',
  sm: '0.25rem',     // 4px - tight corners
  base: '0.5rem',    // 8px - standard
  lg: '1rem',        // 16px - generous
  xl: '1.5rem',      // 24px - large rounded
  full: '9999px',    // Pill-shaped
};

// ============================================
// SHADOWS & EFFECTS
// ============================================
export const effects = {
  // Glow effects (neon aesthetic)
  glows: {
    cyan: '0 0 20px rgba(0, 217, 255, 0.3)',
    red: '0 0 20px rgba(239, 30, 36, 0.3)',
    intense: '0 0 40px rgba(0, 217, 255, 0.5)',
  },
  
  // Box shadows (depth)
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    base: '0 4px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.6)',
  },
  
  // Glassmorphism backdrop
  glass: 'backdrop-filter: blur(10px); background-color: rgba(20, 25, 48, 0.6); border: 1px solid rgba(0, 217, 255, 0.2);',
};

// ============================================
// ANIMATIONS & TRANSITIONS
// ============================================
export const animation = {
  durations: {
    fast: '150ms',
    base: '300ms',
    slow: '500ms',
    verySlow: '800ms',
  },
  
  timings: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Snappy, responsive
    snappy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

// ============================================
// Z-INDEX SCALE
// ============================================
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  backdrop: 40,
  modal: 50,
  tooltip: 60,
  notification: 70,
};

// ============================================
// BREAKPOINTS
// ============================================
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ============================================
// COMPONENT TOKENS
// ============================================
export const components = {
  // Button
  button: {
    primary: {
      bg: colors.primary.cyan,
      text: colors.background.dark,
      hover: colors.primary.darkCyan,
    },
    secondary: {
      bg: 'transparent',
      text: colors.primary.cyan,
      border: colors.border.primary,
    },
    danger: {
      bg: colors.primary.red,
      text: colors.text.primary,
      hover: colors.accent.error,
    },
  },
  
  // Panel / Card
  panel: {
    bg: colors.background.card,
    border: colors.border.primary,
    shadow: effects.shadows.base,
    glow: effects.glows.cyan,
  },
  
  // Input Fields
  input: {
    bg: 'rgba(10, 14, 39, 0.5)',
    border: colors.border.primary,
    text: colors.text.primary,
    placeholder: colors.text.muted,
  },
};

// ============================================
// EXPORT AS SINGLE THEME OBJECT
// ============================================
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  effects,
  animation,
  zIndex,
  breakpoints,
  components,
};

export default theme;
