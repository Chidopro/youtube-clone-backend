"""Test script to check if app imports correctly"""
import sys
import traceback

print("Testing app imports...")
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")
print()

try:
    print("Importing app...")
    from app import app
    print("✅ App imported successfully!")
    print(f"✅ App type: {type(app)}")
    print(f"✅ App name: {app.name}")
    
    # Check if Blueprints are registered
    print("\nChecking registered Blueprints...")
    blueprints = list(app.blueprints.keys())
    print(f"✅ Found {len(blueprints)} registered Blueprints:")
    for bp_name in blueprints:
        print(f"   - {bp_name}")
    
    print("\n✅ All imports successful! App is ready to run.")
    
except Exception as e:
    print(f"ERROR: Error importing app: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)
