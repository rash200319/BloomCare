# Local Temporal infrastructure

Start the local Temporal service and UI from the repository root:

```powershell
docker compose -f infra/temporal/docker-compose.yml up -d
```

- Temporal frontend: `localhost:7233`
- Temporal UI: <http://localhost:8088>
- Temporal PostgreSQL host port: `5434` by default

Enable orchestration in `backend/.env`:

```env
TEMPORAL_ENABLED=true
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_APPOINTMENT_TASK_QUEUE=bloomcare-appointments
```

Start the worker in a separate terminal:

```powershell
python -m backend.orchestration.appointments.worker
```

This compose stack is for local development. Production should use Temporal Cloud or a properly operated Temporal cluster, TLS, restricted UI access, and an encrypted payload codec before processing real healthcare data.

