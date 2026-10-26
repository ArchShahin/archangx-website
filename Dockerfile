# One image per service, all from this file:  docker build --build-arg SERVICE=collector .
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ common/
COPY services/__init__.py services/__init__.py
ARG SERVICE
COPY services/${SERVICE}/ services/${SERVICE}/
ENV SERVICE=${SERVICE} PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --no-create-home app
USER 10001
EXPOSE 8000
# The gateway serves HTTP; every other service is a worker loop.
CMD ["sh", "-c", "if [ \"$SERVICE\" = gateway ]; then exec uvicorn services.gateway.main:app --host 0.0.0.0 --port 8000; else exec python -m services.$SERVICE.main; fi"]
