from sqlalchemy.orm import Session
from core.security import verify_password
from models.user import User

def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()
