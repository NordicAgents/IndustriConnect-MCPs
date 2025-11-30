FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
COPY pyproject.toml README.md uv.lock* ethercat_mock_slave.py ./

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir . || ( \
        pip install --no-cache-dir anyio>=4.0.0 rich>=13.7.0 python-dotenv>=1.1.0 \
    )

# Ensure the server listens on all interfaces inside the container
ENV MOCK_ETHERCAT_HOST=0.0.0.0 \
    MOCK_ETHERCAT_PORT=6700 \
    MOCK_ETHERCAT_UPDATE_INTERVAL=1.0 \
    MOCK_ETHERCAT_VERBOSE=false

EXPOSE 6700/tcp

CMD ["ethercat-mock-slave"]

