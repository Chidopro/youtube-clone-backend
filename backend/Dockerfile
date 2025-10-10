FROM python:3.11


LABEL fly_launch_runtime="flask"

WORKDIR /code

SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends gcc ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

ENV FLASK_APP=app.py \
    FLASK_RUN_PORT=8080 \
    FLASK_RUN_HOST=0.0.0.0

CMD ["python", "app.py"]
