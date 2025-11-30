FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md s7_mock_server.py ./

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsnap7-1 libsnap7-dev \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir anyio python-snap7 rich python-dotenv

EXPOSE 1102

CMD ["python", "s7_mock_server.py"]
