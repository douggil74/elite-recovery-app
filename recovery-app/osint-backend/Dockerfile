# Elite Recovery OSINT Backend
# Python service with comprehensive OSINT tools

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including Go for phoneinfoga
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    golang-go \
    && rm -rf /var/lib/apt/lists/*

# Set Go environment
ENV GOPATH=/root/go
ENV PATH=$PATH:/root/go/bin:/usr/local/go/bin

# Copy requirements first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install OSINT tools
RUN pip install --no-cache-dir \
    sherlock-project \
    maigret \
    holehe \
    socialscan \
    h8mail \
    theHarvester \
    social-analyzer \
    ignorant \
    ghunt \
    photon-xss \
    instaloader \
    toutatis \
    blackbird

# Install PhoneInfoga (Go-based)
RUN go install github.com/sundowndev/phoneinfoga/v2/cmd/phoneinfoga@latest

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
