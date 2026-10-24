import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  tailwind.configs.recommended,
  {
    settings: {
      tailwindcss: {
        callees: ["cn", "cva"],
        cssConfigPath: "app/globals.css",
      },
    },
    rules: {
      // Tailwind v4 manages theme tokens via CSS variables in globals.css
      "tailwindcss/no-custom-classname": "off",
    },
  },
  {
    files: ["components/ui/**"],
    rules: {
      "tailwindcss/classnames-order": "off",
      "tailwindcss/enforces-canonical-classname": "off",
      "tailwindcss/enforces-negative-arbitrary-values": "off",
      "tailwindcss/no-unnecessary-arbitrary-value": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
