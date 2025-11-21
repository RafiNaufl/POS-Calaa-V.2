// Wrapper to conditionally run frontend env check during builds
// Use SKIP_FRONTEND_ENV_CHECK=1 to skip this in backend-only deployments (e.g., Railway)

const skip = ["1", "true", "yes"].includes(String(process.env.SKIP_FRONTEND_ENV_CHECK).toLowerCase());

if (skip) {
  console.log("[prebuild] SKIP_FRONTEND_ENV_CHECK=1 set — skipping frontend env lint.");
  process.exit(0);
}

require("./check-env-frontend.js");

