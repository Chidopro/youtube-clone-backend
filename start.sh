#!/bin/bash

# Install Python dependencies (if needed)
pip install --no-cache-dir flask flask-cors python-dotenv requests stripe supabase twilio gunicorn

# Do NOT start the app here! Render will use the Start Command. 