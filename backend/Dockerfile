FROM python:3.11


LABEL fly_launch_runtime="flask"

WORKDIR /code

SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends gcc ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

ENV PORT=8080

# Use gunicorn so the app listens on 0.0.0.0:8080 immediately (Fly expects this)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "4", "--timeout", "120", "app:app"]
