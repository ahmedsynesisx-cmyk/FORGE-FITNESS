# Forge

A personal, evidence-based fitness coach that runs entirely on your device.

- **Private:** everything you enter is encrypted with your passcode (AES-GCM, PBKDF2) and stored only in your browser. Nothing is uploaded.
- **Offline:** installable as an app from Chrome ("Add to Home screen") and works without internet after the first visit.
- **Honest:** BMI is shown as a screening number with both WHO and Indian cut-offs; weight timelines are estimates, never promises; red-flag safety answers lock workouts until a doctor clears you.
- **Backup:** one encrypted file moves your data between phone and laptop.

## Status
Phase 5 (core app): onboarding, safety screen, profile, goals and pacing, measurements, passcode lock, backup and restore.
Next: Phase 6, the exercise library and workout player.

## Develop
```bash
npm install
npm run dev        # local dev server
npm test           # logic tests (Vitest)
npm run test:e2e   # click-through tests in Chromium at phone, tablet and desktop sizes (Playwright)
npm run check      # everything; must pass before any change is merged
```

Every push to `main` runs the tests and publishes to GitHub Pages.

## Not medical advice
Forge is not a substitute for a doctor, physiotherapist or registered dietitian.
