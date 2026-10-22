FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY create_user.py .

RUN useradd --create-home appuser
USER appuser

ENV API_PORT=8009
EXPOSE 8009
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${API_PORT} --workers ${API_WORKERS:-2} --proxy-headers --forwarded-allow-ips='*'"]
