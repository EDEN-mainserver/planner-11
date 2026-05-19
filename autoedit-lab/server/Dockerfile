FROM python:3.12-slim

# ffmpeg 설치
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY autoedit-lab/server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY autoedit-lab/server/ .

RUN mkdir -p uploads

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
