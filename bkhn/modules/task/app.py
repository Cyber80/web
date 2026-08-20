import os
import sqlite3
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from itsdangerous import URLSafeSerializer

load_dotenv()

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret-change-me")
SANDBOX_MODE = os.getenv("SANDBOX_MODE", "true").lower() == "true"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"{APP_BASE_URL}/auth/google/callback")
GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")
GOOGLE_ALLOWED_DOMAIN = os.getenv("GOOGLE_ALLOWED_DOMAIN", "")

DB = os.path.join(os.path.dirname(__file__), "workload.db")
serializer = URLSafeSerializer(SESSION_SECRET, salt="workload-session")

app = FastAPI(title="Workload Calendar Sandbox")
app.mount("/static", StaticFiles(directory="static"), name="static")


def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_sub TEXT UNIQUE,
        email TEXT NOT NULL,
        name TEXT,
        picture TEXT,
        refresh_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        location TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        calendar_id TEXT,
        external_event_id TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)
    conn.commit()
    conn.close()


init_db()


class WorkloadIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    start_at: str
    end_at: str
    location: str = ""
    visibility: str = "private"


def now():
    return datetime.now(timezone.utc).isoformat()


def set_session(response, user_id):
    token = serializer.dumps({"user_id": user_id})
    response.set_cookie("session", token, httponly=True, samesite="lax", secure=False, max_age=86400 * 7)


def get_user(request: Request):
    token = request.cookies.get("session")
    if not token:
        return None
    try:
        data = serializer.loads(token)
        conn = db()
        user = conn.execute("SELECT * FROM users WHERE id=?", (data["user_id"],)).fetchone()
        conn.close()
        return user
    except Exception:
        return None


def require_user(request: Request):
    user = get_user(request)
    if not user:
        raise HTTPException(401, "กรุณาเข้าสู่ระบบ")
    return user


@app.get("/", response_class=HTMLResponse)
def index():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.get("/api/me")
def me(request: Request):
    user = get_user(request)
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": dict(user)}


@app.get("/auth/google")
def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        if SANDBOX_MODE:
            conn = db()
            t = now()
            cur = conn.execute("""
                INSERT INTO users(google_sub,email,name,picture,created_at,updated_at)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(google_sub) DO UPDATE SET updated_at=excluded.updated_at
            """, ("sandbox-user", "sandbox@example.com", "Sandbox User", "", t, t))
            user_id = conn.execute("SELECT id FROM users WHERE google_sub='sandbox-user'").fetchone()["id"]
            conn.commit()
            conn.close()
            response = RedirectResponse("/")
            set_session(response, user_id)
            return response
        raise HTTPException(500, "ยังไม่ได้ตั้งค่า Google OAuth")

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/calendar.events",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    response = RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))
    response.set_cookie("oauth_state", state, httponly=True, samesite="lax", max_age=600)
    return response


@app.get("/auth/google/callback")
async def google_callback(request: Request, code: str = "", state: str = ""):
    if state != request.cookies.get("oauth_state"):
        raise HTTPException(400, "OAuth state ไม่ถูกต้อง")

    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        token_res.raise_for_status()
        tokens = token_res.json()

        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        user_res.raise_for_status()
        profile = user_res.json()

    email = profile.get("email", "")
    if GOOGLE_ALLOWED_DOMAIN and not email.endswith("@" + GOOGLE_ALLOWED_DOMAIN):
        raise HTTPException(403, "บัญชีนี้ไม่ได้รับอนุญาต")

    conn = db()
    t = now()
    conn.execute("""
        INSERT INTO users(google_sub,email,name,picture,refresh_token,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(google_sub) DO UPDATE SET
          email=excluded.email,
          name=excluded.name,
          picture=excluded.picture,
          refresh_token=COALESCE(excluded.refresh_token, users.refresh_token),
          updated_at=excluded.updated_at
    """, (
        profile["sub"], email, profile.get("name"), profile.get("picture"),
        tokens.get("refresh_token"), t, t
    ))
    user = conn.execute("SELECT * FROM users WHERE google_sub=?", (profile["sub"],)).fetchone()
    conn.commit()
    conn.close()

    response = RedirectResponse("/")
    set_session(response, user["id"])
    response.delete_cookie("oauth_state")
    return response


@app.get("/auth/logout")
def logout():
    response = RedirectResponse("/")
    response.delete_cookie("session")
    return response


@app.get("/api/workloads")
def list_workloads(request: Request):
    user = require_user(request)
    conn = db()
    rows = conn.execute("""
        SELECT * FROM workloads
        WHERE user_id=? OR visibility='public'
        ORDER BY start_at
    """, (user["id"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/workloads")
def create_workload(request: Request, payload: WorkloadIn):
    user = require_user(request)
    if payload.visibility not in ("private", "public"):
        raise HTTPException(400, "visibility ต้องเป็น private หรือ public")

    t = now()
    conn = db()
    cur = conn.execute("""
        INSERT INTO workloads
        (user_id,title,description,start_at,end_at,location,visibility,calendar_id,sync_status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
    """, (
        user["id"], payload.title, payload.description, payload.start_at, payload.end_at,
        payload.location, payload.visibility, GOOGLE_CALENDAR_ID, "pending", t, t
    ))
    row = conn.execute("SELECT * FROM workloads WHERE id=?", (cur.lastrowid,)).fetchone()
    conn.commit()
    conn.close()
    return dict(row)


@app.put("/api/workloads/{workload_id}")
def update_workload(request: Request, workload_id: int, payload: WorkloadIn):
    user = require_user(request)
    conn = db()
    old = conn.execute("SELECT * FROM workloads WHERE id=?", (workload_id,)).fetchone()
    if not old:
        conn.close()
        raise HTTPException(404, "ไม่พบภาระงาน")
    if old["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(403, "ไม่มีสิทธิ์แก้ไข")

    conn.execute("""
        UPDATE workloads SET title=?,description=?,start_at=?,end_at=?,location=?,
        visibility=?,sync_status=?,updated_at=? WHERE id=?
    """, (
        payload.title, payload.description, payload.start_at, payload.end_at,
        payload.location, payload.visibility, "pending", now(), workload_id
    ))
    row = conn.execute("SELECT * FROM workloads WHERE id=?", (workload_id,)).fetchone()
    conn.commit()
    conn.close()
    return dict(row)


@app.delete("/api/workloads/{workload_id}")
def delete_workload(request: Request, workload_id: int):
    user = require_user(request)
    conn = db()
    row = conn.execute("SELECT * FROM workloads WHERE id=?", (workload_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "ไม่พบภาระงาน")
    if row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(403, "ไม่มีสิทธิ์ลบ")

    if row["external_event_id"]:
        try:
            delete_google_event(user, row["calendar_id"], row["external_event_id"])
        except Exception:
            pass

    conn.execute("DELETE FROM workloads WHERE id=?", (workload_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


def google_service_for_user(user):
    # This sandbox uses stored refresh_token. A production implementation
    # should use google-auth Credentials and refresh the access token.
    if not user["refresh_token"]:
        raise HTTPException(400, "บัญชีนี้ยังไม่มี Google refresh token")
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=user["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=["https://www.googleapis.com/auth/calendar.events"],
    )
    creds.refresh(GoogleRequest())
    return build("calendar", "v3", credentials=creds)


def event_body(row):
    return {
        "summary": row["title"],
        "description": row["description"] or "",
        "location": row["location"] or "",
        "start": {"dateTime": row["start_at"], "timeZone": "Asia/Bangkok"},
        "end": {"dateTime": row["end_at"], "timeZone": "Asia/Bangkok"},
        "extendedProperties": {
            "private": {
                "workload_id": str(row["id"]),
                "source": "workload-calendar-sandbox"
            }
        }
    }


def delete_google_event(user, calendar_id, event_id):
    service = google_service_for_user(user)
    service.events().delete(calendarId=calendar_id, eventId=event_id).execute()


@app.post("/api/workloads/{workload_id}/sync")
def sync_workload(request: Request, workload_id: int):
    user = require_user(request)
    conn = db()
    row = conn.execute("SELECT * FROM workloads WHERE id=? AND user_id=?", (workload_id, user["id"])).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "ไม่พบภาระงาน")

    if not user["refresh_token"]:
        conn.close()
        raise HTTPException(400, "ต้อง Login ด้วย Google และอนุญาต Google Calendar ก่อนจึงจะ Sync ได้")

    service = google_service_for_user(user)
    body = event_body(row)
    calendar_id = row["calendar_id"] or GOOGLE_CALENDAR_ID

    try:
        if row["external_event_id"]:
            event = service.events().update(
                calendarId=calendar_id,
                eventId=row["external_event_id"],
                body=body
            ).execute()
        else:
            event = service.events().insert(
                calendarId=calendar_id,
                body=body
            ).execute()

        conn.execute("""
            UPDATE workloads SET external_event_id=?, sync_status=?, updated_at=? WHERE id=?
        """, (event["id"], "synced", now(), workload_id))
        conn.commit()
        return {"ok": True, "event_id": event["id"], "status": "synced"}
    except Exception as e:
        conn.execute("UPDATE workloads SET sync_status=? WHERE id=?", ("error", workload_id))
        conn.commit()
        raise HTTPException(500, f"Google Calendar sync failed: {e}")
    finally:
        conn.close()


@app.post("/api/sync-all")
def sync_all(request: Request):
    user = require_user(request)
    conn = db()
    ids = [r["id"] for r in conn.execute("SELECT id FROM workloads WHERE user_id=?", (user["id"],)).fetchall()]
    conn.close()
    results = []
    for wid in ids:
        try:
            results.append(sync_workload(request, wid))
        except HTTPException as e:
            results.append({"ok": False, "workload_id": wid, "error": e.detail})
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
