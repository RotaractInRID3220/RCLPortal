#!/usr/bin/env sh
# Nightly logical backup to an S3-compatible bucket (R2/B2). Run from cron/Dokploy schedule on the DB host.
# Needs: pg_dump, aws cli (or rclone). Env: DATABASE_DIRECT_URL, BACKUP_BUCKET, BACKUP_ENDPOINT.
set -eu
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="/tmp/rcl-$STAMP.dump"
pg_dump --format=custom --no-owner "$DATABASE_DIRECT_URL" > "$FILE"
aws --endpoint-url "$BACKUP_ENDPOINT" s3 cp "$FILE" "s3://$BACKUP_BUCKET/rcl/$STAMP.dump"
rm -f "$FILE"
echo "backup $STAMP uploaded"
# Restore drill (do it once before the event):  pg_restore --clean --if-exists -d <scratch db> rcl-<stamp>.dump
