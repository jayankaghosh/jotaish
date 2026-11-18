#!/bin/sh
# Updates the server to the latest main: pulls, installs, applies database
# migrations, builds the website and restarts the PM2 apps that run from this
# folder (other apps on the server are left alone).
#
# Run from anywhere: npm run deploy   (or sh scripts/deploy.sh)
# Add --places to also reload the birthplace list (only needed when
# prisma/places.ts changes; takes a few minutes).
set -eu

# Everything is inside main, so the shell has read the whole script before
# git pull can change this file.
main() {
  cd "$(dirname "$0")/.."
  ROOT="$(pwd)"

  echo "== Pulling the latest code"
  git pull --ff-only

  echo "== Installing packages"
  npm ci

  echo "== Updating the database"
  (cd apps/api && npx prisma migrate deploy && npx prisma generate)

  if [ "${1:-}" = "--places" ]; then
    echo "== Reloading places"
    npm run places:import -w apps/api
  fi

  echo "== Building the website"
  npm run build -w apps/web

  echo "== Restarting"
  APPS="$(pm2 jlist | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const root = process.argv[1];
      const names = JSON.parse(s).filter((p) => (p.pm2_env.pm_cwd || "").startsWith(root + "/") || p.pm2_env.pm_cwd === root).map((p) => p.name);
      console.log([...new Set(names)].join(" "));
    });
  ' "$ROOT")"
  if [ -z "$APPS" ]; then
    echo "No PM2 apps run from $ROOT. Start them once, then run this again." >&2
    exit 1
  fi
  for app in $APPS; do pm2 restart "$app" --update-env; done
  pm2 save >/dev/null

  echo "== Done: restarted $APPS"
}

main "$@"
