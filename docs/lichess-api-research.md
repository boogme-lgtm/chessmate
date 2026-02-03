# Lichess Puzzle API Research

## Key Findings

**API Endpoint:** `GET /api/puzzle/next`
- URL: `https://lichess.org/api/puzzle/next`
- Returns a random Lichess puzzle in JSON format
- **No authentication required** for anonymous access
- If authenticated, only returns puzzles the user hasn't seen before

**Important Note:**
> DO NOT use this endpoint to enumerate puzzles or mass download. Instead, download the full public puzzle database.

## Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `angle` | string | The theme or opening to filter puzzles (optional) |
| `difficulty` | string enum | Puzzle difficulty: `easiest`, `easier`, `normal`, `harder`, `hardest` |
| `color` | string enum | The color to play: `white`, `black`, or empty for 50% white |

**Available themes** are listed in the [lichess source code](https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml) and the [lichess training themes hyperlinks](https://lichess.org/training/themes).

## Response Format

```json
{
  "game": {
    "id": "AE2fvlo1",
    "perfF": {
      "key": "blitz",
      "name": "Blitz"
    },
    "rated": true,
    "players": [
      {
        "name": "Ksa9000",
        "id": "ksa9000",
        "color": "white"
      }
    ]
  },
  "puzzle": {
    "id": "puzzle_id",
    "rating": 1500,
    "plays": 1000,
    "solution": ["e2e4", "e7e5"],
    "themes": ["middlegame", "advantage"]
  }
}
```

## Integration Strategy

**For BooGMe:**
1. **Use `/api/puzzle/next` endpoint** for real-time puzzle fetching
2. **No authentication needed** — anonymous access works perfectly
3. **Cache puzzles** on the backend to avoid rate limiting
4. **Filter by difficulty** to match student skill levels
5. **Display puzzle rating** to show difficulty level
6. **Track solutions** in our database for student progress

## Rate Limiting

- Make only **one request at a time**
- If you receive HTTP 429, wait a full minute before resuming
- Consider caching puzzles to reduce API calls

## Alternative: Full Database

For bulk access, Lichess provides a [full puzzle database download](https://database.lichess.org/#puzzles) with 1.5+ million puzzles. This is better for:
- Offline access
- Bulk analysis
- Custom filtering
- No rate limits

For BooGMe's use case (interactive puzzle solving), the API endpoint is more appropriate.
