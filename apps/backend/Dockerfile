FROM python:3.13-slim

WORKDIR /app

# Install postgres client (for psycopg2) + build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x start.sh

EXPOSE 8080

ENV PORT=8080

CMD ["./start.sh"]
