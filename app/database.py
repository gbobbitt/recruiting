
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)


############################## Database Models ##############################


class Profile(db.Model):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(primary_key=True)
    data: Mapped[str]

    simulations: Mapped[list["Simulation"]] = relationship(back_populates="profile")


class Simulation(db.Model):
    __tablename__ = "simulations"

    id: Mapped[str] = mapped_column(primary_key=True)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"))
    data: Mapped[str]

    profile: Mapped["Profile"] = relationship(back_populates="simulations")

