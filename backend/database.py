from sqlalchemy import create_engine
from sqlalchemy.engine import URL

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username="postgres",
    password="Janani@123",
    host="localhost",
    port=5432,
    database="sentinelai"
)

engine = create_engine(DATABASE_URL)

with engine.connect() as connection:
    print("SentinelAI PostgreSQL database connected!")