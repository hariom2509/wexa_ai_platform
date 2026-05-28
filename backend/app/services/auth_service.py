from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserCreate, UserLogin, Token
from app.core.security import get_password_hash, verify_password, create_access_token

class AuthService:
    async def register(self, db: AsyncSession, user_in: UserCreate) -> User:
        # Check if user exists
        result = await db.execute(select(User).where(User.email == user_in.email))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create organization
        org = Organization(name=user_in.organization_name)
        db.add(org)
        await db.flush()
        
        # Create user
        user = User(
            email=user_in.email,
            password_hash=get_password_hash(user_in.password),
            organization_id=org.id,
            role="owner"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def authenticate(self, db: AsyncSession, user_in: UserLogin) -> Token:
        result = await db.execute(select(User).where(User.email == user_in.email))
        user = result.scalars().first()
        if not user or not verify_password(user_in.password, user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect email or password")
        
        access_token = create_access_token(subject=user.id)
        return Token(access_token=access_token, token_type="bearer")

auth_service = AuthService()