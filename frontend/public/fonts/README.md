# Fonts

Self-hosted variable fonts (decision FD-61: no Google Fonts, CSP `'self'`).
`@font-face` rules: `src/styles/_typography.scss`.

| File | Source | Weights | Subset |
|---|---|---|---|
| `inter-latin.woff2` | `@fontsource-variable/inter@5.3.0` → `files/inter-latin-wght-normal.woff2` | 100–900 | latin |
| `inter-cyrillic.woff2` | `@fontsource-variable/inter@5.3.0` → `files/inter-cyrillic-wght-normal.woff2` | 100–900 | cyrillic |
| `manrope-latin.woff2` | `@fontsource-variable/manrope@5.3.0` → `files/manrope-latin-wght-normal.woff2` | 200–800 | latin |
| `manrope-cyrillic.woff2` | `@fontsource-variable/manrope@5.3.0` → `files/manrope-cyrillic-wght-normal.woff2` | 200–800 | cyrillic |

License: SIL Open Font License 1.1 (`LICENSE-Inter.txt`, `LICENSE-Manrope.txt`).
The npm packages are not project dependencies; files were copied once.
