"""
OSINT API - Vercel Serverless Function
Provides username search, email discovery, and full OSINT sweeps
"""
from http.server import BaseHTTPRequestHandler
import json
import subprocess
import asyncio
import re
from typing import Optional
from urllib.parse import parse_qs

def run_sherlock(username: str) -> dict:
    """Run Sherlock username search"""
    try:
        result = subprocess.run(
            ["sherlock", username, "--print-found", "--timeout", "10"],
            capture_output=True,
            text=True,
            timeout=60
        )

        # Parse output for found sites
        found_sites = []
        for line in result.stdout.split('\n'):
            if '[+]' in line:
                # Extract URL from line
                url_match = re.search(r'https?://[^\s]+', line)
                if url_match:
                    found_sites.append({
                        "site": line.split('[+]')[1].split(':')[0].strip() if ':' in line else "Unknown",
                        "url": url_match.group(0),
                        "status": "found"
                    })

        return {
            "username": username,
            "sites_checked": 400,
            "sites_found": len(found_sites),
            "results": found_sites
        }
    except subprocess.TimeoutExpired:
        return {"error": "Search timed out", "username": username}
    except FileNotFoundError:
        return {"error": "Sherlock not installed", "username": username, "results": []}
    except Exception as e:
        return {"error": str(e), "username": username, "results": []}

def run_maigret(username: str) -> dict:
    """Run Maigret deep username search"""
    try:
        result = subprocess.run(
            ["maigret", username, "--timeout", "10", "-n", "-J", "simple"],
            capture_output=True,
            text=True,
            timeout=120
        )

        found_sites = []
        for line in result.stdout.split('\n'):
            if '[+]' in line or 'http' in line.lower():
                url_match = re.search(r'https?://[^\s]+', line)
                if url_match:
                    found_sites.append({
                        "site": "Various",
                        "url": url_match.group(0),
                        "status": "found"
                    })

        return {
            "username": username,
            "sites_checked": 2000,
            "sites_found": len(found_sites),
            "results": found_sites
        }
    except subprocess.TimeoutExpired:
        return {"error": "Deep search timed out", "username": username}
    except FileNotFoundError:
        return {"error": "Maigret not installed", "username": username, "results": []}
    except Exception as e:
        return {"error": str(e), "username": username, "results": []}

def run_holehe(email: str) -> dict:
    """Run holehe email discovery"""
    try:
        result = subprocess.run(
            ["holehe", email, "--only-used"],
            capture_output=True,
            text=True,
            timeout=60
        )

        services = []
        for line in result.stdout.split('\n'):
            if '[+]' in line:
                service_name = line.replace('[+]', '').strip().split()[0]
                services.append({
                    "service": service_name,
                    "email_registered": True
                })

        return {
            "email": email,
            "services_checked": 120,
            "services_found": len(services),
            "results": services
        }
    except subprocess.TimeoutExpired:
        return {"error": "Email search timed out", "email": email}
    except FileNotFoundError:
        return {"error": "holehe not installed", "email": email, "results": []}
    except Exception as e:
        return {"error": str(e), "email": email, "results": []}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            "status": "ok",
            "service": "Elite Recovery OSINT API",
            "endpoints": {
                "/api/osint?action=sherlock&username=X": "Username search (400+ sites)",
                "/api/osint?action=maigret&username=X": "Deep username search (2000+ sites)",
                "/api/osint?action=holehe&email=X": "Email account discovery (120+ services)",
                "/api/osint?action=sweep&username=X&email=Y": "Full OSINT sweep"
            }
        }
        self.wfile.write(json.dumps(response).encode())

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body) if body else {}
        except:
            data = {}

        # Parse query string
        if '?' in self.path:
            query_string = self.path.split('?')[1]
            params = parse_qs(query_string)
            for k, v in params.items():
                if k not in data:
                    data[k] = v[0]

        action = data.get('action', 'sweep')
        username = data.get('username')
        email = data.get('email')

        result = {"status": "error", "message": "Invalid request"}

        if action == 'sherlock' and username:
            result = run_sherlock(username)
        elif action == 'maigret' and username:
            result = run_maigret(username)
        elif action == 'holehe' and email:
            result = run_holehe(email)
        elif action == 'sweep':
            result = {
                "sweep_type": "full",
                "sherlock": run_sherlock(username) if username else None,
                "maigret": run_maigret(username) if username else None,
                "holehe": run_holehe(email) if email else None
            }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
