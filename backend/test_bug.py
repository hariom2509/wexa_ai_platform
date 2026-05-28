import asyncio
from app.core.database import AsyncSessionLocal, Base, engine
from app.models.api_key import ApiKey
from app.models.user import User
from app.schemas.auth import ApiKeyCreate
from app.api.api_keys import create_api_key

async def test_api_key():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        # Create a dummy user
        user = User(email="test@test.com", hashed_password="pw", role="owner", organization_id=1)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Test create_api_key
        key_in = ApiKeyCreate(name="Test Key")
        try:
            res = await create_api_key(key_in=key_in, current_user=user, db=db)
            print("API Key created successfully:", res)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api_key())
