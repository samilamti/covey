#!/usr/bin/env bash
# Quick regression check — run after merges or when something seems broken.
# Uses Claude Code headless mode to run tests and bisect failures.

set -euo pipefail

claude -p "Run all tests. If any fail, identify the most recent commit that likely caused the failure and explain why." --allowedTools "Read,Bash,Grep"
