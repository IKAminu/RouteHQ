# Deployment smoke check

This file is a harmless deployment trigger and documents the expected publishing path.

The production application is built with Vite and published from the `dist/` directory by `.github/workflows/deploy-pages.yml` on pushes to `main`.

The deployed site should serve the current React application bundle, including the Settings tabs and first-run onboarding implemented on `main`.
