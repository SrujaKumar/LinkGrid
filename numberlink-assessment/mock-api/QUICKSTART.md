# Quick Start

## Start the Mock API Server

```bash
docker-compose up -d
```

## Stop the Server

```bash
docker-compose down
```

## API Endpoints

Base URL: `http://localhost:4010`

### Levels

- `GET /levels` - List available levels
- `GET /levels?difficulty=easy&limit=10` - Filter by difficulty
- `POST /levels` - Create a new level
- `GET /levels/{levelId}` - Get a specific level

### Scores

- `GET /scores` - Get all scores
- `GET /scores?levelId={id}` - Get scores for a specific level
- `POST /scores` - Submit a score

## Documentation

Interactive API docs with examples and schemas: `http://localhost:4010/docs`

`
