FROM python:3.11-slim

WORKDIR /app

# Install Chrome and Node.js for Lighthouse
RUN apt-get update && apt-get install -y \
    wget curl gnupg ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && wget -q -O /usr/share/keyrings/google-chrome.gpg https://dl-ssl.google.com/linux/linux_signing_key.pub \
    && echo "deb [signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update && apt-get install -y google-chrome-stable \
    && npm install -g lighthouse \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8002

# Run the FastAPI app
CMD ["python", "main.py"]