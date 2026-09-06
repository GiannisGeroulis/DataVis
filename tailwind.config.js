/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.1)",
        input: "rgba(255, 255, 255, 0.05)",
        ring: "#22c55e", // Pitch Green
        background: "#09090b", // Pure Dark
        foreground: "#fafafa",
        primary: {
          DEFAULT: "#22c55e", // Emerald Pitch Green
          foreground: "#09090b",
        },
        secondary: {
          DEFAULT: "#27272a", // Dark Grey
          foreground: "#fafafa",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "#18181b",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "#27272a",
          foreground: "#fafafa",
        },
        popover: {
          DEFAULT: "#09090b",
          foreground: "#fafafa",
        },
        card: {
          DEFAULT: "#18181b", // Carbon Card
          foreground: "#fafafa",
          border: "rgba(255, 255, 255, 0.06)",
        },
        pitch: {
          green: "#1b4332",
          dark: "#081c15",
          line: "rgba(255, 255, 255, 0.25)",
        }
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      boxShadow: {
        'glow-green': '0 0 15px rgba(34, 197, 94, 0.2)',
        'glow-card': '0 4px 30px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
