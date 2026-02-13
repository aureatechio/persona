FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./persona_chat/

EXPOSE 8000

CMD ["uvicorn", "persona_chat.main:app", "--host", "0.0.0.0", "--port", "8000"]
