# Local API Deployment

This checkout now includes server routes for repeatable local calls.

## Start

```bash
cd /Users/suweibin/Documents/Codex/2026-06-08/github-plugin-github-openai-curated-51/work/ziwei-doushu
PORT=3000 ./scripts/start-local.sh
```

The service listens at:

```text
http://127.0.0.1:3000
```

## Calculate

```bash
curl -s http://127.0.0.1:3000/api/calculate \
  -H 'Content-Type: application/json' \
  -d '{"year":1990,"month":6,"day":15,"hour":4,"gender":"male","name":"demo"}'
```

The response includes:

- `chart`: generated Zi Wei chart
- `patterns`: matches from `lib/ziwei/patterns.ts`
- `sihua`: native/current-year/current-da-xian transformations
- `classics.references`: matched passages from the bundled classics
- `sampleData`: local 518,400-sample dataset status
- `audit`: reproducible verification steps for this calculation

## Sample Dataset

Download the release assets from:

```text
https://github.com/Renhuai123/ziwei-doushu/releases/tag/v3.0-samples
```

After extracting, point the service to the sample directory:

```bash
export ZIWEI_SAMPLE_DIR=/absolute/path/to/ziwei-samples-v3
PORT=3000 ./scripts/start-local.sh
```

If the sample dataset is absent, the API still calculates from the checked-in algorithm, four-transform rules, pattern rules, and classics, and records the missing dataset as a warning in `audit.steps`.
