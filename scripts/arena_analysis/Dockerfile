FROM python:3.12-slim

WORKDIR /app

# FFmpeg for extracting audio from large videos before Whisper transcription
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY scripts/arena_analysis/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/arena_analysis/ ./arena_analysis/

EXPOSE 8000

CMD ["uvicorn", "arena_analysis.main:app", "--host", "0.0.0.0", "--port", "8000"]
