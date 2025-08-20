from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route("/health")
def health_check():
    """Health check endpoint for Fly.io"""
    return jsonify({"status": "healthy", "message": "Copy 5 Backend is running!"}), 200

@app.route("/")
def home():
    """Home endpoint"""
    return jsonify({"message": "Copy 5 Backend API", "status": "running"}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting Flask app on port {port}")
    app.run(debug=False, host="0.0.0.0", port=port)
