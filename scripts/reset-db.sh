#!/usr/bin/env bash
# Reset the local Supabase database: drops data, reapplies migrations, reruns seed.
# Local only - never run against the linked remote project.

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: brew install supabase/tap/supabase-beta" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start your Docker provider (Docker Desktop, Colima, etc.) and retry." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
supabase db reset
