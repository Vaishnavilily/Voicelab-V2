FROM python:3.12-slim

# ffmpeg is needed to convert voice samples and make the MP3
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render provides $PORT. One worker because only one clip is generated at a time.
CMD gunicorn app:app --bind 0.0.0.0:${PORT:-10000} --workers 1 --threads 4 --timeout 300
