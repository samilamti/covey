#!/usr/bin/env bash
# Pre-deploy validation — run before pushing to main or deploying to production.
# Uses Claude Code headless mode to verify migrations, locale parity, and tests.

set -euo pipefail

claude -p "Read the latest migration file and verify it uses ALTER TABLE for existing tables, not CREATE TABLE IF NOT EXISTS. Check that all locale files have the same keys. Run the full test suite and report results." --allowedTools "Read,Bash,Grep"
