#!/usr/bin/env python3
"""
setup_render.py — One-time setup script to push code to GitHub and deploy to Render.

Usage:
    python setup_render.py

This script:
  1. Initialises a git repo (if not already)
  2. Stages all code files (excluding secrets)
  3. Creates initial commit
  4. Guides you to create GitHub repo and push
  5. Prints exact Render environment variable values to copy
"""

import os
import json
import subprocess
import sys

FIREBASE_JSON_PATH = os.path.join(
    os.path.expanduser("~"), "Downloads",
    "energy-twins-ai-firebase-adminsdk-fbsvc-459018b1c0.json"
)

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))


def run(cmd, cwd=None, check=True):
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd or PROJECT_ROOT,
                            capture_output=True, text=True)
    if result.stdout.strip():
        print(f"    {result.stdout.strip()}")
    if result.returncode != 0 and check:
        print(f"  ⚠  {result.stderr.strip()}")
    return result


def init_git():
    print("\n🔧 Setting up Git repository…")
    git = r"C:\Program Files\Git\bin\git.exe"

    if not os.path.exists(os.path.join(PROJECT_ROOT, ".git")):
        run(f'"{git}" init')
        run(f'"{git}" config user.email "energytwins@local.dev"')
        run(f'"{git}" config user.name "Energy Twins AI"')
    else:
        print("  ✅ Git repo already exists.")

    run(f'"{git}" add -A')
    result = run(f'"{git}" commit -m "feat: migrate to Firebase + Render cloud deployment"', check=False)
    if result.returncode != 0:
        print("  ℹ  Nothing to commit or commit failed — continuing.")

    print("  ✅ Git ready.")


def print_env_vars():
    print("\n" + "="*70)
    print("  📋 RENDER ENVIRONMENT VARIABLES")
    print("  Copy these into your Render service → Environment tab")
    print("="*70)

    if os.path.exists(FIREBASE_JSON_PATH):
        with open(FIREBASE_JSON_PATH, "r") as f:
            cred_json = f.read().strip()
        # Minify JSON (remove whitespace) for env var
        cred_min = json.dumps(json.loads(cred_json), separators=(',', ':'))

        print(f"\n  Key:   FIREBASE_PROJECT_ID")
        print(f"  Value: energy-twins-ai")
        print(f"\n  Key:   FIREBASE_CREDENTIALS_JSON")
        print(f"  Value: {cred_min}")
    else:
        print(f"\n  ⚠  Service account JSON not found at:")
        print(f"     {FIREBASE_JSON_PATH}")

    print(f"\n  Key:   USE_FIREBASE")
    print(f"  Value: true")
    print(f"\n  Key:   ENABLE_ESP32_SIM")
    print(f"  Value: true")
    print("\n" + "="*70)


def print_github_instructions():
    print("\n📦 NEXT STEPS — Push to GitHub & Deploy on Render")
    print("-"*60)
    print("""
  1. Create a GitHub repository:
     → Go to https://github.com/new
     → Name it: energy-twins-ai
     → Set to PUBLIC (Render free tier requires public repo)
     → Click "Create repository"

  2. Push your code (run these in PowerShell):
     $env:GIT = "C:\\Program Files\\Git\\bin\\git.exe"
     & $env:GIT remote add origin https://github.com/YOUR_USERNAME/energy-twins-ai.git
     & $env:GIT branch -M main
     & $env:GIT push -u origin main

  3. Deploy on Render:
     → Go to https://render.com
     → Click "New +" → "Web Service"
     → Connect GitHub → select "energy-twins-ai"
     → Settings:
         Language:       Python 3
         Build Command:  pip install -r backend/requirements.txt
         Start Command:  uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     → Add Environment Variables (printed above)
     → Click "Create Web Service"
     → Wait ~3-5 minutes for deploy

  4. Copy your Render URL (e.g. https://energy-twins-ai.onrender.com)
     and tell the AI assistant to update Netlify with that URL.
""")


if __name__ == "__main__":
    print("🚀 ENERGY TWINS AI — Render Deployment Setup")
    init_git()
    print_env_vars()
    print_github_instructions()
    print("\n✅ Setup complete! Follow the steps above to deploy.\n")
