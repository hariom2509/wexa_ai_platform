from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status
from app.models.user import User
from app.models.organization import Organization
from app.models.invite import OrganizationInvite
from app.schemas.auth import UserCreate, UserLogin, Token, InviteCreate, InviteAccept
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
import secrets
from datetime import datetime, timedelta

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

    async def authenticate(self, db: AsyncSession, user_in: UserLogin) -> tuple[str, str]:
        result = await db.execute(select(User).where(User.email == user_in.email))
        user = result.scalars().first()
        if not user or not verify_password(user_in.password, user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect email or password")
        
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        return access_token, refresh_token

    async def create_invite(self, db: AsyncSession, invite_in: InviteCreate, current_user: User) -> OrganizationInvite:
        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(days=3)
        
        invite = OrganizationInvite(
            email=invite_in.email,
            organization_id=current_user.organization_id,
            role=invite_in.role,
            token=token,
            expires_at=expires
        )
        db.add(invite)
        await db.commit()
        await db.refresh(invite)
        
        # Mock Email Delivery
        print(f"MOCK EMAIL to {invite.email}: You've been invited! Link: https://wexaaiplatform.vercel.app/invite/{token}")
        
        return invite

    async def accept_invite(self, db: AsyncSession, accept_in: InviteAccept) -> User:
        result = await db.execute(select(OrganizationInvite).where(
            OrganizationInvite.token == accept_in.token,
            OrganizationInvite.is_accepted == False
        ))
        invite = result.scalars().first()
        
        if not invite or invite.expires_at.replace(tzinfo=None) < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired invite token")
            
        # Check if user already exists
        user_result = await db.execute(select(User).where(User.email == invite.email))
        if user_result.scalars().first():
            raise HTTPException(status_code=400, detail="User already registered")
            
        user = User(
            email=invite.email,
            password_hash=get_password_hash(accept_in.password),
            organization_id=invite.organization_id,
            role=invite.role
        )
        db.add(user)
        
        invite.is_accepted = True
        await db.commit()
        await db.refresh(user)
        return user

auth_service = AuthService()