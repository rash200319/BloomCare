from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID


# BloomCare's checked-in PostgreSQL schema uses native UUID keys, while the
# lightweight SQLite/demo schema stores the same identifiers as strings.
UUID_REFERENCE = String(36).with_variant(
    PostgreSQLUUID(as_uuid=False),
    "postgresql",
)
