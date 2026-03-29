from backend.db.session import SessionLocal
from backend.models.user import User as DBUser
from backend.core.security import get_password_hash

db = SessionLocal()
try:
    db.query(DBUser).filter(DBUser.email == 'admin@example.com').delete()
    db.commit()
    u = DBUser(id='0001', email='admin@example.com', hashed_password=get_password_hash('changeme'), full_name='Admin', role='ADMIN', is_active=True)
    db.add(u)
    db.commit()
    print('created')
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
