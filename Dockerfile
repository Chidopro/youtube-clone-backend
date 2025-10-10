FROM python:3.11


LABEL fly_launch_runtime="flask"

WORKDIR /code

SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends gcc ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

ENV FLASK_APP=backend/app.py \
    FLASK_RUN_PORT=8080 \
    FLASK_RUN_HOST=0.0.0.0

# Run the app from root directory
CMD ["python", "app.py"]
