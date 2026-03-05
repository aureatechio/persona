FROM python:3.11-slim

# FFmpeg is required for Whisper + video compose
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download Whisper model at build time (avoids download at runtime)
ARG WHISPER_MODEL=base
RUN python -c "import whisper; whisper.load_model('${WHISPER_MODEL}')"

CMD ["python", "-u", "worker.py"]
