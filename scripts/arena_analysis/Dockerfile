FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./arena_analysis/

EXPOSE 8000

CMD ["uvicorn", "arena_analysis.main:app", "--host", "0.0.0.0", "--port", "8000"]
