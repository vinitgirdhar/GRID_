GRID UI/UX Design SystemThis document outlines the core design principles, variables, and component structures for the GRID frontend. Stick to these rules to maintain a premium, high-performance aesthetic across all pages.Core PhilosophyGRID is built for fleet operators and drivers. The UI needs to be high-contrast, distraction-free, and easy to read at a glance. We favor deep dark backgrounds with sharp, glowing accents. Keep cognitive load low. If a driver can't read a card in one second, it needs less text and more visual hierarchy.1. Color PaletteWe use native CSS variables for the global theme. Add these to your root CSS.Global Variables:root {
  /* Backgrounds */
  --bg: #050514;       /* Deep Space Navy - Main Background */
  --bg-alt: #0a0a1e;   /* Slightly lighter for panels/modals */
  
  /* Brand Accents (Yellow/Gold) */
  --accent: #facc15;   /* Primary GRID Yellow */
  --accent2: #fbbf24;  /* Slightly darker yellow */
  --accent3: #eab308;  /* Deep gold for gradients */
  
  /* Text */
  --text: #e8edf3;       /* Off-white for high readability */
  --text-muted: #94a3b8; /* Slate gray for secondary text */
  --text-dim: #4b5e78;   /* Dark slate for disabled/tertiary text */
  
  /* UI Elements */
  --border: rgba(250,204,21,0.15); /* Faint yellow border */
  --glow: rgba(250,204,21,0.06);   /* Subtle yellow glow */
}
Contextual Colors (Tailwind)When you need semantic colors for states (success, error, etc.), use these specific Tailwind values to match the dark theme:Danger/Alert: red-500 (#ef4444)Warning/Events: orange-400 (#fb923c) or amber-500 (#f59e0b)Info/Weather: sky-400 (#38bdf8) or sky-500 (#0ea5e9)Success/Eco: green-400 (#4ade80) or emerald-400 (#34d399)2. TypographyWe use three specific Google Fonts. Never mix them randomly. Each has a strict job.Headings (Outfit)Usage: Page titles, primary numbers, massive metrics.Weights: Keep it light. Use font-light (300) or font-medium (500). Avoid ultra-heavy weights.Tailwind Class: font-headingBody (Inter)Usage: Paragraphs, descriptions, general UI text.Weights: Standard font-normal (400) or font-light (300).Tailwind Class: font-bodyData & Labels (JetBrains Mono)Usage: Eyebrow text, table headers, small tracking numbers, tags.Style: Always pair this with uppercase and tracking-widest (wide letter spacing) when using it for labels.Tailwind Class: font-mono3. Core ComponentsThe Bento CardThis is the fundamental building block of the GRID UI. Use this exact structure for any dashboard panel.Key Traits:Glassy background (bg-white/5).Subtle border (border-[var(--border)]).Rounded corners (rounded-2xl).Hover effect: Slight upward shift (hover:-translate-y-1) and an outer glow.Code Template:<div className="bento-card relative overflow-hidden bg-white/5 border border-[var(--border)] rounded-2xl p-6 hover:-translate-y-1 hover:border-[var(--accent)]/50 hover:bg-white/10 hover:shadow-[0_8px_32px_rgba(250,204,21,0.08)] transition-all duration-300 group">
  
  {/* The Hover Glow Line (Top Edge) */}
  <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[10%] group-hover:right-[10%] transition-all duration-400"></div>
  
  {/* Content Goes Here */}
</div>
Primary ButtonsButtons should look sleek and click-able, but not overwhelm the screen. We use a hollow/outline style that fills in slightly on hover.Code Template:<button className="px-8 py-2.5 rounded-full font-medium text-[var(--accent)] bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.15)] hover:border-[rgba(250,204,21,0.6)] hover:-translate-y-[2px] hover:shadow-[0_4px_20px_rgba(250,204,21,0.15)] transition-all duration-300">
  Click Me
</button>
Icon WrappersNever drop a bare Lucide icon onto the background. Always wrap it in a tinted box to anchor it.Code Template:<div className="p-2 bg-[var(--accent)]/10 rounded-lg inline-flex">
  <TrendingUp className="text-[var(--accent)] w-5 h-5" />
</div>
Eyebrow LabelsUse these above main titles or inside cards to categorize data.Code Template:<p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
  Peak Time Window
</p>
4. Global EffectsThe Noise OverlayTo prevent the dark background from looking flat or "dead," we use a fixed SVG noise overlay. This gives the entire app a subtle, premium texture.Include this in your global CSS targeting the body::before pseudo-element:body::before {
  content: '';
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.03;
  mix-blend-mode: overlay;
  transform: translateZ(0); /* Forces GPU acceleration */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
5. Spacing & Layout RulesOuter Padding: Wrap main page content in a container with max-w-7xl mx-auto p-4 sm:p-8.Gap Spacing: Use gap-4 or gap-6 for bento grids. Keep elements breathable.Borders: Rely on faint borders (border border-white/5 or border-[var(--border)]) to separate sections rather than solid background colors.Stick to these rules, and your React components will snap perfectly into the GRID aesthetic every time.