"""
Elite Recovery OSINT Backend
FastAPI service integrating Python OSINT tools:
- Sherlock: Username search across 400+ sites
- Maigret: Comprehensive username intelligence
- holehe: Email account discovery
- phoneinfoga: Phone number intelligence
- socialscan: Username/email availability
- h8mail: Email breach/leak checking
- theHarvester: Email/domain reconnaissance
- social-analyzer: Enhanced username search (1000+ sites)
- CourtListener API: Federal court records
"""

import asyncio
import json
import os
import subprocess
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import aiohttp
import httpx

# Initialize FastAPI
app = FastAPI(
    title="Elite Recovery OSINT API",
    description="Advanced OSINT intelligence gathering for fugitive recovery",
    version="1.0.0"
)

# CORS - allow all origins for the recovery app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for running CLI tools
executor = ThreadPoolExecutor(max_workers=10)


# ============================================================================
# MODELS
# ============================================================================

class UsernameSearchRequest(BaseModel):
    username: str
    timeout: int = 60


class UsernameSearchResult(BaseModel):
    username: str
    searched_at: str
    tool: str
    total_sites: int
    found: List[Dict[str, str]]
    not_found: List[str]
    errors: List[str]
    execution_time: float


class EmailSearchRequest(BaseModel):
    email: EmailStr
    timeout: int = 60


class EmailSearchResult(BaseModel):
    email: str
    searched_at: str
    tool: str
    registered_on: List[Dict[str, Any]]
    not_registered: List[str]
    execution_time: float


class PhoneSearchRequest(BaseModel):
    phone: str
    country_code: str = "US"


class PhoneSearchResult(BaseModel):
    phone: str
    searched_at: str
    carrier: Optional[str]
    line_type: Optional[str]
    location: Optional[Dict[str, str]]
    reputation: Optional[Dict[str, Any]]
    social_media: List[Dict[str, str]]
    execution_time: float


class FullSweepRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    state: Optional[str] = None


class FullSweepResult(BaseModel):
    target: Dict[str, Any]
    searched_at: str
    username_results: Optional[UsernameSearchResult] = None
    email_results: Optional[EmailSearchResult] = None
    phone_results: Optional[PhoneSearchResult] = None
    summary: str
    total_profiles_found: int
    execution_time: float


# ============================================================================
# SHERLOCK - Username Search
# ============================================================================

def run_sherlock(username: str, timeout: int = 60) -> Dict[str, Any]:
    """Run Sherlock CLI tool for username search"""
    start_time = datetime.now()
    found = []
    not_found = []
    errors = []

    try:
        # Create temp directory for output
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, f"{username}.json")

            # Run sherlock
            cmd = [
                "sherlock", username,
                "--json", output_file,
                "--timeout", str(timeout),
                "--print-found"
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 10
            )

            # Parse JSON output
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    data = json.load(f)

                for site, info in data.items():
                    if info.get('status') == 'Claimed':
                        found.append({
                            'platform': site,
                            'url': info.get('url_user', ''),
                            'response_time': info.get('response_time_s', 0)
                        })
                    elif info.get('status') == 'Available':
                        not_found.append(site)
                    else:
                        errors.append(f"{site}: {info.get('status', 'Unknown')}")

            # Also parse stdout for any additional findings
            if result.stdout:
                for line in result.stdout.split('\n'):
                    if '[+]' in line and 'http' in line:
                        # Extract URL from line
                        parts = line.split()
                        for part in parts:
                            if part.startswith('http'):
                                # Check if already in found
                                if not any(f['url'] == part for f in found):
                                    found.append({
                                        'platform': 'Unknown',
                                        'url': part,
                                        'response_time': 0
                                    })

    except subprocess.TimeoutExpired:
        errors.append("Search timed out")
    except FileNotFoundError:
        errors.append("Sherlock not installed. Run: pip install sherlock-project")
    except Exception as e:
        errors.append(f"Error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'username': username,
        'searched_at': datetime.now().isoformat(),
        'tool': 'sherlock',
        'total_sites': len(found) + len(not_found),
        'found': found,
        'not_found': not_found,
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/sherlock", response_model=UsernameSearchResult)
async def sherlock_search(request: UsernameSearchRequest):
    """Search username across 400+ sites using Sherlock"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_sherlock,
        request.username,
        request.timeout
    )
    return result


# ============================================================================
# MAIGRET - Comprehensive Username Search
# ============================================================================

def run_maigret(username: str, timeout: int = 120) -> Dict[str, Any]:
    """Run Maigret CLI tool for comprehensive username search"""
    start_time = datetime.now()
    found = []
    not_found = []
    errors = []

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, f"{username}.json")

            cmd = [
                "maigret", username,
                "--json", "simple",
                "-o", output_file,
                "--timeout", str(timeout),
                "--no-progressbar"
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30
            )

            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    data = json.load(f)

                # Maigret output structure
                if isinstance(data, dict):
                    for site, info in data.items():
                        if isinstance(info, dict):
                            if info.get('status') == 'Claimed' or info.get('exists'):
                                found.append({
                                    'platform': site,
                                    'url': info.get('url', info.get('url_user', '')),
                                    'tags': info.get('tags', []),
                                    'ids': info.get('ids', {})
                                })
                            else:
                                not_found.append(site)

    except subprocess.TimeoutExpired:
        errors.append("Search timed out")
    except FileNotFoundError:
        errors.append("Maigret not installed. Run: pip install maigret")
    except Exception as e:
        errors.append(f"Error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'username': username,
        'searched_at': datetime.now().isoformat(),
        'tool': 'maigret',
        'total_sites': len(found) + len(not_found),
        'found': found,
        'not_found': not_found[:50],  # Limit not_found to reduce payload
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/maigret", response_model=UsernameSearchResult)
async def maigret_search(request: UsernameSearchRequest):
    """Comprehensive username search using Maigret"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_maigret,
        request.username,
        request.timeout
    )
    return result


# ============================================================================
# HOLEHE - Email Account Discovery
# ============================================================================

def run_holehe(email: str, timeout: int = 60) -> Dict[str, Any]:
    """Run holehe to check email registration across services"""
    start_time = datetime.now()
    registered = []
    not_registered = []
    errors = []

    try:
        cmd = ["holehe", email, "--only-used", "-NP"]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        # Parse holehe output
        current_service = None
        for line in result.stdout.split('\n'):
            line = line.strip()
            if not line:
                continue

            # holehe outputs: [+] service: registered/rate-limited/etc
            if '[+]' in line:
                # Registered
                parts = line.replace('[+]', '').strip().split(':')
                if parts:
                    service = parts[0].strip()
                    registered.append({
                        'service': service,
                        'status': 'registered',
                        'details': ':'.join(parts[1:]).strip() if len(parts) > 1 else ''
                    })
            elif '[-]' in line:
                # Not registered
                parts = line.replace('[-]', '').strip().split(':')
                if parts:
                    not_registered.append(parts[0].strip())
            elif '[x]' in line:
                # Error/rate-limited
                parts = line.replace('[x]', '').strip().split(':')
                if parts:
                    errors.append(parts[0].strip())

    except subprocess.TimeoutExpired:
        errors.append("Search timed out")
    except FileNotFoundError:
        errors.append("holehe not installed. Run: pip install holehe")
    except Exception as e:
        errors.append(f"Error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'email': email,
        'searched_at': datetime.now().isoformat(),
        'tool': 'holehe',
        'registered_on': registered,
        'not_registered': not_registered[:20],
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/holehe", response_model=EmailSearchResult)
async def holehe_search(request: EmailSearchRequest):
    """Check email registration across services using holehe"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_holehe,
        request.email,
        request.timeout
    )
    return result


# ============================================================================
# SOCIALSCAN - Quick Username/Email Check
# ============================================================================

async def run_socialscan(query: str, query_type: str = "username") -> Dict[str, Any]:
    """Run socialscan for quick availability check"""
    start_time = datetime.now()
    results = []
    errors = []

    try:
        cmd = ["socialscan", query]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=30
        )

        output = stdout.decode()
        for line in output.split('\n'):
            if query in line:
                # Parse socialscan output format
                # Platform: Available/Taken
                parts = line.split(':')
                if len(parts) >= 2:
                    platform = parts[0].strip()
                    status = parts[1].strip().lower()
                    results.append({
                        'platform': platform,
                        'available': 'available' in status,
                        'taken': 'taken' in status or 'claimed' in status
                    })

    except asyncio.TimeoutError:
        errors.append("Search timed out")
    except FileNotFoundError:
        errors.append("socialscan not installed. Run: pip install socialscan")
    except Exception as e:
        errors.append(f"Error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'query': query,
        'type': query_type,
        'searched_at': datetime.now().isoformat(),
        'tool': 'socialscan',
        'results': results,
        'errors': errors,
        'execution_time': execution_time
    }


@app.get("/api/socialscan")
async def socialscan_check(
    query: str = Query(..., description="Username or email to check"),
    type: str = Query("username", description="Type: username or email")
):
    """Quick username/email availability check using socialscan"""
    return await run_socialscan(query, type)


# ============================================================================
# COMBINED USERNAME SEARCH
# ============================================================================

@app.post("/api/username/full")
async def full_username_search(request: UsernameSearchRequest):
    """Run both Sherlock and Maigret for comprehensive results"""
    loop = asyncio.get_event_loop()

    # Run both tools in parallel
    sherlock_task = loop.run_in_executor(
        executor, run_sherlock, request.username, request.timeout
    )
    maigret_task = loop.run_in_executor(
        executor, run_maigret, request.username, request.timeout
    )

    sherlock_result, maigret_result = await asyncio.gather(
        sherlock_task, maigret_task
    )

    # Merge results, deduplicate by URL
    all_found = {}
    for item in sherlock_result['found']:
        url = item.get('url', '')
        if url:
            all_found[url] = item

    for item in maigret_result['found']:
        url = item.get('url', '')
        if url and url not in all_found:
            all_found[url] = item

    return {
        'username': request.username,
        'searched_at': datetime.now().isoformat(),
        'sherlock': sherlock_result,
        'maigret': maigret_result,
        'combined': {
            'total_unique_profiles': len(all_found),
            'profiles': list(all_found.values())
        }
    }


# ============================================================================
# PHONE INTELLIGENCE (Basic - phoneinfoga integration placeholder)
# ============================================================================

@app.post("/api/phone", response_model=PhoneSearchResult)
async def phone_search(request: PhoneSearchRequest):
    """Phone number intelligence gathering"""
    start_time = datetime.now()

    # Basic phone analysis (phoneinfoga integration would go here)
    phone = request.phone.replace("-", "").replace(" ", "").replace("(", "").replace(")", "")

    # US area code database (subset)
    area_codes = {
        "212": {"city": "New York", "state": "NY"},
        "213": {"city": "Los Angeles", "state": "CA"},
        "312": {"city": "Chicago", "state": "IL"},
        "404": {"city": "Atlanta", "state": "GA"},
        "504": {"city": "New Orleans", "state": "LA"},
        "713": {"city": "Houston", "state": "TX"},
        "305": {"city": "Miami", "state": "FL"},
        "702": {"city": "Las Vegas", "state": "NV"},
        "206": {"city": "Seattle", "state": "WA"},
        "415": {"city": "San Francisco", "state": "CA"},
    }

    # Extract area code
    area_code = None
    location = None
    if phone.startswith("+1"):
        phone = phone[2:]
    if phone.startswith("1") and len(phone) == 11:
        phone = phone[1:]
    if len(phone) >= 10:
        area_code = phone[:3]
        location = area_codes.get(area_code, {"city": "Unknown", "state": "Unknown"})

    # Generate social media search links
    social_media = [
        {"platform": "Facebook", "url": f"https://www.facebook.com/search/top?q={phone}"},
        {"platform": "TrueCaller", "url": f"https://www.truecaller.com/search/us/{phone}"},
        {"platform": "Whitepages", "url": f"https://www.whitepages.com/phone/{phone}"},
        {"platform": "NumLookup", "url": f"https://www.numlookup.com/us/{phone}"},
    ]

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'phone': request.phone,
        'searched_at': datetime.now().isoformat(),
        'carrier': None,  # Would come from phoneinfoga
        'line_type': None,
        'location': location,
        'reputation': None,
        'social_media': social_media,
        'execution_time': execution_time
    }


# ============================================================================
# PHONEINFOGA - Advanced Phone Intelligence
# ============================================================================

class PhoneInfogaRequest(BaseModel):
    phone: str
    scanners: List[str] = ["local", "numverify", "googlesearch"]


class PhoneInfogaResult(BaseModel):
    phone: str
    searched_at: str
    raw_local: Optional[str] = None
    international: Optional[str] = None
    country: Optional[str] = None
    carrier: Optional[str] = None
    line_type: Optional[str] = None
    valid: bool = False
    possible_owner: Optional[str] = None
    social_results: List[Dict[str, Any]] = []
    dork_results: List[str] = []
    errors: List[str] = []
    execution_time: float


def run_phoneinfoga(phone: str, scanners: List[str] = None) -> Dict[str, Any]:
    """Run PhoneInfoga for phone number intelligence"""
    start_time = datetime.now()
    errors = []
    result_data = {
        'raw_local': None,
        'international': None,
        'country': None,
        'carrier': None,
        'line_type': None,
        'valid': False,
        'possible_owner': None,
        'social_results': [],
        'dork_results': []
    }

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "phoneinfoga_output.json")

            # Run phoneinfoga scan
            cmd = [
                "phoneinfoga", "scan",
                "-n", phone,
                "-o", output_file
            ]

            proc_result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=90
            )

            # Parse output
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    data = json.load(f)

                result_data['raw_local'] = data.get('rawLocal', phone)
                result_data['international'] = data.get('international', '')
                result_data['country'] = data.get('country', '')
                result_data['carrier'] = data.get('carrier', '')
                result_data['line_type'] = data.get('lineType', '')
                result_data['valid'] = data.get('valid', False)

                # Extract social media findings
                if 'googlesearch' in data:
                    for item in data.get('googlesearch', []):
                        result_data['social_results'].append({
                            'title': item.get('title', ''),
                            'url': item.get('url', ''),
                            'snippet': item.get('snippet', '')
                        })

            # Also parse stdout for any additional info
            if proc_result.stdout:
                for line in proc_result.stdout.split('\n'):
                    if 'Carrier:' in line:
                        result_data['carrier'] = line.split('Carrier:')[1].strip()
                    elif 'Country:' in line:
                        result_data['country'] = line.split('Country:')[1].strip()
                    elif 'Line type:' in line or 'LineType:' in line:
                        result_data['line_type'] = line.split(':')[1].strip()

            # Generate Google dorks for manual searching
            clean_phone = phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            result_data['dork_results'] = [
                f'"{clean_phone}"',
                f'"{phone}" site:facebook.com',
                f'"{phone}" site:linkedin.com',
                f'"{phone}" site:twitter.com',
                f'"{clean_phone}" intext:contact',
                f'"{clean_phone}" filetype:pdf',
            ]

    except subprocess.TimeoutExpired:
        errors.append("PhoneInfoga search timed out")
    except FileNotFoundError:
        errors.append("PhoneInfoga not installed. Run: go install github.com/sundowndev/phoneinfoga/v2/cmd/phoneinfoga@latest")
        # Fallback to basic analysis
        clean_phone = phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
        if clean_phone.startswith('+1'):
            clean_phone = clean_phone[2:]
        if len(clean_phone) == 11 and clean_phone.startswith('1'):
            clean_phone = clean_phone[1:]
        if len(clean_phone) == 10:
            result_data['country'] = 'US'
            result_data['valid'] = True
    except Exception as e:
        errors.append(f"PhoneInfoga error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'phone': phone,
        'searched_at': datetime.now().isoformat(),
        **result_data,
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/phoneinfoga", response_model=PhoneInfogaResult)
async def phoneinfoga_search(request: PhoneInfogaRequest):
    """Advanced phone number intelligence using PhoneInfoga"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_phoneinfoga,
        request.phone,
        request.scanners
    )
    return result


# ============================================================================
# H8MAIL - Email Breach/Leak Checking
# ============================================================================

class H8mailRequest(BaseModel):
    email: EmailStr
    chase_breaches: bool = True


class H8mailResult(BaseModel):
    email: str
    searched_at: str
    breaches_found: List[Dict[str, Any]]
    leaked_passwords: List[str]
    related_emails: List[str]
    total_breaches: int
    errors: List[str]
    execution_time: float


def run_h8mail(email: str, chase: bool = True) -> Dict[str, Any]:
    """Run h8mail to check for email in data breaches"""
    start_time = datetime.now()
    breaches = []
    leaked_passwords = []
    related_emails = []
    errors = []

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "h8mail_output.json")

            cmd = ["h8mail", "-t", email, "-j", output_file]
            if chase:
                cmd.append("-c")  # Chase related emails

            proc_result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            # Parse JSON output
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    data = json.load(f)

                for target in data.get('targets', []):
                    target_email = target.get('target', '')
                    if target_email != email:
                        related_emails.append(target_email)

                    for breach in target.get('data', []):
                        breaches.append({
                            'source': breach.get('source', 'Unknown'),
                            'breach_name': breach.get('breach', ''),
                            'data': breach.get('data', ''),
                            'date': breach.get('date', '')
                        })

                        # Check for leaked passwords
                        data_str = breach.get('data', '')
                        if ':' in data_str and '@' in data_str.split(':')[0]:
                            possible_password = data_str.split(':')[-1]
                            if possible_password and len(possible_password) > 3:
                                leaked_passwords.append(possible_password[:3] + '***')

            # Also parse stdout for additional findings
            if proc_result.stdout:
                for line in proc_result.stdout.split('\n'):
                    if '[+]' in line and 'breach' in line.lower():
                        breaches.append({
                            'source': 'h8mail_stdout',
                            'data': line.replace('[+]', '').strip()
                        })

    except subprocess.TimeoutExpired:
        errors.append("h8mail search timed out")
    except FileNotFoundError:
        errors.append("h8mail not installed. Run: pip install h8mail")
    except Exception as e:
        errors.append(f"h8mail error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'email': email,
        'searched_at': datetime.now().isoformat(),
        'breaches_found': breaches,
        'leaked_passwords': list(set(leaked_passwords)),
        'related_emails': list(set(related_emails)),
        'total_breaches': len(breaches),
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/h8mail", response_model=H8mailResult)
async def h8mail_search(request: H8mailRequest):
    """Check email for data breaches using h8mail"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_h8mail,
        request.email,
        request.chase_breaches
    )
    return result


# ============================================================================
# THEHARVESTER - Email/Domain Reconnaissance
# ============================================================================

class HarvesterRequest(BaseModel):
    domain: str
    sources: List[str] = ["google", "bing", "linkedin", "twitter"]
    limit: int = 100


class HarvesterResult(BaseModel):
    domain: str
    searched_at: str
    emails_found: List[str]
    hosts_found: List[str]
    ips_found: List[str]
    urls_found: List[str]
    people_found: List[str]
    total_results: int
    errors: List[str]
    execution_time: float


def run_theharvester(domain: str, sources: List[str] = None, limit: int = 100) -> Dict[str, Any]:
    """Run theHarvester for domain reconnaissance"""
    start_time = datetime.now()
    emails = []
    hosts = []
    ips = []
    urls = []
    people = []
    errors = []

    if not sources:
        sources = ["google", "bing", "linkedin"]

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "harvester_output.xml")

            for source in sources:
                cmd = [
                    "theHarvester",
                    "-d", domain,
                    "-b", source,
                    "-l", str(limit),
                    "-f", output_file
                ]

                proc_result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=90
                )

                # Parse stdout directly (more reliable than XML)
                if proc_result.stdout:
                    current_section = None
                    for line in proc_result.stdout.split('\n'):
                        line = line.strip()
                        if not line:
                            continue

                        if 'Emails found' in line or '[*] Emails' in line:
                            current_section = 'emails'
                        elif 'Hosts found' in line or '[*] Hosts' in line:
                            current_section = 'hosts'
                        elif 'IPs found' in line or '[*] IPs' in line:
                            current_section = 'ips'
                        elif 'URLs found' in line:
                            current_section = 'urls'
                        elif 'People found' in line or '[*] LinkedIn' in line:
                            current_section = 'people'
                        elif line.startswith('[*]') or line.startswith('[-]'):
                            current_section = None
                        elif current_section and not line.startswith('-'):
                            if current_section == 'emails' and '@' in line:
                                emails.append(line)
                            elif current_section == 'hosts':
                                hosts.append(line)
                            elif current_section == 'ips':
                                ips.append(line)
                            elif current_section == 'urls' and 'http' in line:
                                urls.append(line)
                            elif current_section == 'people' and line:
                                people.append(line)

    except subprocess.TimeoutExpired:
        errors.append("theHarvester search timed out")
    except FileNotFoundError:
        errors.append("theHarvester not installed. Run: pip install theHarvester")
    except Exception as e:
        errors.append(f"theHarvester error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    # Deduplicate results
    emails = list(set(emails))
    hosts = list(set(hosts))
    ips = list(set(ips))
    urls = list(set(urls))
    people = list(set(people))

    return {
        'domain': domain,
        'searched_at': datetime.now().isoformat(),
        'emails_found': emails,
        'hosts_found': hosts,
        'ips_found': ips,
        'urls_found': urls,
        'people_found': people,
        'total_results': len(emails) + len(hosts) + len(people),
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/harvester", response_model=HarvesterResult)
async def harvester_search(request: HarvesterRequest):
    """Domain reconnaissance using theHarvester"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_theharvester,
        request.domain,
        request.sources,
        request.limit
    )
    return result


# ============================================================================
# SOCIAL-ANALYZER - Enhanced Username Search (1000+ Sites)
# ============================================================================

class SocialAnalyzerRequest(BaseModel):
    username: str
    metadata: bool = True
    extract_links: bool = True
    timeout: int = 120


class SocialAnalyzerResult(BaseModel):
    username: str
    searched_at: str
    profiles_found: List[Dict[str, Any]]
    total_found: int
    metadata_extracted: Dict[str, Any]
    errors: List[str]
    execution_time: float


def run_social_analyzer(username: str, metadata: bool = True, timeout: int = 120) -> Dict[str, Any]:
    """Run social-analyzer for comprehensive username search (1000+ sites)"""
    start_time = datetime.now()
    profiles = []
    metadata_info = {}
    errors = []

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            output_file = os.path.join(tmpdir, "social_analyzer_output.json")

            cmd = [
                "social-analyzer",
                "--username", username,
                "--output", "json",
                "--trim"
            ]

            if metadata:
                cmd.append("--metadata")

            proc_result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30
            )

            # Parse stdout (social-analyzer outputs JSON to stdout)
            if proc_result.stdout:
                try:
                    # Find JSON in output
                    output = proc_result.stdout
                    json_start = output.find('{')
                    json_end = output.rfind('}') + 1
                    if json_start >= 0 and json_end > json_start:
                        data = json.loads(output[json_start:json_end])

                        # Extract detected profiles
                        detected = data.get('detected', [])
                        for profile in detected:
                            profiles.append({
                                'platform': profile.get('name', 'Unknown'),
                                'url': profile.get('url', ''),
                                'status': profile.get('status', ''),
                                'extracted_info': profile.get('extracted', {})
                            })

                        # Extract metadata
                        if 'metadata' in data:
                            metadata_info = data['metadata']

                except json.JSONDecodeError:
                    # Fallback: parse stdout line by line
                    for line in proc_result.stdout.split('\n'):
                        if 'http' in line and username.lower() in line.lower():
                            profiles.append({
                                'platform': 'Unknown',
                                'url': line.strip(),
                                'status': 'found'
                            })

    except subprocess.TimeoutExpired:
        errors.append("social-analyzer search timed out")
    except FileNotFoundError:
        errors.append("social-analyzer not installed. Run: pip install social-analyzer")
    except Exception as e:
        errors.append(f"social-analyzer error: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'username': username,
        'searched_at': datetime.now().isoformat(),
        'profiles_found': profiles,
        'total_found': len(profiles),
        'metadata_extracted': metadata_info,
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/social-analyzer", response_model=SocialAnalyzerResult)
async def social_analyzer_search(request: SocialAnalyzerRequest):
    """Comprehensive username search across 1000+ sites using social-analyzer"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        run_social_analyzer,
        request.username,
        request.metadata,
        request.timeout
    )
    return result


# ============================================================================
# COURTLISTENER API - Federal Court Records
# ============================================================================

COURTLISTENER_API_KEY = os.getenv("COURTLISTENER_API_KEY", "")

class CourtSearchRequest(BaseModel):
    name: str
    case_name: Optional[str] = None
    court: Optional[str] = None  # e.g., "scotus", "ca9", "laed"
    filed_after: Optional[str] = None  # YYYY-MM-DD
    filed_before: Optional[str] = None


class CourtSearchResult(BaseModel):
    query: str
    searched_at: str
    cases_found: List[Dict[str, Any]]
    people_found: List[Dict[str, Any]]
    total_results: int
    courtlistener_urls: List[str]
    errors: List[str]
    execution_time: float


async def search_courtlistener(name: str, case_name: str = None, court: str = None,
                               filed_after: str = None, filed_before: str = None) -> Dict[str, Any]:
    """Search CourtListener API for federal court records"""
    start_time = datetime.now()
    cases = []
    people = []
    courtlistener_urls = []
    errors = []

    base_url = "https://www.courtlistener.com/api/rest/v3"

    # Headers
    headers = {
        "Content-Type": "application/json"
    }
    if COURTLISTENER_API_KEY:
        headers["Authorization"] = f"Token {COURTLISTENER_API_KEY}"

    try:
        async with httpx.AsyncClient() as client:
            # Search for opinions/cases
            search_params = {
                "q": name,
                "type": "o",  # opinions
                "order_by": "dateFiled desc",
            }
            if case_name:
                search_params["case_name"] = case_name
            if court:
                search_params["court"] = court
            if filed_after:
                search_params["filed_after"] = filed_after
            if filed_before:
                search_params["filed_before"] = filed_before

            # Search opinions
            try:
                response = await client.get(
                    f"{base_url}/search/",
                    params=search_params,
                    headers=headers,
                    timeout=30.0
                )
                if response.status_code == 200:
                    data = response.json()
                    for result in data.get('results', [])[:20]:
                        cases.append({
                            'case_name': result.get('caseName', ''),
                            'court': result.get('court', ''),
                            'date_filed': result.get('dateFiled', ''),
                            'docket_number': result.get('docketNumber', ''),
                            'status': result.get('status', ''),
                            'url': f"https://www.courtlistener.com{result.get('absolute_url', '')}",
                            'snippet': result.get('snippet', '')[:300]
                        })
            except Exception as e:
                errors.append(f"Opinion search error: {str(e)}")

            # Search people (judges, attorneys)
            try:
                people_response = await client.get(
                    f"{base_url}/people/",
                    params={"name_full": name},
                    headers=headers,
                    timeout=30.0
                )
                if people_response.status_code == 200:
                    data = people_response.json()
                    for person in data.get('results', [])[:10]:
                        people.append({
                            'name': person.get('name_full', ''),
                            'born': person.get('date_dob', ''),
                            'positions': [p.get('position_type', '') for p in person.get('positions', [])],
                            'url': f"https://www.courtlistener.com{person.get('absolute_url', '')}"
                        })
            except Exception as e:
                errors.append(f"People search error: {str(e)}")

            # Search dockets
            try:
                docket_response = await client.get(
                    f"{base_url}/dockets/",
                    params={"case_name__icontains": name},
                    headers=headers,
                    timeout=30.0
                )
                if docket_response.status_code == 200:
                    data = docket_response.json()
                    for docket in data.get('results', [])[:10]:
                        if docket.get('absolute_url'):
                            courtlistener_urls.append(f"https://www.courtlistener.com{docket['absolute_url']}")
            except Exception as e:
                errors.append(f"Docket search error: {str(e)}")

    except Exception as e:
        errors.append(f"CourtListener API error: {str(e)}")

    # Generate manual search URLs
    encoded_name = name.replace(' ', '+')
    courtlistener_urls.extend([
        f"https://www.courtlistener.com/?q={encoded_name}&type=o",
        f"https://www.courtlistener.com/?q={encoded_name}&type=r",
        f"https://www.courtlistener.com/?q={encoded_name}&type=p"
    ])

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'query': name,
        'searched_at': datetime.now().isoformat(),
        'cases_found': cases,
        'people_found': people,
        'total_results': len(cases) + len(people),
        'courtlistener_urls': list(set(courtlistener_urls)),
        'errors': errors,
        'execution_time': execution_time
    }


@app.post("/api/court-records", response_model=CourtSearchResult)
async def court_search(request: CourtSearchRequest):
    """Search federal court records using CourtListener API"""
    result = await search_courtlistener(
        request.name,
        request.case_name,
        request.court,
        request.filed_after,
        request.filed_before
    )
    return result


# ============================================================================
# STATE COURT RECORDS - Links Generator
# ============================================================================

class StateCourtRequest(BaseModel):
    name: str
    state: str  # 2-letter state code


@app.post("/api/state-courts")
async def state_court_links(request: StateCourtRequest):
    """Generate links to search state court records"""
    name = request.name.replace(' ', '+')
    state = request.state.upper()

    # State court system URLs
    state_courts = {
        "LA": {
            "name": "Louisiana",
            "supreme_court": f"https://www.lasc.org/search?q={name}",
            "district_courts": f"https://www.laed.uscourts.gov/search/node/{name}",
            "case_search": "https://www.lacourt.org/",
            "offender_search": f"https://www.doc.la.gov/offender-search?name={name}"
        },
        "TX": {
            "name": "Texas",
            "courts_online": f"https://search.txcourts.gov/CaseSearch.aspx?coa=cossup&s={name}",
            "offender_search": f"https://offender.tdcj.texas.gov/OffenderSearch/search.action?lastName={name.split('+')[-1]}"
        },
        "FL": {
            "name": "Florida",
            "clerk_search": "https://www.myfloridacounty.com/",
            "offender_search": f"https://www.dc.state.fl.us/offenderSearch/search.aspx?TypeSearch=IR&LastName={name.split('+')[-1]}"
        },
        "CA": {
            "name": "California",
            "courts": "https://www.courts.ca.gov/find-my-court.htm",
            "cdcr_search": f"https://inmatelocator.cdcr.ca.gov/search.aspx"
        },
        "GA": {
            "name": "Georgia",
            "courts": f"https://www.gasupreme.us/search/?q={name}",
            "offender_search": f"https://gdc.ga.gov/GDC/Offender/Query"
        },
        "NY": {
            "name": "New York",
            "ecourts": f"https://iapps.courts.state.ny.us/webcrim_attorney/AttorneyWelcome",
            "doccs_search": f"https://nysdoccslookup.doccs.ny.gov/"
        },
        "AL": {
            "name": "Alabama",
            "alacourt": "https://pa.alacourt.com/",
            "doc_search": f"https://www.doc.alabama.gov/InmateSearch"
        },
        "MS": {
            "name": "Mississippi",
            "courts": f"https://courts.ms.gov/",
            "doc_search": f"https://www.mdoc.ms.gov/Inmate-Search"
        }
    }

    # Get state-specific links or generate generic
    if state in state_courts:
        return {
            "name": request.name,
            "state": state,
            "searched_at": datetime.now().isoformat(),
            "court_links": state_courts[state],
            "federal_links": {
                "pacer": f"https://pacer.uscourts.gov/",
                "courtlistener": f"https://www.courtlistener.com/?q={name}"
            }
        }
    else:
        return {
            "name": request.name,
            "state": state,
            "searched_at": datetime.now().isoformat(),
            "court_links": {
                "notice": f"State-specific links not available for {state}",
                "generic_search": f"Search '{state} court records {request.name}' on Google"
            },
            "federal_links": {
                "pacer": f"https://pacer.uscourts.gov/",
                "courtlistener": f"https://www.courtlistener.com/?q={name}"
            }
        }


# ============================================================================
# MULTI-USERNAME SEARCH (searches variations)
# ============================================================================

class MultiUsernameRequest(BaseModel):
    name: str
    usernames: Optional[List[str]] = None  # If not provided, will generate from name
    max_usernames: int = 5
    timeout: int = 30


def generate_username_variations(full_name: str) -> List[str]:
    """Generate common username variations from a name"""
    parts = full_name.lower().split()
    if len(parts) < 2:
        return [full_name.lower().replace(" ", "")]

    first = parts[0]
    last = parts[-1]
    middle = parts[1] if len(parts) > 2 else ""
    first_initial = first[0] if first else ""
    last_initial = last[0] if last else ""

    variations = [
        f"{first}{last}",           # amandadriskell
        f"{first}_{last}",          # amanda_driskell
        f"{first}.{last}",          # amanda.driskell
        f"{first}-{last}",          # amanda-driskell
        f"{last}{first}",           # driskellamanda
        f"{first_initial}{last}",   # adriskell
        f"{first}{last_initial}",   # amandad
        f"{first}_{last_initial}",  # amanda_d
        f"{last}_{first}",          # driskell_amanda
        f"{first}{last}1",          # amandadriskell1
        f"{first}{last}123",        # amandadriskell123
        f"real{first}{last}",       # realamandadriskell
        f"the{first}{last}",        # theamandadriskell
        f"{first}official",         # amandaofficial
    ]

    if middle:
        variations.extend([
            f"{first}{middle[0]}{last}",   # amandajdriskell
            f"{first}_{middle[0]}_{last}", # amanda_j_driskell
        ])

    # Remove duplicates and filter
    return list(dict.fromkeys([v for v in variations if len(v) > 2]))


@app.post("/api/multi-username")
async def multi_username_search(request: MultiUsernameRequest):
    """Search multiple username variations using Sherlock"""
    start_time = datetime.now()

    # Generate usernames if not provided
    usernames = request.usernames
    if not usernames:
        usernames = generate_username_variations(request.name)

    # Limit to max_usernames
    usernames = usernames[:request.max_usernames]

    all_found = {}  # Dedupe by URL
    all_errors = []
    searched_usernames = []

    loop = asyncio.get_event_loop()

    # Search each username
    for username in usernames:
        searched_usernames.append(username)
        try:
            result = await loop.run_in_executor(
                executor,
                run_sherlock,
                username,
                request.timeout
            )

            for item in result.get('found', []):
                url = item.get('url', '')
                if url and url not in all_found:
                    all_found[url] = {
                        **item,
                        'searched_username': username
                    }

            all_errors.extend([f"{username}: {e}" for e in result.get('errors', [])])

        except Exception as e:
            all_errors.append(f"{username}: {str(e)}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'name': request.name,
        'searched_at': datetime.now().isoformat(),
        'usernames_searched': searched_usernames,
        'total_profiles_found': len(all_found),
        'profiles': list(all_found.values()),
        'errors': all_errors[:20],  # Limit errors
        'execution_time': execution_time
    }


# ============================================================================
# FULL OSINT SWEEP
# ============================================================================

@app.post("/api/sweep", response_model=FullSweepResult)
async def full_osint_sweep(request: FullSweepRequest):
    """Complete OSINT sweep on a target"""
    start_time = datetime.now()

    # Generate username from name if not provided
    username = request.username
    if not username and request.name:
        username = request.name.lower().replace(" ", "")

    tasks = []
    results = {
        'username_results': None,
        'email_results': None,
        'phone_results': None
    }

    loop = asyncio.get_event_loop()

    # Username search
    if username:
        async def search_username():
            result = await loop.run_in_executor(
                executor, run_sherlock, username, 60
            )
            results['username_results'] = result
        tasks.append(search_username())

    # Email search
    if request.email:
        async def search_email():
            result = await loop.run_in_executor(
                executor, run_holehe, request.email, 60
            )
            results['email_results'] = result
        tasks.append(search_email())

    # Phone search
    if request.phone:
        async def search_phone():
            result = await phone_search(PhoneSearchRequest(phone=request.phone))
            results['phone_results'] = result
        tasks.append(search_phone())

    # Run all tasks
    if tasks:
        await asyncio.gather(*tasks)

    # Calculate totals
    total_profiles = 0
    if results['username_results']:
        total_profiles += len(results['username_results'].get('found', []))
    if results['email_results']:
        total_profiles += len(results['email_results'].get('registered_on', []))

    # Generate summary
    summary_parts = []
    if results['username_results']:
        found = len(results['username_results'].get('found', []))
        summary_parts.append(f"Found {found} social profiles for @{username}")
    if results['email_results']:
        registered = len(results['email_results'].get('registered_on', []))
        summary_parts.append(f"Email registered on {registered} services")
    if results['phone_results'] and results['phone_results'].get('location'):
        loc = results['phone_results']['location']
        summary_parts.append(f"Phone from {loc.get('city', 'Unknown')}, {loc.get('state', 'Unknown')}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        'target': {
            'name': request.name,
            'email': request.email,
            'phone': request.phone,
            'username': username,
            'state': request.state
        },
        'searched_at': datetime.now().isoformat(),
        'username_results': results['username_results'],
        'email_results': results['email_results'],
        'phone_results': results['phone_results'],
        'summary': ' | '.join(summary_parts) if summary_parts else 'No results found',
        'total_profiles_found': total_profiles,
        'execution_time': execution_time
    }


# ============================================================================
# INTELLIGENT PERSON INVESTIGATION (Smart Flow)
# ============================================================================

class InvestigatePersonRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None  # State/city to narrow down


class InvestigatePersonResult(BaseModel):
    name: str
    searched_at: str
    flow_steps: List[Dict[str, Any]]
    discovered_emails: List[str]
    discovered_usernames: List[str]
    confirmed_profiles: List[Dict[str, str]]
    people_search_links: List[Dict[str, str]]
    summary: str
    execution_time: float


@app.post("/api/investigate", response_model=InvestigatePersonResult)
async def investigate_person(request: InvestigatePersonRequest):
    """
    Intelligent person investigation flow:
    1. Generate people search links
    2. If email provided, check registrations with holehe
    3. Try username variations with Sherlock
    4. Compile all findings
    """
    start_time = datetime.now()
    flow_steps = []
    discovered_emails = []
    discovered_usernames = []
    confirmed_profiles = []

    # Parse name
    name_parts = request.name.lower().split()
    first = name_parts[0] if name_parts else ""
    last = name_parts[-1] if len(name_parts) > 1 else name_parts[0] if name_parts else ""

    # Step 1: Generate people search links
    flow_steps.append({
        "step": 1,
        "action": "Generate people search links",
        "status": "running"
    })

    people_search_links = [
        {"name": "TruePeopleSearch", "url": f"https://www.truepeoplesearch.com/results?name={request.name.replace(' ', '%20')}", "type": "free"},
        {"name": "FastPeopleSearch", "url": f"https://www.fastpeoplesearch.com/name/{request.name.replace(' ', '-')}", "type": "free"},
        {"name": "Whitepages", "url": f"https://www.whitepages.com/name/{first}-{last}", "type": "free"},
        {"name": "Spokeo", "url": f"https://www.spokeo.com/{first}-{last}", "type": "paid"},
        {"name": "BeenVerified", "url": f"https://www.beenverified.com/people/{first}-{last}/", "type": "paid"},
        {"name": "Intelius", "url": f"https://www.intelius.com/people-search/{first}-{last}/", "type": "paid"},
        {"name": "ThatsThem", "url": f"https://thatsthem.com/name/{first}-{last}", "type": "free"},
        {"name": "USSearch", "url": f"https://www.ussearch.com/search/results/people?firstName={first}&lastName={last}", "type": "paid"},
        {"name": "Facebook", "url": f"https://www.facebook.com/search/people?q={request.name.replace(' ', '%20')}", "type": "social"},
        {"name": "LinkedIn", "url": f"https://www.linkedin.com/search/results/people/?keywords={request.name.replace(' ', '%20')}", "type": "social"},
        {"name": "Instagram", "url": f"https://www.instagram.com/{first}{last}/", "type": "social"},
        {"name": "Twitter/X", "url": f"https://twitter.com/search?q={request.name.replace(' ', '%20')}&f=user", "type": "social"},
    ]

    if request.location:
        loc = request.location.replace(' ', '%20')
        people_search_links.extend([
            {"name": "TruePeopleSearch (Location)", "url": f"https://www.truepeoplesearch.com/results?name={request.name.replace(' ', '%20')}&citystatezip={loc}", "type": "free"},
            {"name": "Whitepages (Location)", "url": f"https://www.whitepages.com/name/{first}-{last}/{loc}", "type": "free"},
        ])

    flow_steps[-1]["status"] = "complete"
    flow_steps[-1]["result"] = f"Generated {len(people_search_links)} search links"

    # Step 2: If email provided, check with holehe
    if request.email:
        flow_steps.append({
            "step": 2,
            "action": f"Check email registration: {request.email}",
            "status": "running"
        })

        discovered_emails.append(request.email)

        try:
            loop = asyncio.get_event_loop()
            email_result = await loop.run_in_executor(
                executor, run_holehe, request.email, 60
            )

            registered_services = email_result.get('registered_on', [])
            for service in registered_services:
                confirmed_profiles.append({
                    "platform": service.get('service', 'Unknown'),
                    "source": "holehe (email)",
                    "email": request.email,
                    "url": f"https://{service.get('service', '').lower().replace(' ', '')}.com"
                })

            flow_steps[-1]["status"] = "complete"
            flow_steps[-1]["result"] = f"Found {len(registered_services)} services"

        except Exception as e:
            flow_steps[-1]["status"] = "error"
            flow_steps[-1]["result"] = str(e)

    # Step 3: Try common username variations with Sherlock
    flow_steps.append({
        "step": 3,
        "action": "Search username variations with Sherlock",
        "status": "running"
    })

    # Generate smart username variations
    username_variations = generate_username_variations(request.name)[:5]  # Top 5
    discovered_usernames.extend(username_variations)

    loop = asyncio.get_event_loop()
    all_sherlock_found = {}

    for username in username_variations:
        try:
            result = await loop.run_in_executor(
                executor, run_sherlock, username, 30
            )

            for profile in result.get('found', []):
                url = profile.get('url', '')
                if url and url not in all_sherlock_found:
                    all_sherlock_found[url] = {
                        "platform": profile.get('platform', 'Unknown'),
                        "url": url,
                        "username": username,
                        "source": "sherlock"
                    }
                    confirmed_profiles.append(all_sherlock_found[url])

        except Exception as e:
            pass  # Continue with other usernames

    flow_steps[-1]["status"] = "complete"
    flow_steps[-1]["result"] = f"Searched {len(username_variations)} usernames, found {len(all_sherlock_found)} profiles"

    # Build summary
    summary_parts = [
        f"Investigated: {request.name}",
        f"Search links: {len(people_search_links)}",
        f"Usernames tried: {', '.join(username_variations[:3])}...",
        f"Confirmed profiles: {len(confirmed_profiles)}"
    ]

    if request.email:
        summary_parts.insert(1, f"Email checked: {request.email}")

    execution_time = (datetime.now() - start_time).total_seconds()

    return {
        "name": request.name,
        "searched_at": datetime.now().isoformat(),
        "flow_steps": flow_steps,
        "discovered_emails": discovered_emails,
        "discovered_usernames": discovered_usernames,
        "confirmed_profiles": confirmed_profiles,
        "people_search_links": people_search_links,
        "summary": " | ".join(summary_parts),
        "execution_time": execution_time
    }


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check which tools are available
    tools = {}

    # Python-based tools
    python_tools = ['sherlock', 'maigret', 'holehe', 'socialscan', 'h8mail', 'theHarvester', 'social-analyzer']
    for tool in python_tools:
        try:
            result = subprocess.run(
                [tool, '--version'],
                capture_output=True,
                timeout=5
            )
            tools[tool] = 'installed'
        except FileNotFoundError:
            tools[tool] = 'not installed'
        except Exception as e:
            tools[tool] = f'error: {str(e)}'

    # Go-based tools (phoneinfoga)
    try:
        result = subprocess.run(
            ['phoneinfoga', 'version'],
            capture_output=True,
            timeout=5
        )
        tools['phoneinfoga'] = 'installed'
    except FileNotFoundError:
        tools['phoneinfoga'] = 'not installed'
    except Exception as e:
        tools['phoneinfoga'] = f'error: {str(e)}'

    # API-based services
    tools['courtlistener_api'] = 'configured' if COURTLISTENER_API_KEY else 'no api key (limited)'
    tools['openai_api'] = 'configured' if OPENAI_API_KEY else 'not configured'

    return {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'tools': tools,
        'version': '2.0.0'
    }


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        'name': 'Elite Recovery OSINT API',
        'version': '2.0.0',
        'endpoints': {
            # Username searches
            '/api/sherlock': 'Username search (400+ sites)',
            '/api/maigret': 'Comprehensive username search',
            '/api/social-analyzer': 'Enhanced username search (1000+ sites)',
            '/api/socialscan': 'Quick username/email check',
            '/api/username/full': 'Combined username search (Sherlock + Maigret)',
            '/api/multi-username': 'Search multiple username variations',
            # Email searches
            '/api/holehe': 'Email account discovery',
            '/api/h8mail': 'Email breach/leak checking',
            '/api/harvester': 'Domain reconnaissance (emails, hosts, people)',
            # Phone searches
            '/api/phone': 'Basic phone intelligence',
            '/api/phoneinfoga': 'Advanced phone OSINT',
            # Court records
            '/api/court-records': 'Federal court records (CourtListener)',
            '/api/state-courts': 'State court record links',
            # Combined searches
            '/api/investigate': 'INTELLIGENT person investigation (smart flow)',
            '/api/sweep': 'Full OSINT sweep',
            # AI services
            '/api/ai/chat': 'AI chat completion (OpenAI proxy)',
            '/api/ai/analyze': 'AI image/document analysis',
            '/api/ai/brief': 'Generate recovery brief',
            # Utility
            '/api/image/upload': 'Temp image hosting for reverse image search',
            '/health': 'Health check'
        }
    }


# ============================================================================
# AI PROXY (OpenAI) - Keeps API key server-side
# ============================================================================

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: str = "gpt-4o-mini"
    max_tokens: int = 2000


class AnalyzeRequest(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    prompt: str
    model: str = "gpt-4o"


class BriefRequest(BaseModel):
    subject_name: str
    known_addresses: List[str] = []
    known_associates: List[str] = []
    vehicle_info: Optional[str] = None
    social_profiles: List[Dict[str, str]] = []
    notes: Optional[str] = None


@app.post("/api/ai/chat")
async def ai_chat(request: ChatRequest):
    """OpenAI chat completion proxy - keeps API key server-side"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on server")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": request.model,
                "messages": request.messages,
                "max_tokens": request.max_tokens
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        return response.json()


@app.post("/api/ai/analyze")
async def ai_analyze(request: AnalyzeRequest):
    """Analyze image or document with GPT-4 Vision"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on server")

    # Build message content
    content = [{"type": "text", "text": request.prompt}]

    if request.image_base64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{request.image_base64}"}
        })
    elif request.image_url:
        content.append({
            "type": "image_url",
            "image_url": {"url": request.image_url}
        })

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": request.model,
                "messages": [{"role": "user", "content": content}],
                "max_tokens": 4000
            },
            timeout=120.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        return response.json()


@app.post("/api/ai/brief")
async def generate_brief(request: BriefRequest):
    """Generate AI-powered recovery brief"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on server")

    # Build context for the AI
    context = f"""Generate a professional fugitive recovery brief for field agents.

SUBJECT: {request.subject_name}

KNOWN ADDRESSES:
{chr(10).join(f'- {addr}' for addr in request.known_addresses) if request.known_addresses else 'None on file'}

KNOWN ASSOCIATES:
{chr(10).join(f'- {assoc}' for assoc in request.known_associates) if request.known_associates else 'None on file'}

VEHICLE INFORMATION:
{request.vehicle_info or 'None on file'}

SOCIAL MEDIA PROFILES:
{chr(10).join(f'- {p.get("platform", "Unknown")}: {p.get("url", "")}' for p in request.social_profiles) if request.social_profiles else 'None found'}

ADDITIONAL NOTES:
{request.notes or 'None'}

Please provide:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. RECOMMENDED APPROACH (tactical advice for field agents)
3. LOCATIONS TO CHECK (prioritized list based on available info)
4. TIMING RECOMMENDATIONS (best times to attempt contact/apprehension)
5. SAFETY CONSIDERATIONS (risk assessment)
6. BACKUP PLANS (alternative approaches if primary fails)

Be concise, professional, and actionable. This is for licensed bail enforcement agents."""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are an expert fugitive recovery consultant helping licensed bail enforcement agents. Provide tactical, professional advice."},
                    {"role": "user", "content": context}
                ],
                "max_tokens": 2000
            },
            timeout=60.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        result = response.json()
        brief_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

        return {
            "subject": request.subject_name,
            "generated_at": datetime.now().isoformat(),
            "brief": brief_text,
            "model": "gpt-4o-mini"
        }


# ============================================================================
# TEMPORARY IMAGE HOSTING (for reverse image search)
# ============================================================================

import uuid
import base64
from fastapi.responses import Response

# In-memory image store with expiration (images expire after 10 minutes)
temp_images: Dict[str, Dict[str, Any]] = {}

class ImageUploadRequest(BaseModel):
    image_base64: str


@app.post("/api/image/upload")
async def upload_temp_image(request: ImageUploadRequest):
    """
    Upload image temporarily for reverse image search.
    Returns a public URL that expires after 10 minutes.
    """
    # Clean expired images
    current_time = datetime.now()
    expired = [k for k, v in temp_images.items()
               if (current_time - v['uploaded_at']).seconds > 600]
    for k in expired:
        del temp_images[k]

    # Generate unique ID
    image_id = str(uuid.uuid4())[:8]

    # Store image
    temp_images[image_id] = {
        'data': request.image_base64,
        'uploaded_at': current_time
    }

    # Return public URL
    base_url = os.getenv('RENDER_EXTERNAL_URL', 'https://elite-recovery-osint.onrender.com')
    image_url = f"{base_url}/api/image/{image_id}"

    return {
        'image_id': image_id,
        'url': image_url,
        'expires_in': 600,
        'search_urls': {
            'google_lens': f"https://lens.google.com/uploadbyurl?url={image_url}",
            'yandex': f"https://yandex.com/images/search?rpt=imageview&url={image_url}",
            'bing': f"https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:{image_url}",
            'tineye': f"https://tineye.com/search?url={image_url}",
        }
    }


@app.get("/api/image/{image_id}")
async def get_temp_image(image_id: str):
    """Serve temporarily hosted image"""
    if image_id not in temp_images:
        raise HTTPException(status_code=404, detail="Image not found or expired")

    image_data = temp_images[image_id]['data']

    # Remove data URL prefix if present
    if 'base64,' in image_data:
        image_data = image_data.split('base64,')[1]

    # Decode base64
    try:
        image_bytes = base64.b64decode(image_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # Determine content type (assume JPEG for now)
    content_type = "image/jpeg"
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        content_type = "image/png"
    elif image_bytes[:4] == b'GIF8':
        content_type = "image/gif"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        content_type = "image/webp"

    return Response(content=image_bytes, media_type=content_type)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
