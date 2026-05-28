import asyncio
from app.core.database import AsyncSessionLocal, Base, engine
from app.models.user import User
from app.api.events import upload_csv
from fastapi import UploadFile
import io

async def test_csv():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        csv_content = b"event_name,user_id,severity,message,source,browser,os\nuser_login,usr_123,info,User logged in successfully,web_app,Chrome,Windows\n"
        file = UploadFile(filename="test.csv", file=io.BytesIO(csv_content))
        
        try:
            res = await upload_csv(file=file, db=db, org_id=1)
            print("CSV uploaded:", res)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_csv())
