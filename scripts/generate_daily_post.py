#!/usr/bin/env python3
"""
Daily Cybersecurity Blog Post Generator & Google Drive Staging Engine
Author: Md Redwan Ahmed (blogs.redwan.work)
Zero-Touch Autonomous Execution via GitHub Actions
"""

import os
import sys
import json
import math
import random
import datetime
import base64
from typing import Dict, List, Tuple, Any

# Third-party dependencies
# pip install google-api-python-client google-auth pillow google-genai
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import io
from PIL import Image, ImageDraw, ImageFilter

# -----------------------------------------------------------------------------
# Configuration & IDs
# -----------------------------------------------------------------------------
ROOT_FOLDER_ID = os.environ.get("DRIVE_ROOT_FOLDER_ID", "1bJGScEpKr2iuP6nynxAW_lNScI_8I0jq")
QUEUE_FOLDER_ID = os.environ.get("DRIVE_QUEUE_FOLDER_ID", "17Il9OEUn3OluptlReqefnrn2DlfMmdbl")
SHEET_ID = os.environ.get("DRIVE_SHEET_ID", "1Pox6crGHIr0t8fR5iTR5CM-0e_OjAaOQ7VoKde9baro")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
SERVICE_ACCOUNT_RAW = os.environ.get("DRIVE_SERVICE_ACCOUNT_KEY", "")

# Domain Calendar
CALENDAR_MAP = {
    0: ("[AI Security]", "LLM Jailbreaking, Prompt Injections, Adversarial ML, Agentic Workflows"),
    1: ("[Cloud Security]", "AWS/GCP/Azure IAM Privilege Escalation, Kubernetes Policy Engine, Cloud Sandboxes"),
    2: ("[DevSecOps]", "CI/CD Pipeline Poisoning, Software Supply Chain (SLSA), Dependency Confusion Attacks"),
    3: ("[Penetration Testing]", "Active Directory Protocols, Kerberos/NTLM, AD CS Exploits, Web Application Security"),
    4: ("[Linux Hardening]", "Kernel Privilege Escalation, eBPF Tracing, Seccomp/AppArmor, Memory Safety"),
    5: ("[OSINT & Threat Intel]", "Threat Actor TTPs, Attribution Methodologies, Exploited In-The-Wild CVEs, CISA KEVs"),
    6: ("[Digital Forensics]", "Incident Response, Memory Dump Analysis, Windows/Linux Triage Artifacts, Anti-Forensics")
}

CATEGORY_PALETTES = {
    "[AI Security]": {
        "primary": (0, 212, 255),    # Electric Cyan
        "secondary": (168, 85, 247),  # Cyber Violet
        "accent": (236, 72, 153),    # Neon Magenta
        "bg_dark": (10, 14, 26)
    },
    "[Cloud Security]": {
        "primary": (0, 212, 255),    # Cyan
        "secondary": (37, 99, 235),   # Cobalt
        "accent": (14, 165, 233),    # Sky
        "bg_dark": (7, 12, 24)
    },
    "[DevSecOps]": {
        "primary": (0, 255, 136),    # Emerald
        "secondary": (13, 148, 136),  # Teal
        "accent": (56, 189, 248),    # Light Blue
        "bg_dark": (6, 16, 18)
    },
    "[Penetration Testing]": {
        "primary": (255, 176, 0),    # Signal Amber
        "secondary": (239, 68, 68),   # Crimson
        "accent": (245, 158, 11),   # Gold
        "bg_dark": (18, 10, 10)
    },
    "[Linux Hardening]": {
        "primary": (0, 255, 136),    # Emerald
        "secondary": (0, 212, 255),   # Cyan
        "accent": (52, 211, 153),   # Mint
        "bg_dark": (8, 18, 14)
    },
    "[OSINT & Threat Intel]": {
        "primary": (250, 204, 21),   # Neon Gold
        "secondary": (16, 185, 129),  # Green
        "accent": (249, 115, 22),   # Orange
        "bg_dark": (16, 14, 8)
    },
    "[Digital Forensics]": {
        "primary": (56, 189, 248),   # Ice Blue
        "secondary": (99, 102, 241),  # Indigo
        "accent": (224, 231, 255),  # Steel White
        "bg_dark": (10, 12, 22)
    }
}

# -----------------------------------------------------------------------------
# Google Authentication Helper
# -----------------------------------------------------------------------------
def get_service_account_credentials():
    if not SERVICE_ACCOUNT_RAW:
        raise ValueError("DRIVE_SERVICE_ACCOUNT_KEY environment variable is missing!")
    
    raw = SERVICE_ACCOUNT_RAW.strip()
    if not raw.startswith("{"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except Exception:
            pass
    
    info = json.loads(raw)
    scopes = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets"
    ]
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)

# -----------------------------------------------------------------------------
# 1. Inspect Google Sheet Topic History
# -----------------------------------------------------------------------------
def get_topic_history(creds) -> List[Dict[str, str]]:
    """Reads Content_Planner_and_History to retrieve previously covered topics."""
    try:
        sheets_service = build("sheets", "v4", credentials=creds)
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=SHEET_ID,
            range="A2:G200"
        ).execute()
        rows = result.get("values", [])
        
        history = []
        for r in rows:
            if len(r) >= 4:
                history.append({
                    "date": r[0] if len(r) > 0 else "",
                    "day": r[1] if len(r) > 1 else "",
                    "category": r[2] if len(r) > 2 else "",
                    "title": r[3] if len(r) > 3 else "",
                    "cve": r[4] if len(r) > 4 else "",
                    "tools": r[5] if len(r) > 5 else ""
                })
        return history
    except Exception as e:
        print(f"[!] Warning: Unable to read topic history from Google Sheets: {e}")
        return []

# -----------------------------------------------------------------------------
# 2. Gemini API Content Generation
# -----------------------------------------------------------------------------
def generate_article_with_gemini(category: str, theme_scope: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
    """Calls Gemini API to generate a structured, practitioner-grade cybersecurity article."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is required!")
    
    # Build list of previously covered topics to forbid repetition
    history_titles = [f"- {h.get('title')} ({h.get('cve', '')})" for h in history[-30:] if h.get('title')]
    history_str = "\n".join(history_titles) if history_titles else "No previous records found."

    system_instruction = f"""You are the Lead Cybersecurity Content Engineer & Research Specialist for blogs.redwan.work, authored under the authority of Md Redwan Ahmed.

AUTHOR IDENTITY:
Md Redwan Ahmed — Founder & CEO of Fast Cyber Defense, Cybersecurity Professional, ORCID: 0009-0001-9419-4760.

TODAY'S DOMAIN CATEGORY: {category}
DOMAIN SCOPE: {theme_scope}

RECENTLY COVERED TOPICS (STRICTLY FORBIDDEN FROM REPEATING):
{history_str}

REQUIREMENTS:
1. Select a NOVEL, high-impact, practitioner-grade topic within {category} that has NOT been covered above. Focus on authentic protocol mechanics, recent CVEs, or modern detection engineering.
2. Structure:
   - Deep-dive technical architecture (1,200 – 1,800 words).
   - Starts directly with level-2 heading: `## Technical Overview & Threat Model`.
   - Strictly NO byline, author, date, publication, or duplicate title at the top of the body.
   - Tone: Direct, analytical, battle-tested engineering notes with real-world gotchas.
   - Anti-AI Cliché: Strictly ban generic filler ("In today's fast-paced digital world", "delve into", "beacon of hope", "testament to", "double-edged sword").
3. Unified Code Blocks (MANDATORY):
   - Every script or rule MUST be enclosed in explicit triple backticks (```powershell, ```bash, ```yaml, ```python, ```c).
   - Entire script must be in ONE single continuous block. Never break a script into 1-line fragments with bullet points in between.
   - Zero empty code blocks.
4. Mermaid Diagrams:
   - Include 1 or 2 high-value Mermaid diagrams (`sequenceDiagram` with `autonumber` or `flowchart TD` / `graph TD`).
   - Clean, professional node labels without unescaped special characters.
5. Authoritative References:
   - 3 to 5 verified reference links (RFCs, NIST NVD, CVE details, Microsoft Learn, CISA).

OUTPUT FORMAT:
Respond with a strict, valid JSON object with these keys:
{{
  "title": "Clean, punchy technical article title without category tag",
  "category": "{category}",
  "focus_cve": "Specific CVE ID or RFC/Protocol Name (e.g. CVE-2024-XXXX or Kerberos RFC 4120)",
  "primary_tools": "Comma-separated list of tools/scripts used (e.g. PowerShell, Sigma, Hashcat)",
  "summary": "2-3 sentence executive summary of the technical topic",
  "markdown": "Complete GFM article body starting immediately with ## Technical Overview & Threat Model"
}}"""

    import urllib.request
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [
            {"parts": [{"text": "Generate today's complete daily technical cybersecurity article package matching all criteria in system instructions."}]}
        ],
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.4
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    with urllib.request.urlopen(req, timeout=120) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
    
    candidates = res_data.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Gemini API returned no candidates: {res_data}")
    
    raw_text = candidates[0]["content"]["parts"][0]["text"]
    return json.loads(raw_text)

# -----------------------------------------------------------------------------
# 3. High-Resolution Pillow Cyber Thumbnail Generator (1920x1080)
# -----------------------------------------------------------------------------
def generate_cyber_thumbnail(category: str, title: str, output_path: str):
    """Generates a high-impact 16:9 minimalist cyber-intel hero graphic without readable text."""
    width, height = 1920, 1080
    palette = CATEGORY_PALETTES.get(category, CATEGORY_PALETTES["[Linux Hardening]"])
    
    img = Image.new("RGB", (width, height), palette["bg_dark"])
    draw = ImageDraw.Draw(img)

    # 1. Base Gradient & Vignette
    for y in range(height):
        ratio = y / height
        r = int(palette["bg_dark"][0] * (1 - ratio * 0.7))
        g = int(palette["bg_dark"][1] * (1 - ratio * 0.7))
        b = int(palette["bg_dark"][2] * (1 - ratio * 0.7))
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # 2. Perspective 3D Cyber Horizon Grid
    horizon_y = int(height * 0.52)
    vanishing_x = width // 2
    
    # Horizontal grid lines with perspective compression
    for i in range(1, 24):
        p_ratio = (i / 24.0) ** 2.2
        grid_y = int(horizon_y + p_ratio * (height - horizon_y))
        alpha = int(40 + p_ratio * 160)
        line_col = tuple(min(255, int(c * (alpha / 255.0))) for c in palette["secondary"])
        draw.line([(0, grid_y), (width, grid_y)], fill=line_col, width=1)

    # Perspective perspective rays
    for angle_x in range(-width, width * 2, 70):
        alpha = random.randint(35, 110)
        ray_col = tuple(min(255, int(c * (alpha / 255.0))) for c in palette["primary"])
        draw.line([(vanishing_x, horizon_y), (angle_x, height)], fill=ray_col, width=1)

    # 3. Ambient Glow Layers
    glow_overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_overlay)

    # Center cryptographic aura
    center_x, center_y = width // 2, int(height * 0.45)
    for radius in range(320, 40, -25):
        alpha = int((1 - radius / 320.0) * 80)
        g_col = palette["primary"] + (alpha,)
        glow_draw.ellipse(
            [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
            fill=g_col
        )

    # 4. Concentric Hexagonal / Geometric Security Perimeter
    def draw_polygon_ring(cx, cy, radius, sides, color, width=2, rotate_offset=0):
        points = []
        for i in range(sides):
            a = (2 * math.pi / sides) * i + rotate_offset
            px = cx + radius * math.cos(a)
            py = cy + radius * math.sin(a)
            points.append((px, py))
        points.append(points[0])
        for j in range(len(points) - 1):
            glow_draw.line([points[j], points[j+1]], fill=color, width=width)

    # Perimeter rings
    draw_polygon_ring(center_x, center_y, 220, 6, palette["primary"] + (180,), width=3, rotate_offset=math.pi / 6)
    draw_polygon_ring(center_x, center_y, 180, 8, palette["secondary"] + (140,), width=2, rotate_offset=0)
    draw_polygon_ring(center_x, center_y, 130, 6, palette["accent"] + (200,), width=2, rotate_offset=math.pi / 3)

    # Center Cryptographic Shield / Vault Glyph
    shield_pts = [
        (center_x, center_y - 75),
        (center_x + 65, center_y - 40),
        (center_x + 55, center_y + 35),
        (center_x, center_y + 80),
        (center_x - 55, center_y + 35),
        (center_x - 65, center_y - 40),
        (center_x, center_y - 75)
    ]
    glow_draw.polygon(shield_pts, outline=palette["primary"] + (255,), fill=palette["bg_dark"] + (210,))
    
    # Internal lock core
    glow_draw.ellipse([center_x - 18, center_y - 22, center_x + 18, center_y + 14], outline=palette["accent"] + (240,), width=3)
    glow_draw.polygon([(center_x - 12, center_y + 8), (center_x + 12, center_y + 8), (center_x + 6, center_y + 35), (center_x - 6, center_y + 35)], fill=palette["accent"] + (240,))

    # 5. Circuit Traces & Bus Lines
    random.seed(title)
    for _ in range(28):
        start_x = random.choice([random.randint(40, 480), random.randint(width - 480, width - 40)])
        start_y = random.randint(80, height - 120)
        c_len = random.randint(80, 260)
        direction = random.choice([(c_len, 0), (0, c_len), (c_len // 2, c_len // 2), (-c_len // 2, c_len // 2)])
        end_x = start_x + direction[0]
        end_y = start_y + direction[1]
        
        c_alpha = random.randint(70, 180)
        c_col = random.choice([palette["primary"], palette["secondary"], palette["accent"]]) + (c_alpha,)
        glow_draw.line([(start_x, start_y), (end_x, end_y)], fill=c_col, width=2)
        # Node pulse terminal
        glow_draw.ellipse([end_x - 4, end_y - 4, end_x + 4, end_y + 4], fill=palette["primary"] + (230,))

    # Blend glow with base
    glow_blurred = glow_overlay.filter(ImageFilter.GaussianBlur(radius=2))
    img.paste(Image.alpha_composite(Image.new("RGBA", (width, height), (0,0,0,0)), glow_overlay), (0,0), glow_overlay)
    img.paste(glow_blurred, (0,0), glow_blurred)

    img.save(output_path, "PNG", optimize=True)
    print(f"[✓] High-res cyber thumbnail saved to: {output_path}")

# -----------------------------------------------------------------------------
# 4. Google Drive Stager & Google Sheets Logger
# -----------------------------------------------------------------------------
def stage_package_in_drive(creds, post_package: Dict[str, Any], thumbnail_path: str):
    """Creates [Category] Title folder in Blog_Queue, uploads article.md and thumbnail.png."""
    drive_service = build("drive", "v3", credentials=creds)
    sheets_service = build("sheets", "v4", credentials=creds)

    folder_name = f"{post_package['category']} {post_package['title']}"
    print(f"[*] Staging folder in Google Drive: '{folder_name}'...")

    # 1. Create subfolder inside Blog_Queue
    folder_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [QUEUE_FOLDER_ID]
    }
    folder = drive_service.files().create(
        body=folder_metadata,
        fields="id",
        supportsAllDrives=True
    ).execute()
    subfolder_id = folder.get("id")
    print(f"[✓] Created subfolder ID: {subfolder_id}")

    # 2. Upload article.md (True plain text / markdown)
    article_content = post_package["markdown"].encode("utf-8")
    article_metadata = {
        "name": "article.md",
        "parents": [subfolder_id]
    }
    media_body = MediaIoBaseUpload(io.BytesIO(article_content), mimetype="text/markdown", resumable=True)
    article_file = drive_service.files().create(
        body=article_metadata,
        media_body=media_body,
        fields="id",
        supportsAllDrives=True
    ).execute()
    print(f"[✓] Uploaded article.md (ID: {article_file.get('id')})")

    # 3. Upload thumbnail.png
    with open(thumbnail_path, "rb") as f:
        thumb_bytes = f.read()
    thumb_metadata = {
        "name": "thumbnail.png",
        "parents": [subfolder_id]
    }
    thumb_body = MediaIoBaseUpload(io.BytesIO(thumb_bytes), mimetype="image/png", resumable=True)
    thumb_file = drive_service.files().create(
        body=thumb_metadata,
        media_body=thumb_body,
        fields="id",
        supportsAllDrives=True
    ).execute()
    print(f"[✓] Uploaded thumbnail.png (ID: {thumb_file.get('id')})")

    # 4. Append row to Content_Planner_and_History
    today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    weekday_str = datetime.datetime.now(datetime.timezone.utc).strftime("%A")
    new_row = [
        today_str,
        weekday_str,
        post_package["category"],
        post_package["title"],
        post_package.get("focus_cve", "N/A"),
        post_package.get("primary_tools", "N/A"),
        "Queued"
    ]
    try:
        sheets_service.spreadsheets().values().append(
            spreadsheetId=SHEET_ID,
            range="A1",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": [new_row]}
        ).execute()
        print(f"[✓] Successfully logged new entry to Google Sheet registry ({post_package['title']})")
    except Exception as e:
        print(f"[!] Warning: Failed to append to Google Sheet: {e}")

# -----------------------------------------------------------------------------
# Main Execution Entrypoint
# -----------------------------------------------------------------------------
def main():
    print("=== Zero-Touch Autonomous Cybersecurity Post Generator ===")
    creds = get_service_account_credentials()

    # Determine domain category by weekday (or environment override)
    override_cat = os.environ.get("MANUAL_CATEGORY", "").strip()
    weekday = datetime.datetime.now(datetime.timezone.utc).weekday()
    category, theme_scope = CALENDAR_MAP[weekday]
    if override_cat:
        category = override_cat
        theme_scope = "Manual Trigger Override"

    print(f"[*] Selected Domain: {category} - {theme_scope}")

    # 1. Check Google Sheet history
    history = get_topic_history(creds)
    print(f"[*] Loaded {len(history)} historical posts from Google Sheet registry.")

    # 2. Call Gemini API
    print("[*] Generating technical article via Gemini API...")
    post_package = generate_article_with_gemini(category, theme_scope, history)
    print(f"[✓] Title: \"{post_package['title']}\"")
    print(f"[✓] Focus CVE/Standard: {post_package.get('focus_cve')}")
    print(f"[✓] Word count: ~{len(post_package['markdown'].split())} words")

    # 3. Generate Cyber Thumbnail
    scratch_thumb = os.path.join(os.getcwd(), "thumbnail.png")
    generate_cyber_thumbnail(category, post_package["title"], scratch_thumb)

    # 4. Stage in Google Drive & Update Registry
    stage_package_in_drive(creds, post_package, scratch_thumb)
    
    # Cleanup scratch
    if os.path.exists(scratch_thumb):
        os.remove(scratch_thumb)

    print("\n🎉 Staging Complete! Ready for immediate Blogger ingestion.")

if __name__ == "__main__":
    main()
