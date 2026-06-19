# THE WAY API Reference

## Base URL
All endpoints are relative to the application root: `/api`

## Authentication
All endpoints require a valid session (JWT cookie).

---

## 🔐 Auth

### POST /auth/login
Login with email and password.

**Request:**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Response:** Sets JWT cookie

### POST /auth/logout
Logout and clear session.

### GET /auth/me
Get current user info.

**Response:**
```json
{ "id": "...", "name": "...", "email": "...", "role": "coach" | "client" }
```

---

## 🍽️ Foods

### POST /foods/analyze
Analyze food photo with Claude Vision AI.

**Request:** FormData with `photo` file

**Response:**
```json
{
  "items": [
    { "name": "אורז", "estimated_weight_g": 150, "calories": 200, "protein_g": 4, "carbs_g": 45, "fat_g": 0.3 }
  ],
  "total_calories": 200,
  "photo_url": "",
  "notes": "..."
}
```

### GET /foods/meals
Get meals for past 35 days.

**Query params:** none

**Response:**
```json
{
  "meals": [
    { "id": "...", "total_calories": 600, "logged_at": "2026-06-20T14:30:00Z", "items": [...] }
  ],
  "today_calories": 1200,
  "goal_calories": 2000
}
```

### POST /foods/meals
Save a meal (logged by AI).

**Request:**
```json
{
  "items": [{ "name": "אורז", "calories": 200, "estimated_weight_g": 150 }],
  "total_calories": 200
}
```

**Response:**
```json
{ "id": "meal-uuid" }
```

---

## 👤 Users

### GET /users/weight
Get weight logs (past 90 days by default).

**Query params:** `days=90` (1-365)

**Response:**
```json
{
  "logs": [{ "id": "...", "weight_kg": 75.5, "logged_at": "..." }],
  "target": 70
}
```

### POST /users/weight
Log weight (with optional photo).

**Request:** FormData with `weight` (number)

### GET /users/goals
Get user goals.

**Query params:** `userId` (optional, for coach viewing client goals)

**Response:**
```json
{
  "target_weight_kg": 70,
  "daily_calories": 2000,
  "daily_water_ml": 2000
}
```

### POST /users/goals
Set/update goals.

**Request:**
```json
{
  "target_weight_kg": 70,
  "daily_calories": 2000,
  "daily_water_ml": 2000,
  "userId": "..." // only for coaches
}
```

### GET /users/clients
Get all clients (coach only).

**Response:**
```json
[{ "id": "...", "name": "שם", "email": "..." }]
```

### POST /users/clients
Add new client (coach only).

**Request:**
```json
{
  "name": "שם המתאמן",
  "email": "client@example.com",
  "password": "password123"
}
```

---

## 💧 Health

### POST /health/water
Log water intake.

**Request:**
```json
{ "amount_ml": 250 }
```

### GET /health/water
Get today's water intake.

**Response:**
```json
{
  "logs": [...],
  "total_ml": 1500,
  "goal_ml": 2000
}
```

### POST /health/steps
Upload health screenshot and extract steps (AI-powered).

**Request:** FormData with `screenshot` file

**Response:**
```json
{ "steps": 8500 }
```

### GET /health/steps
Get today's steps.

**Query params:** `type=leaderboard` (optional, for leaderboard view)

**Response:**
```json
{ "steps": 8500 }
```

---

## 🎯 Motivation

### GET /motivation/quotes
Get random quote.

**Query params:** `action=list` (optional, for all quotes)

**Response (single):**
```json
{ "id": "...", "text": "ציטוט", "author": "מחבר" }
```

**Response (list):**
```json
[
  { "id": "...", "text": "ציטוט", "author": "..." }
]
```

### POST /motivation/quotes
Add quote (coach only).

**Request:**
```json
{ "text": "ציטוט", "author": "מחבר" }
```

### DELETE /motivation/quotes
Remove quote (coach only).

**Request:**
```json
{ "quoteId": "quote-uuid" }
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message in Hebrew"
}
```

**Common status codes:**
- `400` - Bad request (validation failed)
- `401` - Not authenticated
- `403` - Permission denied
- `409` - Conflict (e.g., email already exists)
- `500` - Server error

---

## Rate Limiting
None currently. Feel free to add if needed.

## Versioning
This is v1 (implicit). Future versions would use `/api/v2/...`
