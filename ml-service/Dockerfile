FROM python:3.11-slim

WORKDIR /app

# System deps for audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Use small Whisper model by default; set WHISPER_MODEL=medium or =large-v3 for production
ENV WHISPER_MODEL=base

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
