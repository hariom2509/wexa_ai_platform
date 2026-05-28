from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class OrganizationInvite(Base):
    __tablename__ = "organization_invites"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    role = Column(String, default="viewer")
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_accepted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization")
