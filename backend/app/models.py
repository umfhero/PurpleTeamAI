from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    role: str = Field(default="user")

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    scans: List["Scan"] = Relationship(back_populates="project")

class Scan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    type: str # recon, pentest, etc.
    status: str = Field(default="pending") # pending, running, completed, failed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    project: Project = Relationship(back_populates="scans")
    vulnerabilities: List["Vulnerability"] = Relationship(back_populates="scan")

class Vulnerability(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: int = Field(foreign_key="scan.id")
    title: str
    description: str
    severity: str # critical, high, medium, low, info
    cvss_score: Optional[float] = None
    remediation: Optional[str] = None
    scan: Scan = Relationship(back_populates="vulnerabilities")

class Asset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    type: str # domain, ip, url
    value: str
    discovered_at: datetime = Field(default_factory=datetime.utcnow)
