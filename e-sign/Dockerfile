FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 (Pillow, reportlab 의존성)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6-dev libjpeg-dev libpng-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 업로드 폴더 생성
RUN mkdir -p /data/uploads

ENV UPLOAD_FOLDER=/data/uploads
ENV FLASK_DEBUG=0
ENV PORT=5050

EXPOSE 5050

CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5050", "--workers", "2", "--timeout", "60"]
