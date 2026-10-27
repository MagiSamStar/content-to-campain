import sqlite3
from contextlib import contextmanager
from pathlib import Path


DATABASE_PATH = Path(__file__).parent / "campaigns.db"


@contextmanager
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    else:
        connection.commit()
    finally:
        connection.close()

def initialize_database():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                source_material TEXT NOT NULL,
                audience TEXT NOT NULL,
                objective TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                platform TEXT NOT NULL,
                content TEXT NOT NULL,
                approval_status TEXT NOT NULL DEFAULT 'draft',
                revision INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
            )
            """
        )

        
        # Add the Sent message ID column to existing databases.
        draft_columns = connection.execute(
            "PRAGMA table_info(drafts)"
        ).fetchall()

        column_names = {
            column["name"] for column in draft_columns
        }

        if "sent_message_id" not in column_names:
            connection.execute(
                "ALTER TABLE drafts ADD COLUMN sent_message_id TEXT"
            )

        if "approved_at" not in column_names:
            connection.execute(
                "ALTER TABLE drafts ADD COLUMN approved_at TEXT"
            )
