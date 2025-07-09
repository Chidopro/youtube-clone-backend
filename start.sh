#!/bin/bash

# Find Python executable with Flask installed
echo "=== Finding Python with Flask ==="

# Try different Python locations
PYTHON_PATHS=(
    "/opt/render/project/.render/python/bin/python"
    "/opt/render/project/.render/python/bin/python3"
    "/usr/local/bin/python3"
    "/usr/bin/python3"
    "python3"
    "python"
)

for python_path in "${PYTHON_PATHS[@]}"; do
    echo "Trying: $python_path"
    if command -v "$python_path" >/dev/null 2>&1; then
        echo "Found Python at: $python_path"
        echo "Installing packages with this Python..."
        "$python_path" -m pip install --no-cache-dir flask flask-cors python-dotenv requests stripe supabase twilio gunicorn 2>/dev/null
        if "$python_path" -c "import flask" 2>/dev/null; then
            echo "Flask is available! Starting app..."
            export PORT=${PORT:-5000}
            exec "$python_path" app.py
        else
            echo "Flask installation failed in this Python"
        fi
    else
        echo "Python not found at: $python_path"
    fi
done

echo "=== No suitable Python found ==="
echo "Available Python installations:"
find /opt /usr -name "python*" -type f 2>/dev/null | head -10
echo "Installed packages:"
pip list 2>/dev/null || pip3 list 2>/dev/null || echo "No pip found" 