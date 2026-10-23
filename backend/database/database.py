import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

# Use environment variable or fallback to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./energy_twin.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_tables():
    Base.metadata.create_all(bind=engine)
    # Safe migration: ensure api_key column exists on devices table
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE devices ADD COLUMN api_key VARCHAR"))
            conn.commit()
    except Exception:
        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
